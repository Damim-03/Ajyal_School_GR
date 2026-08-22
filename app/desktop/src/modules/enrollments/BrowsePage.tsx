import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  BadgeDollarSign,
  CircleCheckBig,
  ClipboardCheck,
  Loader2,
  Phone,
  TriangleAlert,
  User,
  Users,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { Avatar } from "../../components/shared/Avatar";
import { BarcodeScanner } from "../../components/shared/BarcodeScanner";
import {
  FilterField,
  FilterPanel,
  FilterSelect,
  type FilterChip,
} from "../../components/shared/FilterPanel";
import { useAcademicYears } from "../../core/api/reference.api";
import { useSchoolStore } from "../../core/stores/school.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { money } from "../finance/finance.api";
import {
  getAttendanceSummary,
  getStudent,
  listStudentInvoices,
  listStudents,
  type AttendanceSummary,
  type Student,
  type StudentInvoice,
} from "../students/student.api";
import { useAssignmentFilters } from "./assignment-filters";
import {
  fullName,
  listAssignments,
  listEnrollments,
  type Assignment,
  type Enrollment,
} from "./enrollments.api";

const ACCENT = "#7dd3fc";

/**
 * عرض الطلبة.
 *
 * الشاشة تبدأ من **الفوج** لا من الطالب: السؤال هنا «مَن في هذا
 * الفوج؟» لا «أين هذا الطالب؟». والمرشِّحات الخمسة تضيّق حتى يبقى
 * الفوج المطلوب وحده.
 *
 * وفتحُ الطالب يُظهر ملفّه كاملاً في نافذةٍ واحدة — بياناته وحضوره
 * وديونه ووضعيته — لأنّ مَن يقف أمام الشبّاك يحتاجها مجتمعةً في لحظة
 * السؤال، لا موزَّعةً على ثلاث شاشات.
 */
export default function BrowsePage() {
  const exitTo = useScreenExit();

  const yearsQuery = useAcademicYears();
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const [yearId, setYearId] = useState("");

  const [assignments, setAssignments] = useState<Assignment[]>([]);

  /* نفسُ خُطّاف الإسناد والنقل — قاعدةُ «أسقِط ما تعارض فقط» تُكتب مرّة */
  const {
    filters,
    setFilter,
    reset: resetFilters,
    options,
  } = useAssignmentFilters(assignments);

  const [rows, setRows] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Enrollment | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId((years.find((y) => y.isCurrent) ?? years[0]!).id);
  }, [years, yearId]);

  useEffect(() => {
    if (!yearId) return;
    let alive = true;
    resetFilters();

    listAssignments(yearId)
      .then((r) => alive && setAssignments(r))
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [yearId, resetFilters]);

  /**
   * التحميل بالمرشِّحات لا بجلب كل شيء ثم الترشيح في المتصفّح:
   * الخادم يقبل subjectId و studyGroupId و teacherId مباشرة.
   */
  const load = useCallback(async () => {
    if (!yearId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await listEnrollments({
        academicYearId: yearId,
        isActive: true,
        ...(filters.subjectId && { subjectId: filters.subjectId }),
        ...(filters.groupId && { studyGroupId: filters.groupId }),
        ...(filters.teacherId && { teacherId: filters.teacherId }),
        limit: 100,
      });

      /* المستوى والطور ليسا في مرشِّحات الخادم — يُطبَّقان هنا */
      const filtered = res.enrollments.filter((e) => {
        const g = e.teachingAssignment.studyGroup;
        return !filters.levelId || g.level.id === filters.levelId;
      });

      setRows(filtered);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر جلب الطلبة");
    } finally {
      setLoading(false);
    }
  }, [yearId, filters]);

  useEffect(() => {
    load();
  }, [load]);

  /** طالبٌ واحد لكل صفّ ولو تعدّدت مواده في الفوج */
  const byStudent = useMemo(() => {
    const map = new Map<string, { row: Enrollment; subjects: string[] }>();

    for (const e of rows) {
      const found = map.get(e.student.id);

      if (found) found.subjects.push(e.teachingAssignment.subject.name);
      else
        map.set(e.student.id, {
          row: e,
          subjects: [e.teachingAssignment.subject.name],
        });
    }

    return [...map.values()].sort((a, b) =>
      `${a.row.student.lastName} ${a.row.student.firstName}`.localeCompare(
        `${b.row.student.lastName} ${b.row.student.firstName}`,
        "ar",
      ),
    );
  }, [rows]);

  const chips = useMemo<FilterChip[]>(() => {
    const out: FilterChip[] = [];
    const year = years.find((y) => y.id === yearId);
    const named = (
      key: keyof typeof filters,
      label: string,
      items: { id: string; name: string }[],
    ) => {
      const found = items.find((i) => i.id === filters[key]);
      if (found) out.push({ label, value: found.name });
    };

    if (year) out.push({ label: "السنة", value: year.name });
    named("stageId", "الطور", options.stages);
    named("levelId", "المستوى", options.levels);
    named("subjectId", "المادة", options.subjects);
    named(
      "teacherId",
      "الأستاذ",
      options.teachers.map((t) => ({ id: t.id, name: fullName(t) })),
    );
    named("groupId", "الفوج", options.groups);

    return out;
  }, [years, yearId, filters, options]);

  /**
   * المسحُ يبحث في المؤسسة كلِّها ثمّ يفتح الملفّ.
   *
   * ويبدأ بما هو معروضٌ أمامه: الغالبُ أن يكون الممسوحُ في الفوج
   * المفتوح، فيُفتح بلا رحلةٍ إلى الخادم. وإن لم يكن فيه طُلب من
   * الخادم — البطاقةُ في اليد لا تعرف بأيّ مرشِّحٍ فُتحت الشاشة.
   */
  const scan = async (text: string): Promise<Enrollment | null> => {
    const code = text.trim();
    if (!code || !yearId) return null;

    const here = rows.find((r) => r.student.studentNumber === code);
    if (here) return here;

    setScanning(true);

    try {
      const { students } = await listStudents({ studentNumber: code, limit: 5 });
      const student = students.find((s) => s.studentNumber === code);
      if (!student) return null;

      const { enrollments } = await listEnrollments({
        studentId: student.id,
        academicYearId: yearId,
        isActive: true,
        limit: 100,
      });

      return enrollments[0] ?? null;
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="عرض الطلبة" subtitle="الفوج ومَن فيه">
        <button
          onClick={() => exitTo(PATHS.enrollments)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-[1500px] p-6">
        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        )}

        <FilterPanel
          accent={ACCENT}
          storageKey="enrollments.browse"
          /* اختيارُ الفوج آخرُ الحقول — وبعده يُطوى اللوح من نفسه */
          collapseKey={filters.groupId}
          busy={loading}
          chips={chips}
          onReset={resetFilters}
          /*
            المسحُ يفتح الملفّ لا يُرشّح القائمة.

            من مسح بطاقةً أمام الشبّاك يريد جوابَ «مَن هذا وماذا عليه؟»
            في لحظته — لا أن يرى سطراً يضغط عليه بعدها. ويبحث في
            المؤسسة كلِّها لا في المعروض: البطاقةُ في اليد لا تعرف بأيّ
            مرشِّحٍ فُتحت الشاشة. ومحلُّه ترويسةُ اللوح كما في بقيّة
            الشاشات — يبقى في متناول اليد مطويّاً اللوحُ أو مفتوحاً.
          */
          extra={
            <BarcodeScanner<Enrollment>
                accent={ACCENT}
                busy={scanning}
                onFound={setOpened}
                copy={{
                  button: "مسح بطاقة",
                  buttonTitle: "افتح ملفّ الطالب بمسح باركود بطاقته",
                  title: "مسح رقم تسجيل الطالب",
                  subtitle: "يُفتح ملفُّه كاملاً — بياناته وحضوره وديونه",
                  placeholder: "امسح باركود البطاقة، أو اكتب رقم التسجيل…",
                  action: "افتح الملفّ",
                  notFound:
                    "لا طالبَ بهذا الرقم في هذه السنة الدراسية — تحقّق من الرمز أو من السنة.",
                  hint: "الرقم مكتوبٌ تحت الباركود",
                  steps: [
                    <>
                      وجّه القارئ إلى{" "}
                      <span className="font-bold text-white/85">باركود بطاقة الطالب</span>.
                    </>,
                    <>القارئ يكتب الرقم في الحقل أدناه من نفسه ثمّ يُرسله.</>,
                    <>يُفتح ملفُّه — ولو لم يكن ضمن المرشِّحات المعروضة.</>,
                  ],
                }}
                resolve={scan}
              />
          }
        >
          <FilterField label="السنة الدراسية">
            <FilterSelect
              value={yearId}
              onChange={setYearId}
              items={years.map((y) => ({ id: y.id, name: y.name }))}
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="الطور">
            <FilterSelect
              value={filters.stageId}
              onChange={(v) => setFilter("stageId", v)}
              items={options.stages}
              placeholder="كل الأطوار"
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="المستوى">
            <FilterSelect
              value={filters.levelId}
              onChange={(v) => setFilter("levelId", v)}
              items={options.levels}
              placeholder="كل المستويات"
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="المادة">
            <FilterSelect
              value={filters.subjectId}
              onChange={(v) => setFilter("subjectId", v)}
              items={options.subjects}
              placeholder="كل المواد"
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="الأستاذ">
            <FilterSelect
              value={filters.teacherId}
              onChange={(v) => setFilter("teacherId", v)}
              items={options.teachers.map((t) => ({ id: t.id, name: fullName(t) }))}
              placeholder="كل الأساتذة"
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="الفوج">
            <FilterSelect
              value={filters.groupId}
              onChange={(v) => setFilter("groupId", v)}
              items={options.groups}
              placeholder="كل الأفواج"
              accent={ACCENT}
            />
          </FilterField>
        </FilterPanel>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <span className="text-xs font-bold text-white/50">
              {byStudent.length} طالباً
            </span>

            <span className="text-[11px] text-white/30">انقر على الطالب لفتح ملفّه</span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/50">
                <th className="w-32 px-3 py-3 text-center font-bold">رقم التسجيل</th>
                <th className="px-4 py-3 text-start font-bold">اللقب والاسم</th>
                <th className="px-4 py-3 text-start font-bold">المستوى</th>
                <th className="px-4 py-3 text-start font-bold">الفوج</th>
                <th className="px-4 py-3 text-start font-bold">المواد</th>
                <th className="px-4 py-3 text-start font-bold">هاتف الوليّ</th>
              </tr>
            </thead>

            <tbody>
              {byStudent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-white/50">
                    {loading ? "…" : "لا طلبة مطابقون — وسّع المرشِّحات"}
                  </td>
                </tr>
              ) : (
                byStudent.map(({ row, subjects }) => (
                  <tr
                    key={row.student.id}
                    onClick={() => setOpened(row)}
                    className="cursor-pointer border-b border-white/5 transition last:border-0 hover:bg-white/[0.05]"
                  >
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-mono text-[12px] text-white/45" dir="ltr">
                        {row.student.studentNumber}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {/* الوجهُ قبل الاسم — يُعرف الطالب به قبل أن يُقرأ سطرُه */}
                      <span className="flex items-center gap-2.5">
                        <Avatar
                          src={row.student.avatar}
                          name={fullName(row.student)}
                          gender={row.student.gender}
                          size={30}
                        />
                        <span className="font-bold">{fullName(row.student)}</span>
                      </span>
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
                    <td className="px-4 py-2.5 text-[12px] text-white/55">
                      {subjects.join(" · ")}
                    </td>
                    <td className="px-4 py-2.5 text-white/50" dir="ltr">
                      {row.student.parentPhone}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {opened && (
        <StudentModal
          enrollment={opened}
          yearId={yearId}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}

// --------------------------------------------------
// ملفّ الطالب — نافذةٌ واحدة تجيب عن كل ما يُسأل عند الشبّاك
// --------------------------------------------------

function StudentModal({
  enrollment,
  yearId,
  onClose,
}: {
  enrollment: Enrollment;
  yearId: string;
  onClose: () => void;
}) {
  const currency = useSchoolStore((s) => s.settings["school.currency"] ?? "دج");

  /* الاسم من الصفّ فوراً، والتفاصيل حين تصل — فلا تُفتح النافذة فارغة */
  const brief = enrollment.student;

  const [student, setStudent] = useState<Student | null>(null);
  const [subjects, setSubjects] = useState<Enrollment[]>([]);
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    /*
     * الصفّ يحمل من الطالب اسمَه وهاتفَ وليّه فقط — وهو ما يكفي الجدول.
     * والملفّ يحتاج بقيّته، فيُجلب هنا لا في القائمة: طلبٌ واحد عند
     * الفتح أرخص من مئة طلبٍ عند العرض.
     */
    Promise.all([
      getStudent(brief.id),
      listEnrollments({ studentId: brief.id, academicYearId: yearId, limit: 100 }),
      listStudentInvoices(brief.id),
      getAttendanceSummary(brief.id).catch(() => null),
    ])
      .then(([full, en, inv, sum]) => {
        if (!alive) return;
        setStudent(full);
        setSubjects(en.enrollments);
        setInvoices(inv.invoices);
        setSummary(sum);
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [brief.id, yearId]);

  /**
   * الوضعية: مسوّاة أم ناقصة.
   *
   * الملغاة لا تُحسب ديناً — كأنّها لم تكن. والمتبقّي من غيرها هو
   * الدين الفعلي، وصفرُه يعني التسوية.
   */
  const debt = useMemo(() => {
    const live = invoices.filter((i) => i.status !== "CANCELLED");

    const due = live.reduce((s, i) => s + i.total, 0);
    const remaining = live.reduce((s, i) => s + i.remaining, 0);

    return {
      due,
      paid: due - remaining,
      remaining,
      unpaidCount: live.filter((i) => i.remaining > 0).length,
      settled: remaining <= 0,
      overdue: live.filter(
        (i) => i.remaining > 0 && new Date(i.dueDate) < new Date(),
      ).length,
    };
  }, [invoices]);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: MOTION.duration.fast }}
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-white/10 bg-[#0a0f1a]"
      >
        {/* ===== الترويسة والوضعية ===== */}
        <div className="flex items-start gap-4 border-b border-white/10 p-5">
          <Avatar
            src={brief.avatar}
            name={fullName(brief)}
            gender={brief.gender}
            size={56}
            ring={ACCENT}
          />

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xl font-black">{fullName(brief)}</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/45">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {enrollment.teachingAssignment.studyGroup.level.name} ·{" "}
                {enrollment.teachingAssignment.studyGroup.name}
              </span>
              <span className="flex items-center gap-1.5" dir="ltr">
                <Phone className="h-3.5 w-3.5" />
                {brief.parentPhone}
              </span>
            </p>
          </div>

          <span
            className="flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-black"
            style={
              debt.settled
                ? { background: "rgba(134,239,172,0.14)", color: "#86efac" }
                : { background: "rgba(253,164,175,0.14)", color: "#fda4af" }
            }
          >
            {debt.settled ? (
              <CircleCheckBig className="h-4 w-4" />
            ) : (
              <TriangleAlert className="h-4 w-4" />
            )}
            {debt.settled ? "وضعية مسوّاة" : "وضعية ناقصة"}
          </span>

          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            {/* ===== الأرقام ===== */}
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat
                icon={BadgeDollarSign}
                label="المستحقّ"
                value={money(debt.due, currency)}
                tone="#cbd5e1"
              />
              <Stat
                icon={BadgeDollarSign}
                label="المدفوع"
                value={money(debt.paid, currency)}
                tone="#86efac"
              />
              <Stat
                icon={BadgeDollarSign}
                label="المتبقّي"
                value={money(debt.remaining, currency)}
                tone={debt.remaining > 0 ? "#fda4af" : "#86efac"}
              />
              <Stat
                icon={ClipboardCheck}
                label="نسبة الحضور"
                value={summary ? `${summary.attendanceRate}%` : "—"}
                tone={ACCENT}
              />
            </div>

            {debt.overdue > 0 && (
              <p className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-200">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                {debt.overdue} فاتورة تجاوزت تاريخ استحقاقها
              </p>
            )}

            {/* ===== البيانات الشخصية ===== */}
            {student && (
              <Section icon={User} title="المعلومات الشخصية">
                <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  <Meta label="الجنس" value={student.gender === "MALE" ? "ذكر" : "أنثى"} />
                  <Meta label="هاتف الوليّ" value={student.parentPhone} ltr />
                  <Meta label="الهاتف" value={student.phone ?? "—"} ltr />
                  <Meta label="هاتف الطوارئ" value={student.emergencyPhone ?? "—"} ltr />
                  <Meta label="تاريخ الميلاد" value={fmtDate(student.birthDate)} ltr />
                  <Meta label="تاريخ التسجيل" value={fmtDate(student.registrationDate)} ltr />
                  <Meta label="المدرسة الأصلية" value={student.schoolName ?? "—"} />
                  <Meta label="العنوان" value={student.address ?? "—"} />
                </div>

                {student.note && (
                  <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-xs leading-relaxed text-white/60">
                    {student.note}
                  </p>
                )}
              </Section>
            )}

            {/* ===== المواد ===== */}
            <Section icon={Users} title={`المواد والأفواج (${subjects.filter((s) => s.isActive).length})`}>
              {subjects.length === 0 ? (
                <p className="text-xs text-white/40">لا إسنادات</p>
              ) : (
                <div className="space-y-1.5">
                  {subjects.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/[0.03] px-3 py-2 text-xs"
                    >
                      <span className="font-bold">{s.teachingAssignment.subject.name}</span>
                      <span className="text-white/45">
                        {fullName(s.teachingAssignment.teacher)}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 font-bold"
                        style={{ background: `${ACCENT}1f`, color: ACCENT }}
                      >
                        {s.teachingAssignment.studyGroup.name}
                      </span>
                      {!s.isActive && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/45">
                          معطَّل
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ===== الحضور ===== */}
            {summary && (
              <Section icon={ClipboardCheck} title="الحضور">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Pill label="حاضر" value={summary.counts.PRESENT} tone="#86efac" />
                  <Pill label="غائب" value={summary.counts.ABSENT} tone="#fda4af" />
                  <Pill label="متأخّر" value={summary.counts.LATE} tone="#fcd34d" />
                  <Pill label="بعذر" value={summary.counts.EXCUSED} tone="#a5b4fc" />
                  <Pill label="المجموع" value={summary.total} tone="#cbd5e1" />
                </div>
              </Section>
            )}

            {/* ===== الديون ===== */}
            <Section icon={BadgeDollarSign} title={`الفواتير (${invoices.length})`}>
              {invoices.length === 0 ? (
                <p className="text-xs text-white/40">لا فواتير</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/45">
                      <th className="px-2 py-2 text-start font-bold">الرقم</th>
                      <th className="px-2 py-2 text-start font-bold">المادة</th>
                      <th className="px-2 py-2 text-center font-bold">الشهر</th>
                      <th className="px-2 py-2 text-center font-bold">المبلغ</th>
                      <th className="px-2 py-2 text-center font-bold">المتبقّي</th>
                      <th className="px-2 py-2 text-center font-bold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-white/5 last:border-0">
                        <td className="px-2 py-2 text-white/50" dir="ltr">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-2 py-2">
                          {inv.studentEnrollment.teachingAssignment.subject.name}
                        </td>
                        <td className="px-2 py-2 text-center text-white/50" dir="ltr">
                          {inv.month}/{inv.year}
                        </td>
                        <td className="px-2 py-2 text-center">{money(inv.total, currency)}</td>
                        <td
                          className="px-2 py-2 text-center font-bold"
                          style={{ color: inv.remaining > 0 ? "#fda4af" : "#86efac" }}
                        >
                          {money(inv.remaining, currency)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={INVOICE_TONE[inv.status]}
                          >
                            {INVOICE_LABEL[inv.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          </div>
        )}
      </motion.div>
    </>
  );
}

// --------------------------------------------------

const INVOICE_LABEL: Record<string, string> = {
  PENDING: "غير مدفوعة",
  PARTIAL: "جزئية",
  PAID: "خالصة",
  CANCELLED: "ملغاة",
};

const INVOICE_TONE: Record<string, { background: string; color: string }> = {
  PENDING: { background: "rgba(253,164,175,0.14)", color: "#fda4af" },
  PARTIAL: { background: "rgba(252,211,77,0.14)", color: "#fcd34d" },
  PAID: { background: "rgba(134,239,172,0.14)", color: "#86efac" },
  CANCELLED: { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)" },
};

const fmtDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("fr-DZ") : "—";

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BadgeDollarSign;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] text-white/40">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="block text-base font-black" style={{ color: tone }}>
        {value}
      </span>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-black">
        <Icon className="h-4 w-4" style={{ color: ACCENT }} />
        {title}
      </h4>
      {children}
    </div>
  );
}

function Meta({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <span className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1">
      <span className="text-[11px] text-white/40">{label}</span>
      <span className="font-bold text-white/80" dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
    </span>
  );
}

function Pill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span
      className="rounded-lg px-3 py-1.5 font-bold"
      style={{ background: `${tone}1a`, color: tone }}
    >
      {label} {value}
    </span>
  );
}
