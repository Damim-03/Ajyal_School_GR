import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CalendarClock,
  ChevronLeft,
  Check,
  Info,
  Loader2,
  Search,
  TriangleAlert,
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
import { useAuthStore } from "../../core/stores/auth.store";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";
import { useAssignmentFilters } from "./assignment-filters";
import { Crumb, Empty, GroupCards, SubjectCards } from "./layers";
import { buildSubjectCards } from "./subject-groups";
import {
  fullName,
  listAssignments,
  listEnrollments,
  transferEnrollment,
  type Assignment,
  type Enrollment,
} from "./enrollments.api";

const ACCENT = "#c4b5fd";

/**
 * نقل الطالب بين الأفواج — بالطبقات الثلاث نفسها التي يُسنَد بها.
 *
 * كانت تبدأ من **الطالب**: قائمةٌ بكلّ طلبة المؤسسة إلى اليمين، تُبحث
 * بالاسم وحده، ثمّ تُعرض موادُّه لتُختار منها مادة. وهو عكسُ ما يقع
 * في المكتب: المشكلةُ تُكتشف في الفوج لا في الطالب — «هؤلاء الخمسة
 * في فوج الاثنين وموعدُهم الأربعاء» — فيُفتح الفوجُ ويُنقل من فيه.
 *
 * فصارت: **مادةٌ ← فوجٌ ← طلبتُه ← انقل**. وهي طريقُ شاشة الإسناد
 * حرفاً بحرف، لأنّ اليد التي تُسند هي التي تُصحّح؛ ويدٌ واحدةٌ لا
 * تتعلّم طريقين لنفس الشجرة.
 *
 * وتبقى قاعدةُ النقل كما هي: الوجهاتُ من **نفس المادة** فقط. تغييرُ
 * المادة ليس نقلاً بل إلغاءٌ وإسنادٌ جديد — والخادم يرفضه صراحةً.
 */
export default function TransferPage() {
  const exitTo = useScreenExit();
  const can = useAuthStore((s) => s.hasPermission);

  const yearsQuery = useAcademicYears();
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const [yearId, setYearId] = useState("");

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  const {
    filters,
    setFilter,
    reset: resetFilters,
    options,
    visible,
  } = useAssignmentFilters(assignments);

  /** الطبقة المفتوحة: مادةٌ ثمّ فوج — وفراغُهما يعني قائمة المواد */
  const [subjectId, setSubjectId] = useState("");
  const [openAssignment, setOpenAssignment] = useState<Assignment | null>(null);

  const [rows, setRows] = useState<Enrollment[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [moving, setMoving] = useState<Enrollment | null>(null);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
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

  /* عددُ طلبة كلّ فوجٍ من المادة — بطلبٍ واحد لا بطلبٍ لكلّ فوج */
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

  /**
   * وجهاتُ النقل من الفوج المفتوح: نفس المادة، موضعٌ آخر.
   *
   * تُحسب من `assignments` كلِّها لا من `visible`: المرشِّحاتُ تُضيّق
   * ما يُعرض من أفواج، ولا يصحّ أن تُضيّق ما يُنقَل إليه. فمن رشّح
   * بالأستاذ ليصل إلى فوجه لا يقصد أن يمنع النقل إلى أستاذٍ سواه.
   */
  const targets = useMemo(
    () =>
      openAssignment
        ? assignments.filter(
            (a) =>
              a.subject.id === openAssignment.subject.id && a.id !== openAssignment.id,
          )
        : [],
    [assignments, openAssignment],
  );

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
      <AppHeader title="نقل بين الأفواج" subtitle="المادة · الفوج · من يُنقَل منه">
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
          storageKey="enrollments.transfer"
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

        <p className="mb-4 flex items-start gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-2.5 text-[11px] leading-relaxed text-white/40">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          النقل يُبقي المادة ويغيّر الفوج أو الأستاذ — والقديم يُعطَّل بفواتيره
          وحضوره ولا يُمحى.
        </p>

        {error && (
          <p className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span className="flex items-start gap-2 whitespace-pre-line leading-relaxed">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </span>
            <button onClick={() => setError(null)} aria-label="إغلاق">
              <X className="h-4 w-4 shrink-0" />
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
            targetCount={targets.length}
            loading={loading}
            canMove={can("enrollment.update")}
            onMove={setMoving}
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
            emptyHint="وسّع المرشِّحات — النقل يحتاج مادةً لها فوجان على الأقلّ."
            onOpen={(id) => {
              uiSound("navigate");
              setSubjectId(id);
            }}
          />
        )}
      </div>

      {moving && (
        <TransferDialog
          row={moving}
          targets={targets}
          counts={counts}
          onClose={() => setMoving(null)}
          onDone={async (message) => {
            setMoving(null);
            await loadGroup();
            flash(message);
          }}
        />
      )}

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-violet-400/30 bg-violet-500/15 px-5 py-2.5 text-center text-sm font-bold text-violet-100 backdrop-blur"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}

// --------------------------------------------------
// الطبقة الثالثة — من يُنقَل من هذا الفوج
// --------------------------------------------------

function GroupRoster({
  assignment,
  rows,
  targetCount,
  loading,
  canMove,
  onMove,
}: {
  assignment: Assignment;
  rows: Enrollment[];
  /** كم فوجاً آخر يدرّس هذه المادة — صفرٌ يعني لا نقلَ منها */
  targetCount: number;
  loading: boolean;
  canMove: boolean;
  onMove: (row: Enrollment) => void;
}) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [flashId, setFlashId] = useState<string | null>(null);

  /* البحثُ في الفوج لا على الخادم: طلبتُه في الذاكرة أصلاً */
  const shown = useMemo(() => {
    const n = name.trim();
    const num = number.trim();

    return rows.filter((row) => {
      const full = `${row.student.lastName} ${row.student.firstName}`;

      return (!n || full.includes(n)) && (!num || row.student.studentNumber.includes(num));
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
          {/* كم وجهةً أمام هذا الفوج — يُقال قبل أن يُضغط «انقل» فيُقفل */}
          <span
            className="rounded-full px-3 py-1.5 text-[11px] font-bold"
            style={
              targetCount === 0
                ? { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }
                : { background: `${ACCENT}1a`, color: ACCENT }
            }
          >
            {targetCount === 0
              ? "لا فوجَ آخر يدرّس هذه المادة"
              : `${targetCount} ${targetCount === 1 ? "وجهة" : "وجهات"} للنقل`}
          </span>

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
              notFound:
                "لا وجود لهذا الطالب في هذا الفوج — افتح الفوج الذي هو فيه لتنقله منه.",
              hint: "الرقم مكتوبٌ تحت الباركود",
              steps: [
                <>
                  وجّه القارئ إلى{" "}
                  <span className="font-bold text-white/85">باركود بطاقة الطالب</span>.
                </>,
                <>القارئ يكتب الرقم في الحقل أدناه من نفسه ثمّ يُرسله.</>,
                <>يُبرَز سطرُه في القائمة — ومنه يُضغط «انقل».</>,
              ],
            }}
            resolve={async (text) => {
              const code = text.trim();

              return rows.find((row) => row.student.studentNumber === code) ?? null;
            }}
          />
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
          title={rows.length === 0 ? "لا طالبَ في هذا الفوج" : "لا نتيجة للبحث"}
          hint={
            rows.length === 0
              ? "أسنِد إليه طلبةً من شاشة «إسناد طالب» أوّلاً."
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
                style={flashId === row.id ? { background: `${ACCENT}1f` } : undefined}
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

                {canMove && (
                  <button
                    onClick={() => onMove(row)}
                    disabled={targetCount === 0 || !row.isActive}
                    title={
                      !row.isActive
                        ? "إسنادٌ معطَّل — لا يُنقل"
                        : targetCount === 0
                          ? "لا فوج آخر يدرّس هذه المادة"
                          : "نقل إلى فوجٍ آخر"
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black text-[#160a2e] transition hover:brightness-110 disabled:opacity-30"
                    style={{ background: ACCENT }}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    انقل
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
// نافذة النقل
// --------------------------------------------------

/**
 * اختيارُ الوجهة — قائمةٌ تُنقَر لا قائمةٌ تُفتح.
 *
 * كانت `select`: الوجهةُ سطرٌ واحدٌ مضغوطٌ فيه المستوى والفوج
 * والأستاذ، ولا يُرى إلّا واحدٌ في كلّ لحظة. والنقلُ قرارٌ يُقارَن —
 * «أيّ الفوجين موعدُه يناسبه؟» — فالمقارنةُ تحتاج أن يُرى الجميع
 * معاً، ومعهم عددُ من فيهم: فوجٌ ممتلئٌ ليس وجهةً وإن كان مسموحاً.
 */
function TransferDialog({
  row,
  targets,
  counts,
  onClose,
  onDone,
}: {
  row: Enrollment;
  targets: Assignment[];
  counts: Record<string, number>;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * متى يسري النقل — والتأجيلُ هو المُوصى به.
   *
   * النقلُ في منتصف الكشف يُجزّئ الشهر بين فوجين، ومجموعُ حصصه فيهما
   * يتجاوز سقفَ الشهر حين يتداخل التقويمان: خمسٌ هنا وخمسٌ هناك في
   * شهرٍ سقفُه ثمان. والتأجيلُ يُلغي الحساب بدل أن يُصلحه — يُكمل
   * شهره حيث هو، ويبدأ الجديدَ من عموده الأوّل.
   */
  const [defer, setDefer] = useState(true);

  const target = useMemo(
    () => targets.find((t) => t.id === targetId) ?? null,
    [targets, targetId],
  );

  const submit = async () => {
    if (!target || busy) return;

    setBusy(true);
    setError(null);

    try {
      const result = await transferEnrollment(row.id, target.id, defer);

      onDone(
        result.pending
          ? `سيُنقل ${fullName(row.student)} إلى ${target.studyGroup.name} ` +
              `عند فتح كشفٍ جديد لـ${row.teachingAssignment.studyGroup.name} ` +
              "— ويبقى في فوجه إلى ذلك الحين"
          : `نُقل ${fullName(row.student)} في ${row.teachingAssignment.subject.name}: ` +
              `${result.from.studyGroup} ← ${target.studyGroup.name}` +
              (result.revived ? " (أُحيي إسنادٌ سابق)" : ""),
      );
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string } } }).response?.data;
      setError(data?.message ?? "تعذّر النقل");
    } finally {
      setBusy(false);
    }
  };

  const student = row.student;
  const label = `${student.lastName} ${student.firstName}`;

  return (
    <MotionDialog
      onClose={onClose}
      labelledBy="transfer-title"
      className="w-full max-w-135 overflow-hidden rounded-2xl border border-white/12 bg-[#0a0f1a] text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
    >
      <header
        className="flex items-center gap-3 px-6 py-4"
        style={{ background: `linear-gradient(120deg, ${ACCENT}22, transparent)` }}
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{ background: `${ACCENT}1f`, color: ACCENT }}
        >
          <ArrowRightLeft className="h-5 w-5" />
        </span>

        <div className="flex-1">
          <h3 id="transfer-title" className="text-base font-black leading-tight">
            نقل بين الأفواج
          </h3>
          <p className="text-[11px] text-white/45">
            {label} · {row.teachingAssignment.subject.name}
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
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3.5">
          <Avatar src={student.avatar} name={label} gender={student.gender} size={38} />

          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] text-white/40">من</p>
            <p className="truncate text-sm font-black">
              {row.teachingAssignment.studyGroup.name}
            </p>
            <p className="truncate text-[11px] text-white/40">
              {fullName(row.teachingAssignment.teacher)}
            </p>
          </div>

          <ArrowLeft className="h-5 w-5 shrink-0" style={{ color: ACCENT }} />

          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] text-white/40">إلى</p>
            <p
              className="truncate text-sm font-black"
              style={{ color: target ? ACCENT : undefined }}
            >
              {target ? target.studyGroup.name : "—"}
            </p>
            <p className="truncate text-[11px] text-white/40">
              {target ? fullName(target.teacher) : "اختر الوجهة"}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold text-white/55">الفوج الجديد</p>

          <ul className="max-h-64 space-y-2 overflow-y-auto pe-1">
            {targets.map((t) => {
              const picked = t.id === targetId;

              return (
                <li key={t.id}>
                  <button
                    onClick={() => setTargetId(t.id)}
                    className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-start transition"
                    style={
                      picked
                        ? { borderColor: `${ACCENT}66`, background: `${ACCENT}14` }
                        : { borderColor: "rgba(255,255,255,0.1)" }
                    }
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                      style={{ background: `${ACCENT}1a`, color: ACCENT }}
                    >
                      <Users className="h-4.5 w-4.5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {t.studyGroup.name}
                      </span>
                      <span className="block truncate text-[11px] text-white/40">
                        {t.studyGroup.level.name} · {fullName(t.teacher)}
                      </span>
                    </span>

                    <span className="shrink-0 text-[11px] font-bold text-white/45">
                      {counts[t.id] ?? 0} طالباً
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ============ متى يسري ============ */}
        <div>
          <p className="mb-2 text-xs font-bold text-white/55">متى يسري النقل</p>

          <Timing
            on={defer}
            onPick={() => setDefer(true)}
            title="عند انتهاء الكشف الجاري"
            badge="موصى به"
            desc="يُكمل الطالب شهره في فوجه الحالي ويُفوتَر كاملاً هناك، ثمّ يُنقل من نفسه حين يُفتح الكشف التالي — فلا يُقسَّم شهرٌ بين فوجين."
          />

          <Timing
            on={!defer}
            onPick={() => setDefer(false)}
            title="الآن — فوراً"
            desc="يخرج من فوجه اليوم ويدخل الجديد. وشهرُه يُقسَّم بين الفوجين، فيحتاج مراجعةَ الفاتورة والتخليص."
            warn
          />
        </div>

        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-white/35">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          الإسناد القديم يُعطَّل ولا يُحذف: فواتيره وحضورُه تبقى معلَّقةً به، فلا
          يضيع تاريخ الطالب في الفوج الذي غادره.
        </p>

        {error && (
          <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs leading-relaxed text-rose-200">
            {error}
          </p>
        )}
      </div>

      <footer className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
        <button
          onClick={submit}
          disabled={!target || busy}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-[#160a2e] transition hover:brightness-110 disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : defer ? (
            <CalendarClock className="h-4 w-4" />
          ) : (
            <ArrowRightLeft className="h-4 w-4" />
          )}
          {defer ? "سجّل النقل المؤجَّل" : "انقل الطالب الآن"}
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

/** خيارُ توقيتٍ — بطاقةٌ تُنقر لا زرُّ راديو صغير */
function Timing({
  on,
  onPick,
  title,
  badge,
  desc,
  warn = false,
}: {
  on: boolean;
  onPick: () => void;
  title: string;
  badge?: string;
  desc: string;
  warn?: boolean;
}) {
  const tone = warn ? "#fbbf24" : ACCENT;

  return (
    <button
      onClick={onPick}
      className="mb-2 flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-start transition"
      style={
        on
          ? { borderColor: `${tone}66`, background: `${tone}14` }
          : { borderColor: "rgba(255,255,255,0.1)" }
      }
    >
      <span
        className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border"
        style={on ? { borderColor: tone, background: tone } : { borderColor: "rgba(255,255,255,0.25)" }}
      >
        {on && <Check className="h-3 w-3 text-[#04121c]" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-bold">
          {title}
          {badge && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-black"
              style={{ background: `${tone}26`, color: tone }}
            >
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-white/45">{desc}</span>
      </span>
    </button>
  );
}
