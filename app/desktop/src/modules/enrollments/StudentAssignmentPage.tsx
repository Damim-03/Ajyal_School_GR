import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  ChevronLeft,
  Loader2,
  Search,
  TriangleAlert,
  Trash2,
  UserPlus,
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
import { MotionDialog } from "../../motion/MotionDialog";
import { useAcademicYears } from "../../core/api/reference.api";
import { useAssignmentFilters } from "./assignment-filters";
import { Crumb, Empty, GroupCards, SubjectCards } from "./layers";
import { buildSubjectCards } from "./subject-groups";
import { useAuthStore } from "../../core/stores/auth.store";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";
import { StudentPickerField } from "../students/StudentPickerField";
import type { Student } from "../students/student.api";
import {
  createEnrollment,
  deleteEnrollment,
  fullName,
  listAssignments,
  listEnrollments,
  type Assignment,
  type Enrollment,
} from "./enrollments.api";

const ACCENT = "#f9a8d4";

/**
 * إسناد الطلبة — ثلاثُ طبقات لا شاشةٌ واحدة.
 *
 * كانت قائمةَ طلبةٍ إلى اليمين وتفاصيلَ طالبٍ إلى اليسار: تبدأ من
 * **الطالب** ثمّ تسأل «ما موادّه؟». وهو عكسُ ما يقع في المكتب: الموظّف
 * يفتح فوجاً ويُدخل فيه طالباً، لا يفتح طالباً ويبحث له عن فوج. فمن
 * أراد أن يعرف «من في فوج الإنجليزية الثاني؟» كان يفتح الطلبةَ واحداً
 * واحداً.
 *
 * فصارت تبدأ من المادة: **مادةٌ ← فوجٌ ← طلبتُه**. وكلُّ طبقةٍ تُجيب
 * سؤالاً كاملاً وتُبقي ما قبلها ظاهراً في مسار العودة، فلا يضيع
 * المستخدم في عمقٍ لا يعرف كيف خرج إليه.
 */
export default function StudentAssignmentPage() {
  const exitTo = useScreenExit();
  const can = useAuthStore((s) => s.hasPermission);

  const yearsQuery = useAcademicYears();
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const [yearId, setYearId] = useState("");

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  const { filters, setFilter, reset: resetFilters, options, visible } =
    useAssignmentFilters(assignments);

  /** الطبقة المفتوحة: مادةٌ ثمّ فوج — وفراغُهما يعني قائمة المواد */
  const [subjectId, setSubjectId] = useState("");
  const [openAssignment, setOpenAssignment] = useState<Assignment | null>(null);

  const [rows, setRows] = useState<Enrollment[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId((years.find((y) => y.isCurrent) ?? years[0]!).id);
  }, [years, yearId]);

  useEffect(() => {
    if (!yearId) return;

    let alive = true;
    setLoadingRefs(true);
    resetFilters();
    setSubjectId("");
    setOpenAssignment(null);

    listAssignments(yearId)
      .then((list) => alive && setAssignments(list))
      .catch(() => alive && setError("تعذّر جلب الإسنادات"))
      .finally(() => alive && setLoadingRefs(false));

    return () => {
      alive = false;
    };
  }, [yearId, resetFilters]);

  /** المواد وأفواجُها — بطاقةٌ لكلّ مادة */
  const subjects = useMemo(() => buildSubjectCards(visible), [visible]);

  const openSubject = subjects.find((s) => s.id === subjectId) ?? null;

  /*
   * عددُ طلبة كلّ فوجٍ من المادة — بطلبٍ واحد لا بطلبٍ لكلّ فوج.
   *
   * تُجلب تسجيلاتُ المادة كلِّها ثمّ تُعدّ في الذاكرة: خمسةُ أفواجٍ
   * كانت خمسةَ طلبات، وكلُّها على فهرسٍ واحد.
   */
  useEffect(() => {
    if (!subjectId || !yearId) return;

    let alive = true;

    listEnrollments({ subjectId, academicYearId: yearId, isActive: true, limit: 100 })
      .then(({ enrollments }) => {
        if (!alive) return;

        const tally: Record<string, number> = {};
        for (const row of enrollments) {
          tally[row.teachingAssignmentId] = (tally[row.teachingAssignmentId] ?? 0) + 1;
        }
        setCounts(tally);
      })
      .catch(() => alive && setCounts({}));

    return () => {
      alive = false;
    };
  }, [subjectId, yearId]);

  /* طلبةُ الفوج المفتوح */
  const loadGroup = useCallback(async () => {
    if (!openAssignment) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { enrollments } = await listEnrollments({
        teachingAssignmentId: openAssignment.id,
        limit: 100,
      });

      setRows(enrollments);
    } catch {
      setError("تعذّر جلب طلبة الفوج");
    } finally {
      setLoading(false);
    }
  }, [openAssignment]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  const remove = async (row: Enrollment) => {
    try {
      await deleteEnrollment(row.id);
      setRows((list) => list.filter((r) => r.id !== row.id));
      flash(`أُخرج ${fullName(row.student)} من الفوج`);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string } } }).response;
      setError(response?.data?.message ?? "تعذّر إخراج الطالب — قد تكون له فواتير أو حضور");
    }
  };

  const assign = async (student: Student) => {
    if (!openAssignment) return;

    try {
      await createEnrollment({
        studentId: student.id,
        teachingAssignmentIds: [openAssignment.id],
      });

      setAdding(false);
      flash(`أُسند ${fullName(student)} إلى ${openAssignment.studyGroup.name}`);
      await loadGroup();
    } catch (err: unknown) {
      const data = (
        err as { response?: { data?: { message?: string; errorCode?: string } } }
      ).response?.data;

      /*
       * التكرارُ يُقال بالعربية — ورسالةُ الخادم بعده لا قبله.
       *
       * النافذةُ تمنع ما تراه في الفوج المفتوح، والخادمُ يمنع ما لا
       * تراه: تسجيلاً معطَّلاً، أو نفسَ المادة عند أستاذٍ آخر، أو
       * مسحةً سبقتها مسحةٌ من جهازٍ ثانٍ. فإن ردّ بالتعارض قيل السبب
       * صريحاً بدل أن تُعرض جملةٌ إنجليزية لا يقرؤها من يُسجّل.
       */
      if (data?.errorCode === "ENROLLMENT_ALREADY_EXISTS") {
        throw new Error(
          `${fullName(student)} مسجَّلٌ في هذه المادة مسبقاً — لا يُسند مرّتين. ` +
            (data.message ?? ""),
          { cause: err },
        );
      }

      throw new Error(
        data?.message ?? "تعذّر إسناد الطالب — قد يكون مسجَّلاً في هذا الفوج",
        { cause: err },
      );
    }
  };

  const chips = useMemo<FilterChip[]>(() => {
    const out: FilterChip[] = [];
    const year = years.find((y) => y.id === yearId);

    if (year) out.push({ label: "السنة", value: year.name });
    if (openSubject) out.push({ label: "المادة", value: openSubject.name });
    if (openAssignment) out.push({ label: "الفوج", value: openAssignment.studyGroup.name });

    return out;
  }, [years, yearId, openSubject, openAssignment]);

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="إسناد الطلبة" subtitle="المادة · الفوج · طلبتُه">
        <button
          onClick={() => exitTo(PATHS.enrollments)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-350 p-6">
        <FilterPanel
          accent={ACCENT}
          storageKey="enrollments.assign"
          collapseKey={subjectId}
          busy={loadingRefs || loading}
          chips={chips}
          onReset={() => {
            resetFilters();
            setSubjectId("");
            setOpenAssignment(null);
          }}
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

        {error && (
          <p className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </span>
            <button onClick={() => setError(null)} aria-label="إغلاق">
              <X className="h-4 w-4" />
            </button>
          </p>
        )}

        {/* مسارُ العودة — يبقى ما قبل الطبقة ظاهراً */}
        {(openSubject || openAssignment) && (
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <Crumb
              label="المواد"
              accent={ACCENT}
              onClick={() => {
                setSubjectId("");
                setOpenAssignment(null);
              }}
            />

            {openSubject && (
              <>
                <ChevronLeft className="h-4 w-4 text-white/25" />
                <Crumb
                  label={openSubject.name}
                  accent={ACCENT}
                  active={!openAssignment}
                  onClick={() => setOpenAssignment(null)}
                />
              </>
            )}

            {openAssignment && (
              <>
                <ChevronLeft className="h-4 w-4 text-white/25" />
                <Crumb label={openAssignment.studyGroup.name} accent={ACCENT} active />
              </>
            )}
          </nav>
        )}

        {loadingRefs ? (
          <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[0.02] p-16 text-white/40">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : openAssignment ? (
          <GroupRoster
            assignment={openAssignment}
            rows={rows}
            loading={loading}
            canEdit={can("enrollment.create")}
            canRemove={can("enrollment.delete")}
            onAdd={() => setAdding(true)}
            onRemove={remove}
          />
        ) : openSubject ? (
          <GroupCards
            groups={openSubject.groups}
            counts={counts}
            accent={ACCENT}
            onOpen={(a) => {
              uiSound("navigate");
              setOpenAssignment(a);
            }}
          />
        ) : (
          <SubjectCards
            subjects={subjects}
            accent={ACCENT}
            emptyHint="وسّع المرشِّحات، أو أنشئ إسناداً في «الإسنادات التدريسية»."
            onOpen={(id) => {
              uiSound("navigate");
              setSubjectId(id);
            }}
          />
        )}
      </div>

      {adding && openAssignment && (
        <AssignDialog
          assignment={openAssignment}
          yearId={yearId}
          /* من هم فيه الآن — لمنع تكرارٍ قبل أن يُطلب من الخادم */
          enrolled={rows}
          onClose={() => setAdding(false)}
          onAssign={assign}
        />
      )}

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-2.5 text-sm font-bold text-emerald-100 backdrop-blur"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}

// --------------------------------------------------
// الطبقة الثالثة — طلبة الفوج
// --------------------------------------------------

function GroupRoster({
  assignment,
  rows,
  loading,
  canEdit,
  canRemove,
  onAdd,
  onRemove,
}: {
  assignment: Assignment;
  rows: Enrollment[];
  loading: boolean;
  canEdit: boolean;
  canRemove: boolean;
  onAdd: () => void;
  onRemove: (row: Enrollment) => void;
}) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [flashId, setFlashId] = useState<string | null>(null);

  /*
   * البحثُ في الفوج لا على الخادم: طلبتُه مئةٌ على الأكثر وهم في
   * الذاكرة أصلاً، فالتصفيةُ هنا فوريّةٌ بلا رحلة.
   */
  const shown = useMemo(() => {
    const n = name.trim();
    const num = number.trim();

    return rows.filter((row) => {
      const full = `${row.student.lastName} ${row.student.firstName}`;

      return (
        (!n || full.includes(n)) &&
        (!num || row.student.studentNumber.includes(num))
      );
    });
  }, [rows, name, number]);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="text-base font-black">{assignment.studyGroup.name}</h2>
          <p className="text-[11px] text-white/40">
            {assignment.subject.name} · {assignment.studyGroup.level.name} ·{" "}
            {fullName(assignment.teacher)} · {rows.length} طالباً
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <BarcodeScanner<Enrollment>
            accent={ACCENT}
            onFound={(row) => {
              /* المسحةُ تُبرز سطرَه في الفوج — فيُعرف أهو فيه أم لا */
              setNumber("");
              setName(`${row.student.lastName} ${row.student.firstName}`);
              setFlashId(row.id);
              window.setTimeout(() => setFlashId(null), 2400);
            }}
            copy={{
              button: "مسح بطاقة",
              buttonTitle: "ابحث عن طالبٍ في هذا الفوج بمسح بطاقته",
              title: "مسح رقم تسجيل الطالب",
              subtitle: "يُبرَز سطرُه في الفوج إن كان فيه",
              placeholder: "امسح باركود البطاقة، أو اكتب رقم التسجيل…",
              action: "ابحث في الفوج",
              notFound: "لا وجود لهذا الطالب في هذا الفوج — تحقّق من الرمز أو أسنِده.",
              hint: "الرقم مكتوبٌ تحت الباركود",
              steps: [
                <>
                  وجّه القارئ إلى{" "}
                  <span className="font-bold text-white/85">باركود بطاقة الطالب</span>.
                </>,
                <>القارئ يكتب الرقم في الحقل أدناه من نفسه ثمّ يُرسله.</>,
                <>يُبرَز سطرُه في القائمة — وإن لم يكن في الفوج قيل لك.</>,
              ],
            }}
            resolve={async (text) => {
              const code = text.trim();

              return rows.find((row) => row.student.studentNumber === code) ?? null;
            }}
          />

          {canEdit && (
            <button
              onClick={onAdd}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-[#04121c] transition hover:brightness-110"
              style={{ background: ACCENT }}
            >
              <UserPlus className="h-4 w-4" />
              إسناد طالب
            </button>
          )}
        </div>
      </header>

      {/* حقلا البحث — الاسمُ حروفاً والرقمُ خاناتٍ */}
      <div className="flex flex-wrap gap-3 border-b border-white/10 px-5 py-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="الاسم أو اللقب…"
            className="w-full rounded-xl border border-white/10 bg-black/25 py-2 pe-9 ps-10 text-sm outline-none transition focus:border-white/30"
          />
          {name && (
            <button
              onClick={() => setName("")}
              aria-label="امسح"
              className="absolute end-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="relative w-48">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            dir="ltr"
            style={{ textAlign: "start" }}
            placeholder="رقم التسجيل…"
            className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none transition focus:border-white/30"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center p-16 text-white/40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <Empty
          icon={Users}
          title={rows.length === 0 ? "لا طالبَ في هذا الفوج بعد" : "لا نتيجة للبحث"}
          hint={
            rows.length === 0
              ? "اضغط «إسناد طالب» لإدخال أوّل طالبٍ إليه."
              : "امسح حقلَي البحث لتعود القائمة كاملة."
          }
        />
      ) : (
        <ul className="divide-y divide-white/5">
          {shown.map((row) => {
            const student = row.student;
            const label = `${student.lastName} ${student.firstName}`;

            return (
              <li
                key={row.id}
                className="flex items-center gap-3 px-5 py-3 transition"
                style={
                  flashId === row.id ? { background: `${ACCENT}1f` } : undefined
                }
              >
                <Avatar src={student.avatar} name={label} gender={student.gender} size={36} />

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{label}</span>
                  <span className="block truncate text-[11px] text-white/40" dir="ltr">
                    {student.studentNumber}
                  </span>
                </span>

                {!row.isActive && (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/50">
                    معطّل
                  </span>
                )}

                {canRemove && (
                  <button
                    onClick={() => onRemove(row)}
                    title="إخراج من الفوج"
                    className="grid h-8 w-8 place-items-center rounded-lg text-white/35 transition hover:bg-rose-500/15 hover:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// --------------------------------------------------
// نافذة الإسناد
// --------------------------------------------------

/**
 * إسنادُ طالبٍ إلى الفوج المفتوح.
 *
 * حقلان لا حقل: الاسمُ يُكتب حروفاً والرقمُ خاناتٍ، وكلاهما يبحث في
 * المؤسسة كلِّها لا في الفوج — لأنّ المقصود إدخالُ من ليس فيه. ولا
 * يُسنَد إلّا بعد اختيارٍ صريحٍ من القائمة: زرُّ الإسناد يبقى مقفلاً
 * حتّى يُنتقى طالبٌ بعينه، فلا يُسنَد شبيهُ الاسم.
 */
function AssignDialog({
  assignment,
  yearId,
  enrolled,
  onClose,
  onAssign,
}: {
  assignment: Assignment;
  yearId: string;
  enrolled: Enrollment[];
  onClose: () => void;
  onAssign: (student: Student) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [picked, setPicked] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * أهو في الفوج أصلاً؟
   *
   * الخادمُ يمنع التكرار ويردّ بـ409 — لكنّه يردّ **بعد** الضغط
   * وبالإنجليزية. والقائمةُ في اليد، فيُعرف قبل الضغط ويُقال بلسانٍ
   * مفهوم: أنّه مُسنَدٌ من تاريخ كذا. فلا تُهدر رحلةٌ ولا تُقرأ رسالةٌ
   * غامضة.
   */
  const already = picked
    ? (enrolled.find((row) => row.student.id === picked.id) ?? null)
    : null;

  const pick = (student: Student) => {
    setPicked(student);
    setName(`${student.lastName} ${student.firstName}`);
    setNumber(student.studentNumber);
    setError(null);
  };

  const submit = async () => {
    if (!picked || busy || already) return;

    setBusy(true);
    setError(null);

    try {
      await onAssign(picked);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <MotionDialog
      onClose={onClose}
      labelledBy="assign-title"
      className="w-full max-w-125 overflow-visible rounded-2xl border border-white/12 bg-[#0a0f1a] text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
    >
      <header
        className="flex items-center gap-3 rounded-t-2xl px-6 py-4"
        style={{ background: `linear-gradient(120deg, ${ACCENT}22, transparent)` }}
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{ background: `${ACCENT}1f`, color: ACCENT }}
        >
          <UserPlus className="h-5 w-5" />
        </span>

        <div className="flex-1">
          <h3 id="assign-title" className="text-base font-black leading-tight">
            إسناد طالب
          </h3>
          <p className="text-[11px] text-white/45">
            {assignment.subject.name} · {assignment.studyGroup.name} ·{" "}
            {fullName(assignment.teacher)}
          </p>
        </div>

        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="grid h-8 w-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="space-y-4 px-6 py-5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-white/55">
            الاسم واللقب
          </span>
          <StudentPickerField
            mode="name"
            value={name}
            onChange={(text) => {
              setName(text);
              if (!text.trim()) setPicked(null);
            }}
            onPick={pick}
            scope={{ academicYearId: yearId, isActive: true }}
            placeholder="اكتب حرفاً أو حرفين من الاسم أو اللقب…"
            accent={ACCENT}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-white/55">
            رقم التسجيل
          </span>
          <StudentPickerField
            mode="number"
            value={number}
            onChange={(text) => {
              setNumber(text);
              if (!text.trim()) setPicked(null);
            }}
            onPick={pick}
            scope={{ academicYearId: yearId, isActive: true }}
            placeholder="2026000…"
            accent={ACCENT}
          />
        </label>

        {picked ? (
          <div
            className="flex items-center gap-3 rounded-xl border px-4 py-3"
            style={
              already
                ? { borderColor: "rgba(252,211,77,0.45)", background: "rgba(252,211,77,0.08)" }
                : { borderColor: `${ACCENT}44`, background: `${ACCENT}0f` }
            }
          >
            <Avatar
              src={picked.avatar}
              name={`${picked.lastName} ${picked.firstName}`}
              gender={picked.gender}
              size={38}
            />
            <span className="flex-1">
              <span className="block font-bold">
                {picked.lastName} {picked.firstName}
              </span>
              <span className="block font-mono text-[11px] text-white/45" dir="ltr">
                {picked.studentNumber}
              </span>

              {already && (
                <span className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  مُسنَدٌ إلى هذا الفوج مسبقاً — منذ{" "}
                  {new Date(already.enrolledAt).toLocaleDateString("fr-DZ")}
                </span>
              )}
            </span>
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[11px] leading-relaxed text-white/40">
            اكتب في أحد الحقلين ثمّ اختر الطالب من القائمة — لا يُسنَد إلّا من
            اختير بعينه.
          </p>
        )}

        {error && (
          <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </p>
        )}
      </div>

      <footer className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
        <button
          onClick={submit}
          disabled={!picked || busy || Boolean(already)}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-[#04121c] transition hover:brightness-110 disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {already ? "مُسنَدٌ مسبقاً" : "إسناد الطالب"}
        </button>

        <button
          onClick={onClose}
          className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold transition hover:bg-white/20"
        >
          إلغاء الأمر
        </button>
      </footer>
    </MotionDialog>
  );
}
