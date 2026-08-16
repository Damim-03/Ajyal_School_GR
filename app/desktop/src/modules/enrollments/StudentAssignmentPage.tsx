import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  Check,
  Loader2,
  Plus,
  Power,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { Avatar } from "../../components/shared/Avatar";
import { useAcademicYears } from "../../core/api/reference.api";
import { useAuthStore } from "../../core/stores/auth.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";
import { deriveOptions, type SheetFilters } from "../attendance/attendance.api";
import { listStudents, type Student } from "../students/student.api";
import {
  createEnrollment,
  deleteEnrollment,
  fullName,
  listAssignments,
  listEnrollments,
  updateEnrollment,
  type Assignment,
  type Enrollment,
} from "./enrollments.api";

const ACCENT = "#c4b5fd";

const EMPTY_FILTERS: SheetFilters = {
  stageId: "",
  levelId: "",
  subjectId: "",
  teacherId: "",
  groupId: "",
};

const FILTER_ORDER: (keyof SheetFilters)[] = [
  "stageId",
  "levelId",
  "subjectId",
  "teacherId",
  "groupId",
];

const matchesAll = (a: Assignment, f: SheetFilters) =>
  (!f.stageId || a.studyGroup.level.educationStage.id === f.stageId) &&
  (!f.levelId || a.studyGroup.level.id === f.levelId) &&
  (!f.subjectId || a.subject.id === f.subjectId) &&
  (!f.teacherId || a.teacher.id === f.teacherId) &&
  (!f.groupId || a.studyGroup.id === f.groupId);

/**
 * إسناد الطلبة.
 *
 * الطالب لا يُسجَّل في «مادة» مجرَّدة: يُسجَّل في **إسنادٍ تدريسي** يحمل
 * أربعتها معاً — المادة والأستاذ والفوج والسنة. ولذلك لا يوجد في هذه
 * الشاشة حقلٌ للفوج منفصلٌ عن حقل الأستاذ: اختيارُ أحدهما يضيّق الآخر،
 * لأنّ ما يُختار في النهاية صفٌّ واحد قائم لا تركيبةٌ تُؤلَّف.
 *
 * وهذا ما يمنع الخلط الذي طُلبت الشاشة لأجله: لا يمكن إسناد طالبٍ إلى
 * فوجٍ لا يدرّسه ذلك الأستاذ في تلك المادة، لأنّ التركيبة غير الموجودة
 * لا تظهر في القوائم أصلاً.
 *
 * الشاشة نصفان: الطلبة يميناً، وإسنادات المختار منهم يساراً.
 */
export default function StudentAssignmentPage() {
  const exitToHome = useScreenExit();
  const can = useAuthStore((s) => s.hasPermission);

  const yearsQuery = useAcademicYears();
  const years = yearsQuery.data ?? [];
  const [yearId, setYearId] = useState("");

  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /* السنة الافتراضية هي الجارية — لا أوّل ما يعود من الخادم */
  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId((years.find((y) => y.isCurrent) ?? years[0]).id);
  }, [years, yearId]);

  // --------------------------------------------------
  // الطلبة — البحث بتأخير قصير فلا طلبَ لكل حرف
  // --------------------------------------------------

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      setLoadingStudents(true);

      listStudents({ limit: 100, isActive: true, search: search || undefined })
        .then((res) => alive && setStudents(res.students))
        .catch(
          (err) =>
            alive &&
            setError(err?.response?.data?.message ?? "تعذّر جلب الطلبة"),
        )
        .finally(() => alive && setLoadingStudents(false));
    }, 250);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  // --------------------------------------------------
  // الإسنادات التدريسية — منها تُشتقّ كل القوائم
  // --------------------------------------------------

  useEffect(() => {
    if (!yearId) return;

    let alive = true;

    listAssignments(yearId)
      .then((rows) => alive && setAssignments(rows))
      .catch(
        (err) =>
          alive &&
          setError(err?.response?.data?.message ?? "تعذّر جلب الإسنادات"),
      );

    return () => {
      alive = false;
    };
  }, [yearId]);

  // --------------------------------------------------
  // إسنادات الطالب المختار
  // --------------------------------------------------

  const loadEnrollments = useCallback(async () => {
    if (!selected || !yearId) {
      setEnrollments([]);
      return;
    }

    setLoadingRows(true);
    setError(null);

    try {
      const res = await listEnrollments({
        studentId: selected.id,
        academicYearId: yearId,
        limit: 100,
      });

      setEnrollments(res.enrollments);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر جلب إسنادات الطالب");
    } finally {
      setLoadingRows(false);
    }
  }, [selected, yearId]);

  useEffect(() => {
    loadEnrollments();
  }, [loadEnrollments]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 2600);
  };

  // --------------------------------------------------
  // الإجراءات
  // --------------------------------------------------

  const toggleActive = async (row: Enrollment) => {
    try {
      await updateEnrollment(row.id, { isActive: !row.isActive });
      await loadEnrollments();
      flash(row.isActive ? "عُطِّل الإسناد" : "فُعِّل الإسناد");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر التعديل");
    }
  };

  const remove = async (row: Enrollment) => {
    try {
      await deleteEnrollment(row.id);
      await loadEnrollments();
      flash("حُذف الإسناد");
    } catch (err: any) {
      /* الخادم يمنع الحذف عند وجود فواتير أو حضور — ويقترح التعطيل */
      setError(err?.response?.data?.message ?? "تعذّر الحذف");
    }
  };

  const enrolledAssignmentIds = useMemo(
    () => new Set(enrollments.map((e) => e.teachingAssignmentId)),
    [enrollments],
  );

  /**
   * المواد المحجوزة بأستاذٍ آخر.
   *
   * الخادم يمنع تسجيل الطالب في نفس (مادة + فوج + سنة) مرّتين ولو
   * باختلاف الأستاذ — وإلّا فُوتِر عن المادة مرّتين. فتُعرَّف هنا لتُعطَّل
   * في القائمة قبل أن يصطدم المستخدم بالرفض.
   */
  const takenSubjectKeys = useMemo(
    () =>
      new Set(
        enrollments
          .filter((e) => e.isActive)
          .map(
            (e) =>
              `${e.teachingAssignment.subject.id}|${e.teachingAssignment.studyGroup.id}`,
          ),
      ),
    [enrollments],
  );

  const activeCount = enrollments.filter((e) => e.isActive).length;

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="إسناد الطلبة" subtitle="الطور · المستوى · المادة · الأستاذ · الفوج">
        <button
          onClick={() => exitToHome(PATHS.home)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-[1600px] p-6">
        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span className="whitespace-pre-line leading-relaxed">{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold text-white/45">
              السنة الدراسية
            </span>
            <select
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
              className={selectClass}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id} className="bg-[#0a0f1a]">
                  {y.name}
                </option>
              ))}
            </select>
          </label>

          <p className="mb-1 flex items-center gap-2 text-[11px] text-white/35">
            <BookMarked className="h-3.5 w-3.5" />
            الطالب يُسند إلى مادةٍ عند أستاذٍ في فوج — والثلاثة صفٌّ واحد لا
            تُؤلَّف تركيبتُه يدوياً
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          {/* ============ الطلبة ============ */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="border-b border-white/10 p-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث عن طالب…"
                  className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pe-4 ps-10 text-sm outline-none transition focus:border-white/30"
                />
                {loadingStudents && (
                  <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/30" />
                )}
              </div>
            </div>

            <div className="max-h-[62vh] overflow-y-auto">
              {students.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-white/40">
                  {loadingStudents ? "…" : "لا طلبة مطابقون"}
                </p>
              ) : (
                students.map((student) => {
                  const active = selected?.id === student.id;

                  return (
                    <button
                      key={student.id}
                      onClick={() => {
                        uiSound("navigate");
                        setSelected(student);
                        setError(null);
                      }}
                      className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-2.5 text-start transition last:border-0"
                      style={
                        active
                          ? { background: `${ACCENT}1f` }
                          : undefined
                      }
                    >
                      <Avatar
                        src={student.avatar}
                        name={fullName(student)}
                        gender={student.gender}
                        size={32}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">
                          {fullName(student)}
                        </span>
                        <span className="block text-[11px] text-white/35" dir="ltr">
                          {student.parentPhone}
                        </span>
                      </span>

                      {student._count && (
                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60">
                          {student._count.enrollments}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ============ إسنادات الطالب ============ */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
            {!selected ? (
              <div className="grid place-items-center px-6 py-24 text-center">
                <Users className="mb-3 h-11 w-11 text-white/15" />
                <p className="text-white/60">اختر طالباً من القائمة</p>
                <p className="mt-1.5 max-w-md text-xs text-white/35">
                  تظهر هنا مواده وأساتذته وأفواجه في السنة المختارة، ومنها
                  تُضاف مادةٌ جديدة أو يُنقل إلى فوجٍ آخر.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-black">
                      {fullName(selected)}
                    </h2>
                    <p className="text-xs text-white/40">
                      {activeCount} مادة نشطة
                      {enrollments.length > activeCount &&
                        ` · ${enrollments.length - activeCount} معطَّلة`}
                    </p>
                  </div>

                  {can("enrollment.create") && (
                    <button
                      onClick={() => setAdding(true)}
                      className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-[#160a2e] transition hover:brightness-110"
                      style={{ background: ACCENT }}
                    >
                      <Plus className="h-4 w-4" />
                      أسند مادة
                    </button>
                  )}
                </div>

                {loadingRows ? (
                  <div className="grid place-items-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                  </div>
                ) : enrollments.length === 0 ? (
                  <div className="grid place-items-center px-6 py-20 text-center">
                    <BookMarked className="mb-3 h-10 w-10 text-white/15" />
                    <p className="text-white/60">لا إسنادات في هذه السنة</p>
                    <p className="mt-1.5 text-xs text-white/35">
                      اضغط «أسند مادة» لإضافة أوّل مادة لهذا الطالب.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs text-white/50">
                        <th className="px-4 py-3 text-start font-bold">المادة</th>
                        <th className="px-4 py-3 text-start font-bold">الأستاذ</th>
                        <th className="px-4 py-3 text-start font-bold">المستوى</th>
                        <th className="px-4 py-3 text-start font-bold">الفوج</th>
                        <th className="w-24 px-3 py-3 text-center font-bold">الحالة</th>
                        <th className="w-28 px-3 py-3" />
                      </tr>
                    </thead>

                    <tbody>
                      {enrollments.map((row) => {
                        const locked =
                          (row._count?.invoices ?? 0) > 0 ||
                          (row._count?.attendances ?? 0) > 0;

                        return (
                          <tr
                            key={row.id}
                            className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
                          >
                            <td className="px-4 py-2.5 font-bold">
                              {row.teachingAssignment.subject.name}
                            </td>
                            <td className="px-4 py-2.5 text-white/70">
                              {fullName(row.teachingAssignment.teacher)}
                            </td>
                            <td className="px-4 py-2.5 text-white/60">
                              {row.teachingAssignment.studyGroup.level.name}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                                style={{ background: `${ACCENT}1f`, color: ACCENT }}
                              >
                                {row.teachingAssignment.studyGroup.name}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span
                                className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                                style={
                                  row.isActive
                                    ? { background: "rgba(134,239,172,0.14)", color: "#86efac" }
                                    : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }
                                }
                              >
                                {row.isActive ? "نشط" : "معطَّل"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-1.5">
                                {can("enrollment.update") && (
                                  <button
                                    onClick={() => toggleActive(row)}
                                    title={row.isActive ? "تعطيل" : "تفعيل"}
                                    className="rounded-lg border border-white/10 p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
                                  >
                                    <Power className="h-3.5 w-3.5" />
                                  </button>
                                )}

                                {can("enrollment.delete") && (
                                  <button
                                    onClick={() => remove(row)}
                                    disabled={locked}
                                    title={
                                      locked
                                        ? "له فواتير أو حضور — عطّله بدل حذفه"
                                        : "حذف"
                                    }
                                    className="rounded-lg border border-white/10 p-1.5 text-rose-300/70 transition hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-25"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {adding && selected && (
        <AssignDialog
          student={selected}
          assignments={assignments}
          enrolled={enrolledAssignmentIds}
          taken={takenSubjectKeys}
          onClose={() => setAdding(false)}
          onDone={async (message) => {
            setAdding(false);
            await loadEnrollments();
            flash(message);
          }}
        />
      )}

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-violet-400/30 bg-violet-500/15 px-5 py-2.5 text-sm font-bold text-violet-100 backdrop-blur"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}

// --------------------------------------------------
// حوار الإسناد
//
// المرشِّحات تضيّق بعضها: اختيارُ الطور يحصر المستويات، والمستوى يحصر
// الأفواج، وهكذا. وما يبقى في الأسفل ليس «تركيبةً» بل إسناداتٌ قائمة
// فعلاً — فلا يمكن إسناد طالبٍ إلى فوجٍ لا يدرّسه ذلك الأستاذ.
// --------------------------------------------------

function AssignDialog({
  student,
  assignments,
  enrolled,
  taken,
  onClose,
  onDone,
}: {
  student: Student;
  assignments: Assignment[];
  enrolled: Set<string>;
  taken: Set<string>;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [filters, setFilters] = useState<SheetFilters>(EMPTY_FILTERS);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () => deriveOptions(assignments, filters),
    [assignments, filters],
  );

  /** تغيير مرشِّح يُسقط ما تعارض معه حتى يعود الاختيار مطابقاً لإسنادٍ قائم */
  const setFilter = (key: keyof SheetFilters, value: string) => {
    setFilters((prev) => {
      let next = { ...prev, [key]: value };
      const others = FILTER_ORDER.filter((k) => k !== key);

      while (!assignments.some((a) => matchesAll(a, next))) {
        const drop = [...others].reverse().find((k) => next[k]);
        if (!drop) break;
        next = { ...next, [drop]: "" };
      }

      return next;
    });
  };

  const matching = useMemo(
    () => assignments.filter((a) => matchesAll(a, filters)),
    [assignments, filters],
  );

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const submit = async () => {
    if (picked.size === 0) return;

    setBusy(true);
    setError(null);

    try {
      await createEnrollment({
        studentId: student.id,
        teachingAssignmentIds: [...picked],
      });

      onDone(`أُسندت ${picked.size} مادة إلى ${fullName(student)}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر الإسناد");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: MOTION.duration.fast }}
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-white/10 bg-[#0a0f1a]"
      >
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div>
            <h3 className="text-lg font-black">أسند مادة</h3>
            <p className="text-xs text-white/45">{fullName(student)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-3 border-b border-white/10 p-4">
          <Picker
            label="الطور"
            value={filters.stageId}
            onChange={(v) => setFilter("stageId", v)}
            items={options.stages}
            all="كل الأطوار"
          />
          <Picker
            label="المستوى"
            value={filters.levelId}
            onChange={(v) => setFilter("levelId", v)}
            items={options.levels}
            all="كل المستويات"
          />
          <Picker
            label="المادة"
            value={filters.subjectId}
            onChange={(v) => setFilter("subjectId", v)}
            items={options.subjects}
            all="كل المواد"
          />
          <Picker
            label="الأستاذ"
            value={filters.teacherId}
            onChange={(v) => setFilter("teacherId", v)}
            items={options.teachers.map((t) => ({ id: t.id, name: fullName(t) }))}
            all="كل الأساتذة"
          />
          <Picker
            label="الفوج"
            value={filters.groupId}
            onChange={(v) => setFilter("groupId", v)}
            items={options.groups}
            all="كل الأفواج"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {matching.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm text-white/40">
              لا إسنادات مطابقة — وسّع المرشِّحات
            </p>
          ) : (
            matching.map((a) => {
              const already = enrolled.has(a.id);
              const conflict =
                !already && taken.has(`${a.subject.id}|${a.studyGroup.id}`);
              const disabled = already || conflict;
              const on = picked.has(a.id);

              return (
                <button
                  key={a.id}
                  disabled={disabled}
                  onClick={() => toggle(a.id)}
                  className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-start transition last:border-0 disabled:opacity-35"
                  style={on ? { background: `${ACCENT}1a` } : undefined}
                >
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-md border transition"
                    style={
                      on
                        ? { background: ACCENT, borderColor: ACCENT }
                        : { borderColor: "rgba(255,255,255,0.25)" }
                    }
                  >
                    {on && <Check className="h-3.5 w-3.5 text-[#160a2e]" />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{a.subject.name}</span>
                    <span className="block text-[11px] text-white/45">
                      {fullName(a.teacher)} · {a.studyGroup.level.name} ·{" "}
                      {a.studyGroup.name}
                    </span>
                  </span>

                  {already && (
                    <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/50">
                      مُسند سلفاً
                    </span>
                  )}

                  {conflict && (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-200">
                      <AlertTriangle className="h-3 w-3" />
                      المادة مأخوذة بأستاذ آخر
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {error && (
          <div className="border-t border-white/10 px-5 py-3 text-sm leading-relaxed text-rose-200">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-white/10 p-4">
          <button
            onClick={submit}
            disabled={busy || picked.size === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 font-black text-[#160a2e] transition hover:brightness-110 disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            {busy ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Check className="h-4.5 w-4.5" />}
            {picked.size > 0 ? `أسند ${picked.size} مادة` : "اختر مادة"}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
          >
            إلغاء
          </button>
        </div>
      </motion.div>
    </>
  );
}

// --------------------------------------------------

const selectClass =
  "rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-bold outline-none transition focus:border-white/30";

function Picker({
  label,
  value,
  onChange,
  items,
  all,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: { id: string; name: string }[];
  all: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold text-white/45">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="" className="bg-[#0a0f1a]">{all}</option>
        {items.map((i) => (
          <option key={i.id} value={i.id} className="bg-[#0a0f1a]">{i.name}</option>
        ))}
      </select>
    </label>
  );
}
