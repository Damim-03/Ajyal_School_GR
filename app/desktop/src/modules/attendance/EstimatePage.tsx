import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BadgeDollarSign,
  CircleCheckBig,
  ClipboardCheck,
  ClipboardList,
  Info,
  Printer,
  RefreshCw,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { logoSpec, type LogoSpec } from "../../components/print/logo";
import { usePagedFlow, type PrintBlock } from "../../components/print/paged-flow";
import { printedStamp } from "../../components/print/printed-at";
import { PrintSignature } from "../../components/print/PrintSignature";
import { SheetBarcode } from "../../components/print/SheetBarcode";
import { SheetPreview } from "../../components/print/SheetPreview";
import {
  FilterField,
  FilterPanel,
  FilterSelect,
  type FilterChip,
} from "../../components/shared/FilterPanel";
import { SearchBox } from "../../components/shared/SearchBox";
import { matchesQuery } from "../../lib/search";
import { SettlePayment } from "./components/settle-payment";
import {
  listDebtShares,
  listSettlements,
  SETTLEMENT_STATUS_LABEL,
  type DebtShare,
  type SettlementRow,
} from "../finance/teacher-payments.api";
import { SheetScanner } from "./components/sheet-scan";
import { useSheetJump } from "./hooks/use-sheet-jump";
import { useAcademicYears } from "../../core/api/reference.api";
import { useAuthStore } from "../../core/stores/auth.store";
import { useSchool, useSchoolStore } from "../../core/stores/school.store";
import { PATHS } from "../../routes/paths";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useScreenExit } from "../../lib/screen-transition";
import { money } from "../finance/finance.api";
import {
  BASIS_LABEL,
  METHOD_LABEL,
  bucketByAttendance,
  getEstimate,
  pendingTeacherShare,
  policyValue,
  type BucketSummary,
  type Estimate,
} from "../finance/settlements.api";
import {
  deriveOptions,
  filterSummary,
  fullName,
  getSheet,
  listAssignments,
  listSheets,
  resolveAssignment,
  sheetCode,
  sheetTitle,
  type Assignment,
  type Sheet,
  type SheetFilters,
} from "./attendance.api";
import { feeDate } from "./fees";

const ACCENT = "#93c5fd";

/**
 * خطوط الجدول — أفقيةٌ ورأسية.
 *
 * الأفقية وحدها لا تكفي في جدولٍ خمسةُ أعمدةٍ عريضة: العين تنزلق بين
 * «قيمة الوحدة» و«المجموع» فتُقرأ قيمةُ صفٍّ في عمود غيره. والخطوط
 * خافتةٌ عمداً — تفصل ولا تُشوّش.
 */
const headCell = "border-white/10 px-4 py-3 text-center font-bold";
const bodyCell = "border-white/5 px-4 py-2.5";

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
 * الكشف التقديري للحصص — §16.
 *
 * يجيب عن سؤالين في ورقةٍ واحدة، وهما سؤالان لا واحد:
 *
 *   • كم يستحقّ الأستاذ عن هذا الكشف؟
 *   • ومَن من الطلبة لم يدفع بعد؟
 *
 * وجمعُهما مقصود. الأستاذ يُخلَّص في وقته سواء دفع الطلبة أم لا — لن
 * ينتظر راتبه حتى يسدّد آخرُ متأخّر. فما لم يُدفع يبقى **ديناً على
 * الطالب** لا خصماً من الأستاذ (§2)، ويُسمّى صاحبُه **مخلَّفاً** حتى
 * يسدّد. وحين يسدّد يُطفأ الدين من نفسه: مصدرُه `Invoice.remaining`،
 * فالدفعة تُنقصه ولا تحتاج خطوةً ثانية تُنسى.
 *
 * والحسابات كلّها من الخادم — لا رقم يُدخله المستخدم هنا (§18).
 */
export default function EstimatePage() {
  const exitTo = useScreenExit();
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.hasPermission);
  const schoolName = useSchool("school.name_ar");
  const currency = useSchoolStore((s) => s.settings["school.currency"] ?? "دج");
  const logo = logoSpec(useSchoolStore((s) => s.settings));

  const yearsQuery = useAcademicYears();
  const years = yearsQuery.data ?? [];
  const [yearId, setYearId] = useState("");

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filters, setFilters] = useState<SheetFilters>(EMPTY_FILTERS);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetId, setSheetId] = useState("");

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  /** بحثٌ في جدول الطلبة — عرضٌ لا حذف: المجاميع والورقة على الكشف كلِّه */
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  /** نافذة إثبات الدفع — خطوتان: المال ثمّ الورقة الموقَّعة */
  const [settling, setSettling] = useState(false);
  const [toast, setToast] = useState<string | null>(null);



  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId((years.find((y) => y.isCurrent) ?? years[0]).id);
  }, [years, yearId]);

  useEffect(() => {
    if (!yearId) return;
    let alive = true;
    setFilters(EMPTY_FILTERS);

    listAssignments(yearId)
      .then((rows) => alive && setAssignments(rows))
      .catch((err) => alive && setError(err?.response?.data?.message ?? "تعذّر جلب الإسنادات"));

    return () => { alive = false; };
  }, [yearId]);

  const options = useMemo(() => deriveOptions(assignments, filters), [assignments, filters]);
  const assignment = useMemo(() => resolveAssignment(assignments, filters), [assignments, filters]);

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

  /**
   * تخليصُ هذا الكشف إن وُجد — به يُعرف هل دُفع.
   *
   * الكشف يُدفع مرّةً واحدة: ما دُفع يُقرأ في الأرشيف، والكشف التالي
   * يُدفع حين يمتلئ. فلا يُعرض «إثبات الدفع» على ورقةٍ سُدّدت.
   */
  const [settlement, setSettlement] = useState<SettlementRow | null>(null);

  /**
   * نصيبُ الأستاذ المؤجَّل من كشوفٍ سابقة **لهذا الإسناد**.
   *
   * لا تُصنع هذه السطور بالدمج ولا بالتقدير: كلُّ سطرٍ منها **واقعةُ
   * قبضٍ حقيقية** — طالبٌ مخلَّفٌ سدَّد بدفعةٍ لها رقمٌ وتاريخ، فنشأت
   * حصةُ أستاذه لحظتَها. فما لم يُثبَت الدفع لا يظهر هنا شيء.
   *
   * والقصرُ على الإسناد مقصود: الأستاذ يدرّس أفواجاً، وورقةُ كلِّ فوجٍ
   * تُقرأ وحدها. فمتأخّرات الفوج 2 تظهر في كشوف الفوج 2 — وظهورُها على
   * ورقة الفوج 1 يخلط الحسابين ويجعل مجموع الورقة غير مجموع فوجها.
   */
  const [arrears, setArrears] = useState<DebtShare[]>([]);

  /**
   * وما دُفع **مع هذا الكشف** من متأخّرات.
   *
   * المعلَّق يختفي بمجرّد دفعه — وهو الصواب — لكنّ الورقة التي حملته
   * تصير كأنّها لم تحمله. فيُقرأ هنا بحالته: «دُفعت مع هذا الكشف»،
   * فيُعرف أين ذهبت ولا تُظنّ ضائعة.
   */
  const [settledArrears, setSettledArrears] = useState<DebtShare[]>([]);

  const loadArrears = useCallback(async () => {
    if (!assignment) {
      setArrears([]);
      setSettledArrears([]);
      return;
    }

    try {
      const { shares } = await listDebtShares({
        teachingAssignmentId: assignment.id,
        status: "PENDING",
      });

      setArrears(shares);
    } catch {
      setArrears([]);
    }

    if (!settlement) {
      setSettledArrears([]);
      return;
    }

    try {
      const { shares } = await listDebtShares({
        collectionSettlementId: settlement.id,
        status: "PAID",
      });

      setSettledArrears(shares);
    } catch {
      setSettledArrears([]);
    }
  }, [assignment, settlement]);

  useEffect(() => {
    loadArrears();
  }, [loadArrears]);

  const arrearsTotal = useMemo(
    () => arrears.reduce((sum, share) => sum + share.shareAmount, 0),
    [arrears],
  );

  const settledArrearsTotal = useMemo(
    () => settledArrears.reduce((sum, share) => sum + share.shareAmount, 0),
    [settledArrears],
  );

  /*
   * ما يُطبع في الورقة: ما ستحمله إن لم تُدفع بعد، وما حملته إن دُفعت.
   * فالنسخة المُعاد طبعها من الأرشيف تطابق التي وُقّعت.
   */
  const printedArrears = settlement?.status === "PAID" ? settledArrears : arrears;

  const loadSettlement = useCallback(async () => {
    if (!assignment || !sheetId) {
      setSettlement(null);
      return;
    }

    try {
      const { settlements } = await listSettlements({
        teachingAssignmentId: assignment.id,
        attendanceSheetId: sheetId,
      });

      /* الملغى لا يُعتدّ به — البديل يأخذ مكانه */
      setSettlement(settlements.find((row) => row.status !== "CANCELLED") ?? null);
    } catch {
      setSettlement(null);
    }
  }, [assignment, sheetId]);

  useEffect(() => {
    loadSettlement();
  }, [loadSettlement]);

  /* المسح ينقل الشاشة إلى كشفٍ آخر — انظر `use-sheet-jump` */
  const { jumpTo, jumping } = useSheetJump({
    assignments,
    sheets,
    setYearId,
    setFilters,
    setSheetId,
  });

  // --------------------------------------------------
  // القدوم من كشف الحقوق — `?y=سنة&a=إسناد&s=كشف`
  //
  // الورقتان وجهان لكشفٍ واحد، والانتقال بينهما كان يعني إعادةَ اختيار
  // خمسة مرشِّحات. والرابط يحمل الكشف، فيُجلب ويُسلَّم إلى `useSheetJump`
  // — نفسِ الطريق الذي يسلكه الباركود الممسوح.
  //
  // ويُستهلَك بعد تطبيقه (`replace`) فلا يفرض نفسه على اختيارٍ لاحق ولا
  // يعود بالضغط على «رجوع».
  // --------------------------------------------------

  const [params, setParams] = useSearchParams();
  const linkSheet = params.get("s");

  useEffect(() => {
    if (!linkSheet) return;

    let alive = true;

    getSheet(linkSheet)
      .then((row) => {
        if (!alive) return;
        jumpTo(row);
        setParams({}, { replace: true });
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [linkSheet, jumpTo, setParams]);

  useEffect(() => {
    /* الفوجُ تبدّل، فبحثُ الفوج السابق لا معنى له في جدولٍ آخر */
    setSearch("");

    if (!assignment) {
      setSheets([]);
      setSheetId("");
      return;
    }

    let alive = true;

    listSheets(assignment.id)
      .then((rows) => {
        if (!alive) return;
        setSheets(rows);
        setSheetId(rows.length > 0 ? rows[rows.length - 1].id : "");
      })
      .catch(() => {});

    return () => { alive = false; };
  }, [assignment]);

  const load = useCallback(async () => {
    if (!assignment || !sheetId) {
      setEstimate(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setEstimate(
        await getEstimate({
          teachingAssignmentId: assignment.id,
          attendanceSheetId: sheetId,
        }),
      );
    } catch (err: any) {
      setEstimate(null);
      /* الخادم يشرح السبب: لا سياسة، أو لا سعر، أو لا حصة منجزة */
      setError(err?.response?.data?.message ?? "تعذّر حساب الكشف");
    } finally {
      setLoading(false);
    }
  }, [assignment, sheetId]);

  useEffect(() => { load(); }, [load]);

  const t = estimate?.totals;

  /**
   * التجميع بعدد الحصص — قراءة الورقة اليدوية للكشف نفسه.
   *
   * لا طلبَ ثانياً للخادم: المعطيات كلُّها في `estimate.students`
   * (حضورُ كلِّ طالبٍ وحالتُه المالية)، والتجميع إعادةُ ترتيبٍ لها.
   */
  const buckets = useMemo(
    () => (estimate ? bucketByAttendance(estimate) : null),
    [estimate],
  );

  /** ما يُقرأ قبل إهدار ورقة */
  const printWarning = useMemo(() => {
    if (!t) return null;

    const parts: string[] = [];

    if (t.missingSessions > 0)
      parts.push(`${t.missingSessions} حصة لم تُنجز بعد من ${t.approvedSessions}`);
    if (t.uninvoiced > 0)
      parts.push(`${t.uninvoiced} طالباً بلا فاتورة — ولّد فواتير الشهر أولاً`);

    return parts.length > 0
      ? `الكشف غير مكتمل: ${parts.join("، ")}. المبلغ المحسوب يعكس ما أُنجز فقط.`
      : null;
  }, [t]);

  /** ما يبقى مقروءاً حين يُطوى لوح المرشِّحات */
  const chips = useMemo<FilterChip[]>(() => {
    const year = years.find((y) => y.id === yearId);
    const sheet = sheets.find((s) => s.id === sheetId);

    return [
      ...(year ? [{ label: "السنة", value: year.name }] : []),
      ...filterSummary(options, filters),
      ...(sheet ? [{ label: "الكشف", value: sheetTitle(sheet) }] : []),
    ];
  }, [years, yearId, options, filters, sheets, sheetId]);

  /**
   * صفوفُ جدول الطلبة — مصفّاةً بالبحث ومحتفظةً بترتيبها.
   *
   * والمجاميع في ذيل الجدول تبقى على `estimate.totals`: هي مستحقُّ
   * الأستاذ ودَينُ الفوج، ولا معنى لجمعها على نتيجة بحث.
   */
  const visibleStudents = useMemo(
    () =>
      (estimate?.students ?? [])
        .map((student, index) => ({ student, order: index + 1 }))
        .filter((row) => matchesQuery(`${row.student.lastName} ${row.student.firstName}`, search)),
    [estimate, search],
  );

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="الكشف التقديري للحصص" subtitle="مستحقّ الأستاذ · ديون الطلبة">
        <button
          onClick={() => exitTo(PATHS.attendance)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-[1500px] p-6">
        {/* ============ المرشِّحات ============ */}
        <FilterPanel
          accent={ACCENT}
          storageKey="attendance.estimate"
          collapseKey={assignment?.id ?? ""}
          busy={loading}
          chips={chips}
          extra={
            <SheetScanner sheets={sheets} onFound={jumpTo} busy={jumping} accent={ACCENT} />
          }
          onReset={() => setFilters(EMPTY_FILTERS)}
        >
          <FilterField label="السنة الدراسية">
            <FilterSelect value={yearId} onChange={setYearId} items={years} accent={ACCENT} />
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
              placeholder="اختر المادة"
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="الأستاذ">
            <FilterSelect
              value={filters.teacherId}
              onChange={(v) => setFilter("teacherId", v)}
              items={options.teachers.map((x) => ({ id: x.id, name: fullName(x) }))}
              placeholder="اختر الأستاذ"
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="الفوج">
            <FilterSelect
              value={filters.groupId}
              onChange={(v) => setFilter("groupId", v)}
              items={options.groups}
              placeholder="اختر الفوج"
              accent={ACCENT}
            />
          </FilterField>

          {assignment && (
            <FilterField label="الكشف">
              <FilterSelect
                value={sheetId}
                onChange={setSheetId}
                items={sheets.map((s) => ({ id: s.id, name: sheetTitle(s) }))}
                placeholder={sheets.length === 0 ? "لا كشوف بعد" : undefined}
                disabled={sheets.length === 0}
                accent={ACCENT}
              />
            </FilterField>
          )}
        </FilterPanel>

        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span className="whitespace-pre-line leading-relaxed">{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        )}

        {!assignment ? (
          <Empty
            title="اختر المادة والأستاذ والفوج"
            hint="الكشف يُحسب على إسنادٍ تدريسي وكشفِ حضورٍ بعينه — منهما تأتي الحصص والطلبة والحقوق."
          />
        ) : !estimate ? (
          !loading && !error && (
            <Empty title="لا كشف محسوب" hint="اختر كشف حضورٍ من القائمة." />
          )
        ) : (
          <>
            {/* ============ الترويسة ============ */}
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-2.5 text-sm">
                <Meta label="المؤسسة" value={schoolName} strong />
                <Meta label="المادة" value={estimate.header.subject.name} strong />
                <Meta label="الأستاذ" value={fullName(estimate.header.teacher)} />
                <Meta label="المستوى" value={estimate.header.level.name} />
                <Meta label="الفوج" value={estimate.header.studyGroup.name} />
                <Meta
                  label="المدى"
                  value={
                    estimate.header.dateFrom
                      ? `${feeDate(estimate.header.dateFrom)} — ${feeDate(estimate.header.dateTo)}`
                      : "—"
                  }
                />
              </div>

              {/* السياسة المعتمدة — تُقرأ لأنّ المبلغ يتبعها */}
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-xs">
                <Wallet className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                <span className="text-white/50">السياسة</span>
                <span className="font-black">{estimate.policy.name}</span>
                <span className="rounded-full bg-white/8 px-2.5 py-1 font-bold">
                  {METHOD_LABEL[estimate.policy.method]}
                </span>
                <span className="rounded-full px-2.5 py-1 font-bold" style={{ background: `${ACCENT}1f`, color: ACCENT }}>
                  {policyValue(estimate.policy)}
                </span>
                <span className="text-white/50">
                  أساس العدّ: <span className="font-bold text-white/75">{BASIS_LABEL[estimate.policy.countBasis]}</span>
                </span>
                <span className="text-white/50">
                  الحقّ الشهري: <span className="font-bold text-white/75">{money(estimate.tuition, currency)}</span>
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="الحصص المنجزة" value={`${t!.completedSessions} / ${t!.approvedSessions}`} tone={t!.missingSessions > 0 ? "#fcd34d" : "#86efac"} />
                <Stat label="الطلبة المسجَّلون" value={String(t!.enrolledStudents)} tone="#cbd5e1" />
                <Stat label="المخلَّفون" value={String(t!.defaulters)} tone={t!.defaulters > 0 ? "#fda4af" : "#86efac"} />
                <Stat label="مستحقّ الأستاذ" value={money(t!.teacherAmount, currency)} tone={ACCENT} strong />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Stat label="إجمالي الحقوق" value={money(t!.grossTuition, currency)} tone="#cbd5e1" />
                <Stat label="المحصَّل" value={money(t!.collected, currency)} tone="#86efac" />
                <Stat label="الديون المتبقّية" value={money(t!.remaining, currency)} tone={t!.remaining > 0 ? "#fda4af" : "#86efac"} />
              </div>

              {printWarning && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-xs leading-relaxed text-amber-200">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {printWarning}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <button
                  onClick={load}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-white/10"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  تحديث
                </button>

                <button
                  onClick={() => setPreviewing(true)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-white/10"
                >
                  <Printer className="h-4 w-4" />
                  معاينة وطباعة
                </button>

                {/*
                  الجسران إلى وجهَي هذا الكشف نفسه.

                  الأوراق الثلاث ورقةٌ واحدة تُقرأ من ثلاث جهات: اليوميةُ
                  تقول مَن حضر، والحقوقُ تقول مَن سدَّد، وهذه تقول كم
                  يستحقّ الأستاذ ممّا سُدّد. والانتقال كان يعني إعادةَ
                  اختيار خمسة مرشِّحاتٍ ثمّ البحث عن رقم الكشف — فالرابط
                  يحمل السنة والإسناد والكشف، وتفتح الشاشةُ على عين
                  الورقة التي تركتَها.
                */}
                {assignment && sheetId && (
                  <>
                    <button
                      onClick={() =>
                        navigate(
                          `${PATHS.attendanceDaily}?y=${yearId}&a=${assignment.id}&s=${sheetId}`,
                        )
                      }
                      title="حضورُ هذا الكشف بعينه — نفس المادة والفوج والشهر"
                      className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-amber-500/15 hover:text-amber-200"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      الكشف اليومي
                    </button>

                    <button
                      onClick={() =>
                        navigate(
                          `${PATHS.attendanceMonthlyFees}?y=${yearId}&a=${assignment.id}&s=${sheetId}`,
                        )
                      }
                      title="حقوقُ هذا الكشف بعينه — مَن سدَّد ومَن بقي عليه"
                      className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-emerald-500/15 hover:text-emerald-200"
                    >
                      <BadgeDollarSign className="h-4 w-4" />
                      كشف الحقوق الشهرية
                    </button>
                  </>
                )}

                {/*
                  إثبات الدفع — آخرُ ما يُفعل بالكشف.
                  يُجمّد لقطتَه في الأرشيف ويُلحق ورقتَه الموقَّعة، فيصير
                  ما يُقرأ بعد سنةٍ هو ما وُقّع عليه اليوم.
                */}
                {can("teacher-payment.create") &&
                  assignment &&
                  (settlement?.status === "PAID" ? (
                    /* دُفع: البابُ مغلق، والطريقُ إلى الأرشيف مفتوح */
                    <button
                      onClick={() => navigate(PATHS.settlementArchive)}
                      title="هذا الكشف دُفع — يُقرأ في الأرشيف بورقته"
                      className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/20"
                    >
                      <CircleCheckBig className="h-4 w-4" />
                      دُفع للأستاذ — افتح الأرشيف
                    </button>
                  ) : (
                    <button
                      onClick={() => setSettling(true)}
                      title={
                        settlement
                          ? `التخليص ${SETTLEMENT_STATUS_LABEL[settlement.status]}`
                          : "لم يُخلَّص هذا الكشف بعد"
                      }
                      className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-[#04121f] transition hover:brightness-110"
                      style={{ background: ACCENT }}
                    >
                      <BadgeCheck className="h-4 w-4" />
                      إثبات دفع للأستاذ
                    </button>
                  ))}
              </div>
            </div>

            {/* ============ جدول §16 ============
                خمسةُ أعمدة لا تسعُ عرضَ الشاشة كلَّه: تُركت ممدودةً
                فتباعدت الترويسةُ عن قيمتها حتى صار التاريخ في وادٍ
                وعنوانُه في وادٍ. فحُدّ عرضُها وصُفَّت في الوسط. */}
            <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 px-5 py-3.5">
                <span className="text-xs font-bold text-white/60">
                  الحصص المحتسبة — المبلغ يُحسب ولا يُدخَل
                </span>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/35">
                  <span>المحتسب: {BASIS_LABEL[estimate.policy.countBasis]}</span>
                  <span>
                    سعر الحصة للمؤسسة:{" "}
                    <span className="font-bold text-white/60" dir="ltr">
                      {t!.institutionSessionRate}
                    </span>
                  </span>
                  {/* §37: لا يُجمع العمودان — أحدهما مالٌ مستحقّ والآخر مالٌ لم يدخل */}
                  <span className="text-rose-300/50">
                    «غير محصَّل» لا يُضاف إلى مستحقّ الأستاذ
                  </span>
                </span>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] text-white/45">
                    {/*
                      نِسَبٌ لا بكسلات — الجدول يأخذ عرض الصفحة كجدول
                      الطلبة تحته، فلو ثُبّتت الأعمدة بالبكسل لابتلع
                      عمودٌ واحدٌ مرنٌ كلَّ الزيادة ووقف رقمُه في فراغ.
                    */}
                    <th style={{ width: "7%" }} className={`${headCell} border-e`}>
                      <Head title="الحصة" gloss="ترتيبها في الكشف" />
                    </th>
                    <th style={{ width: "14%" }} className={`${headCell} border-e`}>
                      <Head title="التاريخ" gloss="يوم إجرائها" />
                    </th>
                    <th style={{ width: "23%" }} className={`${headCell} border-e`}>
                      <Head title="المحتسبون" gloss="حضروا وسدّدوا — من مجموع الحاضرين" />
                    </th>
                    <th style={{ width: "13%" }} className={`${headCell} border-e`}>
                      <Head title="قيمة الوحدة" gloss="نصيب الأستاذ من حضورٍ واحد" />
                    </th>
                    <th style={{ width: "18%" }} className={`${headCell} border-e !text-end px-5`}>
                      <Head title="المجموع" gloss="المحتسبون × قيمة الوحدة" end />
                    </th>
                    {/* قسمُ المخلَّفين — مفصولٌ بخطٍّ أعرض لأنّه لا يُجمع مع ما قبله */}
                    <th
                      style={{ width: "11%" }}
                      className={`${headCell} border-e border-s-2 border-s-rose-300/25`}
                    >
                      <Head title="المخلَّفون" gloss="حضروا ولم يسدّدوا" />
                    </th>
                    <th style={{ width: "14%" }} className={`${headCell} !text-end px-5`}>
                      <Head title="غير محصَّل" gloss="المخلَّفون × سعر الحصة للمؤسسة" end />
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {estimate.rows.map((row) => {
                    const excluded = row.presentStudents - row.countedStudents;

                    return (
                      <tr
                        key={row.lessonNumber}
                        className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
                      >
                        <td className={`${bodyCell} border-e text-center font-black`} style={{ color: ACCENT }}>
                          {row.order}
                        </td>
                        <td className={`${bodyCell} border-e text-center text-white/55`}>
                          {/*
                            `dir` على المحتوى لا على الخانة.
                            وضعُه على الخانة يقلب معنى «المحاذاة إلى
                            النهاية»: فتصير نهايةُ الترويسة العربية يساراً
                            ونهايةُ الرقم اللاتيني يميناً، فيفترقان.
                          */}
                          <span dir="ltr" className="tabular-nums">{feeDate(row.sessionDate)}</span>
                        </td>
                        <td className={`${bodyCell} border-e text-center`}>
                          <span className="font-black">{row.countedStudents}</span>
                          {/* الفرق يُقرأ في مكانه: لماذا سبعةٌ ومن حضر أحدَ عشر */}
                          {excluded > 0 && (
                            <span className="ms-1.5 text-[11px] text-white/30">
                              من {row.presentStudents} حاضراً
                            </span>
                          )}
                        </td>
                        <td className={`${bodyCell} border-e text-center text-white/55`}>
                          <span dir="ltr" className="tabular-nums">{row.rate}</span>
                        </td>
                        <td className={`${bodyCell} border-e px-5 text-end font-bold`}>
                          <span dir="ltr" className="tabular-nums">{money(row.lineTotal, currency)}</span>
                        </td>

                        <td className={`${bodyCell} border-e border-s-2 border-s-rose-300/15 text-center`}>
                          {row.outstandingStudents > 0 ? (
                            <span className="font-bold text-rose-300/80">{row.outstandingStudents}</span>
                          ) : (
                            <span className="text-white/15">—</span>
                          )}
                        </td>

                        <td className={`${bodyCell} px-5 text-end font-bold`}>
                          {row.outstandingAmount > 0 ? (
                            <span dir="ltr" className="tabular-nums text-rose-300/80">
                              {money(row.outstandingAmount, currency)}
                            </span>
                          ) : (
                            <span className="text-white/15">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="border-t border-white/15 bg-white/[0.04]">
                    <td colSpan={2} className="border-e border-white/10 px-4 py-3.5 text-center text-[11px] text-white/40">
                      {t!.completedSessions} حصص
                    </td>
                    <td className="border-e border-white/10 px-4 py-3.5 text-center text-[11px] text-white/40">
                      {t!.countedUnits} وحدة محتسبة
                    </td>
                    <td className="border-e border-white/10 px-4 py-3.5 text-end font-bold text-white/60">
                      مستحقّ الأستاذ
                    </td>
                    <td
                      className="border-e border-white/10 px-5 py-3.5 text-end text-base font-black"
                      style={{ color: ACCENT }}
                    >
                      <span dir="ltr" className="tabular-nums">{money(t!.teacherAmount, currency)}</span>
                    </td>

                    <td className="border-e border-s-2 border-white/10 border-s-rose-300/25 px-4 py-3.5 text-center text-[11px] text-white/40">
                      {t!.outstandingUnits} وحدة
                    </td>
                    <td className="px-5 py-3.5 text-end">
                      <span dir="ltr" className="block text-base font-black tabular-nums text-rose-300/80">
                        {money(t!.outstandingEstimated, currency)}
                      </span>
                      {/*
                        نصيبُ الأستاذ منها — مؤجَّلٌ لا مدفوع.
                        بغيره يُقرأ 6,000 على أنّه حقُّ الأستاذ الضائع،
                        وحقُّه منها 4,500 والباقي حقُّ المؤسسة.
                      */}
                      {t!.outstandingTeacherShare !== null && (
                        <span className="mt-1 block text-[10px] font-normal leading-tight text-white/35">
                          نصيب الأستاذ المؤجَّل{" "}
                          <span dir="ltr" className="font-bold tabular-nums text-white/55">
                            {money(t!.outstandingTeacherShare, currency)}
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ============ التجميع بعدد الحصص — ورقة الإدارة ============ */}
            {buckets && buckets.buckets.length > 0 && (
              <BucketTable
                buckets={buckets}
                sessionRate={t!.institutionSessionRate}
                countedUnits={t!.countedUnits}
                currency={currency}
              />
            )}

            {/*
              ============ المؤجَّل — لم يدخل في تخليصٍ بعد ============

              ليس دمجاً ولا تقديراً: كلُّ سطرٍ واقعةُ قبضٍ لها رقمُ دفعة
              وتاريخ — مخلَّفٌ سدَّد بعد أن خُلِّص كشفُه، فنشأت حصةُ أستاذه
              لحظتَها. وما لم يُثبَت الدفع لا يظهر هنا شيء.

              **ولا يُقال «من كشوفٍ سابقة».** كان العنوان يقولها، ثمّ
              يُفتح كشفُ الشهر الأوّل فتظهر تحته أسطرٌ أصلُها هو نفسُه —
              لأنّ مخلَّفيه سدَّدوا بعد تخليصه. فيُقرأ العنوان تكذيباً
              لما تحته. والصفةُ الصحيحة زمنيّةٌ لا ترتيبيّة: **حصةٌ نشأت
              بعد تخليص كشفها ولم تدخل في دفعةٍ بعد** — سواءٌ أكان ذلك
              الكشف هذا أم غيره، والسطرُ نفسُه يقول أيَّهما.

              والماضي لا يُعدَّل: ورقةُ الكشف تبقى كما وُقّع عليها،
              والحصة تُدفع مع راتب هذا الكشف مقيَّدةً بأصلها.
            */}
            {arrears.length > 0 && (
              <ArrearsPanel
                tone="pending"
                title="نصيب الأستاذ المؤجَّل — سدَّده الطلبة بعد تخليص كشوفهم"
                lead="يُضاف إلى دفعة هذا الكشف:"
                note="كلُّ سطرٍ هنا سدَّده طالبٌ فعلاً بدفعةٍ مسجَّلة — والأصل مكتوبٌ في السطر: أمِنْ هذا الكشف هو أم من كشفٍ سابق."
                shares={arrears}
                total={arrearsTotal}
                currency={currency}
                sheetId={sheetId}
              />
            )}

            {/*
              وما دُفع مع هذا الكشف يبقى معروضاً بعد دفعه.
              المعلَّق يختفي بمجرّد قبضه — وهو الصواب — فلولا هذا اللوح
              لبدت الورقة كأنّها لم تحمل شيئاً، ولظُنّ المال ضائعاً وهو
              مقبوضٌ مقيَّدٌ في الأرشيف.
            */}
            {settledArrears.length > 0 && (
              <ArrearsPanel
                tone="settled"
                title="متأخّراتٌ دُفعت مع هذا الكشف"
                lead="أُضيفت إلى دفعة هذا الكشف:"
                note="قُبضت مع راتب هذا الكشف — تجدها مفصَّلةً في أرشيف تخليص الأساتذة."
                shares={settledArrears}
                total={settledArrearsTotal}
                currency={currency}
                sheetId={sheetId}
              />
            )}

            {/* ============ الطلبة والديون ============ */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <span className="text-xs font-bold text-white/50">
                  الطلبة — الحضور والدَّين
                </span>

                <SearchBox
                  value={search}
                  onChange={setSearch}
                  shown={visibleStudents.length}
                  total={estimate.students.length}
                  accent={ACCENT}
                />
              </div>

              <p className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2 text-[11px] text-white/35">
                <Info className="h-3.5 w-3.5 shrink-0" />
                الأستاذ يُخلَّص في وقته — وما لم يُدفع يبقى ديناً على الطالب لا خصماً من الأستاذ
              </p>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-white/50">
                    <th className="w-12 px-3 py-3 text-center font-bold">#</th>
                    <th className="px-4 py-3 text-start font-bold">اللقب والاسم</th>
                    <th className="w-20 px-3 py-3 text-center font-bold">حضر</th>
                    <th className="w-20 px-3 py-3 text-center font-bold">غاب</th>
                    <th className="w-20 px-3 py-3 text-center font-bold">لم يُدوَّن</th>
                    <th className="w-28 px-3 py-3 text-center font-bold">المستحقّ</th>
                    <th className="w-28 px-3 py-3 text-center font-bold">المدفوع</th>
                    <th className="w-28 px-3 py-3 text-center font-bold">الدَّين</th>
                    <th className="w-32 px-3 py-3 text-center font-bold">الحالة</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleStudents.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-14 text-center text-sm text-white/40">
                        لا طالب باسم «{search.trim()}» في هذا الكشف
                      </td>
                    </tr>
                  )}

                  {visibleStudents.map(({ student: s, order }) => (
                    <tr
                      key={s.studentId}
                      className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
                      style={s.defaulter ? { background: "rgba(253,164,175,0.05)" } : undefined}
                    >
                      <td className="px-3 py-2.5 text-center text-white/40">{order}</td>
                      <td className="px-4 py-2.5 font-bold">
                        {s.lastName} {s.firstName}
                      </td>
                      <td className="px-3 py-2.5 text-center font-black" style={{ color: "#86efac" }}>
                        {s.present || ""}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-rose-300/80">
                        {s.absent || ""}
                      </td>
                      <td className="px-3 py-2.5 text-center text-white/30">{s.blank || ""}</td>
                      <td className="px-3 py-2.5 text-center text-white/70">
                        {s.invoice ? money(s.invoice.total, currency) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center text-white/70">
                        {s.invoice ? money(s.invoice.paid, currency) : "—"}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-black"
                        style={{ color: s.defaulter ? "#fda4af" : "#86efac" }}
                      >
                        {s.invoice ? money(s.invoice.remaining, currency) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <StatusBadge student={s} />
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="border-t border-white/15 bg-white/[0.03] text-xs">
                    <td colSpan={5} className="px-4 py-3 text-end font-bold text-white/60">
                      المجاميع
                    </td>
                    <td className="px-3 py-3 text-center font-black">{money(t!.grossTuition, currency)}</td>
                    <td className="px-3 py-3 text-center font-black text-emerald-300">{money(t!.collected, currency)}</td>
                    <td className="px-3 py-3 text-center font-black text-rose-300">{money(t!.remaining, currency)}</td>
                    <td className="px-3 py-3 text-center text-white/50">{t!.defaulters} مخلَّف</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {/* إثبات الدفع — نافذةٌ بخطوتين: المال ثمّ الورقة الموقَّعة */}
      {estimate && assignment && (
        <SettlePayment
          open={settling}
          teacherId={estimate.header.teacher.id}
          teacherName={fullName(estimate.header.teacher)}
          academicYearId={yearId}
          teachingAssignmentId={assignment.id}
          attendanceSheetId={sheetId}
          currency={currency}
          onClose={() => setSettling(false)}
          onDone={(message) => {
            setToast(message);
            window.setTimeout(() => setToast((t) => (t === message ? null : t)), 3200);
            load();
            loadSettlement();
            loadArrears();
          }}
        />
      )}

      {/* شريطُ الخبر — يزول من نفسه */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-60 -translate-x-1/2 rounded-xl border border-emerald-400/30 bg-[#04251a] px-5 py-3 text-sm font-bold text-emerald-100 shadow-lg">
          {toast}
        </div>
      )}

      {previewing && estimate && (
        <SheetPreview
          title="الكشف التقديري للحصص"
          subtitle={`${estimate.header.subject.name} · ${estimate.header.level.name} · ${estimate.header.studyGroup.name} · كشف ${estimate.header.sheet.number}`}
          warning={printWarning}
          onRefresh={load}
          onClose={() => setPreviewing(false)}
        >
          <EstimatePrint
            schoolName={schoolName}
            estimate={estimate}
            currency={currency}
            /*
              الرمز من قائمة كشوف الإسناد لا من ترويسة التقدير: مسارُ
              التخليص لا يُرجع رمزَ الورقة، والقائمة محمَّلةٌ أصلاً.
            */
            code={sheetCode(sheets.find((s) => s.id === sheetId) ?? estimate.header.sheet)}
            arrears={printedArrears}
            arrearsPaid={settlement?.status === "PAID"}
            logo={logo}
          />
        </SheetPreview>
      )}
    </div>
  );
}

// --------------------------------------------------
// الجدول بالمجموعات
//
// السؤال الذي لا يجيب عنه الجدولُ بالحصص: **كم طالباً أكمل الشهر؟**
// وهو السؤال الذي تُراجَع به الورقة اليدوية — تكتب «5 طلبة × 8 حصص ×
// 187.5 = 7500» فيُصدَّق المبلغ بضربةٍ واحدة على الآلة، بينما تصديقُه
// من ثمانية أسطرٍ يحتاج جمعَها كلِّها.
//
// والمجموع واحدٌ في الجدولين لأنّ الوحدات واحدة:
// Σ (المحتسبون في كل حصة) = Σ (حصصُ كل محتسب).
// --------------------------------------------------

function BucketTable({
  buckets,
  sessionRate,
  countedUnits,
  currency,
}: {
  buckets: BucketSummary;
  sessionRate: number;
  countedUnits: number;
  currency: string;
}) {
  const showTeacher = buckets.teacherTotal !== null;

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 px-5 py-3.5">
        <span className="text-xs font-bold text-white/60">
          المجموعات — نفس المبلغ مرتَّباً بالطالب لا بالحصة
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/35">
          {/* أساسُ العدّ مكتوبٌ في ترويسة الجدول الأعلى — لا يُكرَّر */}
          <span>
            القاعدة:{" "}
            <span className="font-bold text-white/60">
              سعر الحصة × عدد الحصص التي حضرها × عدد المحتسبين
            </span>
          </span>
        </span>
      </div>

      {/*
        الاختلافُ يُعلَن. يقع حين يحضر تسجيلٌ مؤرشفٌ حصةً: الخادم يعدّ
        حضورَه في المجموع ولا يُدرجه في قائمة الطلبة، فيَنقص جدولُ
        المجموعات عن جدول الحصص. وإخفاءُ التعارض في ورقةٍ مالية أسوأ من
        إعلانه.
      */}
      {buckets.inconsistent && (
        <p className="flex items-start gap-2 border-b border-amber-400/20 bg-amber-500/[0.07] px-5 py-2.5 text-[11px] leading-relaxed text-amber-200/85">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          مجموع وحدات المجموعات {buckets.countedUnits} ولا يساوي {countedUnits} في
          جدول الحصص — حضورُ تسجيلٍ لم يظهر في قائمة الطلبة (مؤرشفٌ أو غير
          نشط). المبلغ المعتمد هو مبلغ جدول الحصص.
        </p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] text-white/45">
            <th style={{ width: "16%" }} className={`${headCell} border-e`}>
              <Head title="عدد الحصص" gloss="ما حضره كلُّ طالبٍ في المجموعة" />
            </th>
            <th style={{ width: "18%" }} className={`${headCell} border-e`}>
              <Head title="المحتسبون" gloss="طلبةٌ حضروا هذا العدد وسدّدوا" />
            </th>
            <th style={{ width: "18%" }} className={`${headCell} border-e`}>
              <Head title="الوحدات" gloss="عدد الحصص × المحتسبون" />
            </th>
            <th
              style={{ width: showTeacher ? "24%" : "48%" }}
              className={`${headCell} border-e !text-end px-5`}
            >
              <Head title="قيمة المؤسسة" gloss="الوحدات × سعر الحصة" end />
            </th>
            {showTeacher && (
              <th style={{ width: "24%" }} className={`${headCell} !text-end px-5`}>
                <Head title="نصيب الأستاذ" gloss="الوحدات × قيمة الوحدة" end />
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {buckets.buckets.map((bucket) => (
            <tr
              key={bucket.sessions}
              className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
            >
              <td
                className={`${bodyCell} border-e text-center font-black`}
                style={{ color: ACCENT }}
              >
                <span dir="ltr" className="tabular-nums">{bucket.sessions}</span>
              </td>
              <td className={`${bodyCell} border-e text-center font-black`}>
                <span dir="ltr" className="tabular-nums">{bucket.students}</span>
              </td>
              <td className={`${bodyCell} border-e text-center text-white/55`}>
                {/* الضربُ مكتوبٌ لا مُخفىً — منه يُصدَّق الصفّ بلا حساب */}
                <span dir="ltr" className="tabular-nums">
                  {bucket.sessions} × {bucket.students} = {bucket.units}
                </span>
              </td>
              <td className={`${bodyCell} border-e px-5 text-end font-bold text-white/70`}>
                <span dir="ltr" className="tabular-nums">
                  {money(bucket.institutionAmount, currency)}
                </span>
              </td>
              {showTeacher && (
                <td className={`${bodyCell} px-5 text-end font-bold`}>
                  <span dir="ltr" className="tabular-nums">
                    {money(bucket.teacherAmount!, currency)}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr className="border-t border-white/15 bg-white/[0.04]">
            <td className="border-e border-white/10 px-4 py-3.5 text-center text-[11px] text-white/40">
              {buckets.buckets.length} مجموعات
            </td>
            <td className="border-e border-white/10 px-4 py-3.5 text-center text-[11px] text-white/40">
              {buckets.countedStudents} محتسباً
            </td>
            <td className="border-e border-white/10 px-4 py-3.5 text-center text-[11px] text-white/40">
              {buckets.countedUnits} وحدة
            </td>
            <td className="border-e border-white/10 px-5 py-3.5 text-end font-bold text-white/60">
              <span dir="ltr" className="tabular-nums">
                {money(buckets.institutionTotal, currency)}
              </span>
              <span className="mt-0.5 block text-[10px] font-normal text-white/30">
                حقُّ المؤسسة — سعر الحصة {sessionRate}
              </span>
            </td>
            {showTeacher && (
              <td
                className="px-5 py-3.5 text-end text-base font-black"
                style={{ color: ACCENT }}
              >
                <span dir="ltr" className="tabular-nums">
                  {money(buckets.teacherTotal!, currency)}
                </span>
                <span className="mt-0.5 block text-[10px] font-normal text-white/30">
                  مستحقّ الأستاذ — قيمة الوحدة {buckets.unitRate}
                </span>
              </td>
            )}
          </tr>
        </tfoot>
      </table>

      {/*
        الطرائق المسطَّحة لا نصيبَ فيها لمجموعة. المستحقُّ فيها مبلغٌ
        شهريٌّ لا يُشتقّ من الحضور، فقيمةُ المجموعة على المؤسسة تبقى
        صحيحة وحصّةُ الأستاذ منها لا معنى لها — فتُترك ولا تُختلق.
      */}
      {!showTeacher && (
        <p className="border-t border-white/10 px-5 py-2.5 text-[11px] leading-relaxed text-white/35">
          مستحقّ الأستاذ في هذه السياسة لا يُشتقّ من الحضور، فلا نصيبَ
          لمجموعةٍ منه. والعمود المعروض قيمةُ الحصص على الطلبة وحدها.
        </p>
      )}
    </div>
  );
}

/**
 * الورقة المطبوعة — كتلٌ تتدفّق على أوراق.
 *
 * ليست جدولاً واحداً كأختيها: جدولُ الحصص، ثمّ عنوانٌ وجدولُ المجموعات،
 * ثمّ فقرةُ الطريقة، ثمّ عنوانٌ وجدولُ المخلَّفين. وكانت تُرسم كلُّها في
 * ورقةٍ واحدة مهما طالت — ففوجٌ فيه عشرون مخلَّفاً يخرج نصفُه خارج
 * الورقة، لا يُقصّ فيُنتبه إليه بل يُطبع حيث لا يبلغ الحبر.
 *
 * فصارت **كتلاً**: الفقرة لا تُقسَّم، والجدول يُقسَّم صفوفاً ويتكرّر
 * رأسُه، وسطرُ المجموع يلزم آخرَ صفٍّ من جدوله. والتوزيع بالقياس لا
 * بالتقدير — انظر `components/print/paged-flow`.
 *
 * والترويسة تتكرّر كاملةً على كل ورقة (من حمل الثانية وحدها يجب أن يعرف
 * لِمَن هي)، والإمضاء على الأخيرة وحدها — يُوقَّع على آخر الوثيقة لا على
 * كل ورقةٍ منها.
 */
function EstimatePrint({
  schoolName,
  estimate,
  currency,
  code,
  arrears,
  arrearsPaid,
  logo,
}: {
  schoolName: string;
  estimate: Estimate;
  currency: string;
  /** رمزُ الورقة — يخرج باركوداً تحت سطر التحرير */
  code: string;
  /** نصيبٌ من كشوفٍ سابقة — يُدفع مع هذا الكشف أو دُفع معه */
  arrears: DebtShare[];
  /** أقُبض؟ فتُصاغ الورقة بالماضي: هذا ما حملَته لا ما ستحمله */
  arrearsPaid: boolean;
  logo: LogoSpec;
}) {
  const printedOn = printedStamp();
  const logoWidth = Math.max(24, Math.round(logo.widthMm * 1.4));
  const t = estimate.totals;
  const defaulters = estimate.students.filter((s) => s.defaulter || s.uninvoiced);

  /* دالّةٌ خالصة — تُعيد الحساب هنا فتخرج بعينِ ما تراه الشاشة */
  const buckets = bucketByAttendance(estimate);

  const header = (
    <header className="sheet-print-top">
      <div className="sheet-print-side">
        <span>المستوى : {estimate.header.level.name}</span>
        <span>الفوج : {estimate.header.studyGroup.name}</span>
        <span className="sheet-print-printed">حُرِّر في {printedOn}</span>
        <SheetBarcode code={code} />
      </div>

      <div className="sheet-print-center">
        {logo.src && (
          <img src={logo.src} alt="" className="sheet-print-logo" style={{ width: `${logoWidth}mm`, filter: logo.filter }} />
        )}
        <h1>{schoolName}</h1>
        <h2>الكشف التقديري للحصص</h2>
      </div>

      <div className="sheet-print-side sheet-print-side-end">
        <span>المادة : {estimate.header.subject.name}</span>
        <span>الأستاذ : {fullName(estimate.header.teacher)}</span>
        <span>الكشف : {estimate.header.sheet.number}</span>
      </div>
    </header>
  );

  // --------------------------------------------------
  // الكتل — بترتيب قراءتها
  // --------------------------------------------------

  const blocks: PrintBlock[] = [
    {
      kind: "table",
      key: "sessions",
      head: (
        <thead data-flow-head="">
          <tr>
            <th style={{ width: "9%" }}>
              الحصة<PrintGloss text="ترتيبها في الكشف" />
            </th>
            <th style={{ width: "17%" }}>
              التاريخ<PrintGloss text="يوم إجرائها" />
            </th>
            <th style={{ width: "17%" }}>
              المحتسبون<PrintGloss text="حضروا وسدّدوا" />
            </th>
            <th style={{ width: "15%" }}>
              الحاضرون<PrintGloss text="حضروا أو تأخّروا" />
            </th>
            <th style={{ width: "18%" }}>
              قيمة الوحدة<PrintGloss text="نصيب الأستاذ من حضورٍ واحد" />
            </th>
            <th style={{ width: "24%" }}>
              المجموع<PrintGloss text="المحتسبون × قيمة الوحدة" />
            </th>
          </tr>
        </thead>
      ),
      rows: estimate.rows.map((r) => (
        <tr key={r.lessonNumber} data-flow-row="">
          <td className="c">{r.order}</td>
          <td className="c">{feeDate(r.sessionDate)}</td>
          <td className="c b">{r.countedStudents}</td>
          <td className="c">{r.presentStudents}</td>
          <td className="c">{r.rate}</td>
          <td className="c b">{money(r.lineTotal, currency)}</td>
        </tr>
      )),
      tail: (
        <tr data-flow-tail="">
          <td colSpan={5} style={{ textAlign: "end", fontWeight: 700 }}>
            مستحقّ الأستاذ
          </td>
          <td className="c b">{money(t.teacherAmount, currency)}</td>
        </tr>
      ),
    },

    /*
        الجدول الثاني — نفسُ المبلغ مرتَّباً بالطالب.
        وهو الذي يُصدَّق بضربةٍ واحدة على الآلة: «5 × 8 × 187.5»،
        فيراجعه الأستاذُ قبل أن يُمضي بلا أن يجمع ثمانية أسطر.
    */
    ...(buckets.buckets.length > 0
      ? [
          {
            kind: "table" as const,
            key: "buckets",
            title: (
              <h3 data-flow-title="" style={{ margin: "5mm 0 2mm", fontSize: "11pt" }}>
                المجموعات — بعدد الحصص التي حضرها الطالب
              </h3>
            ),
            head: (
              <thead data-flow-head="">
                {/*
                  «قيمة المؤسسة» ليست على هذه الورقة.

                  الورقة تُعرض على الأستاذ ليُوقّع على مستحقّه، وما تجنيه
                  المؤسسة من الفوج ليس ممّا يُوقَّع عليه ولا ممّا يعنيه —
                  ووجودُه بجانب نصيبه يجعل الورقة تُقرأ مقارنةً.
                  والشاشة تُبقيه للإدارة.
                */}
                <tr>
                  <th style={{ width: "16%" }}>
                    عدد الحصص<PrintGloss text="ما حضره كلُّ طالبٍ في المجموعة" />
                  </th>
                  <th style={{ width: "18%" }}>
                    المحتسبون<PrintGloss text="حضروا هذا العدد وسدّدوا" />
                  </th>
                  <th style={{ width: "30%" }}>
                    الوحدات<PrintGloss text="عدد الحصص × المحتسبون" />
                  </th>
                  <th style={{ width: "36%" }}>
                    نصيب الأستاذ<PrintGloss text="الوحدات × قيمة الوحدة" />
                  </th>
                </tr>
              </thead>
            ),
            rows: buckets.buckets.map((bucket) => (
              <tr key={bucket.sessions} data-flow-row="">
                <td className="c b">{bucket.sessions}</td>
                <td className="c b">{bucket.students}</td>
                <td className="c">
                  {bucket.sessions} × {bucket.students} = {bucket.units}
                </td>
                <td className="c b">
                  {bucket.teacherAmount === null
                    ? "—"
                    : money(bucket.teacherAmount, currency)}
                </td>
              </tr>
            )),
            tail: (
              <tr data-flow-tail="">
                <td className="c b">{buckets.countedStudents}</td>
                <td className="c" style={{ fontSize: "8pt" }}>
                  محتسباً
                </td>
                <td className="c b">{buckets.countedUnits} وحدة</td>
                <td className="c b">
                  {buckets.teacherTotal === null
                    ? "—"
                    : money(buckets.teacherTotal, currency)}
                </td>
              </tr>
            ),
          },
        ]
      : []),

    {
      kind: "keep",
      key: "policy",
      node: (
        <p style={{ margin: "4mm 0 2mm", fontSize: "9pt", lineHeight: 1.7 }}>
          الطريقة: {METHOD_LABEL[estimate.policy.method]} ({policyValue(estimate.policy)}) ·
          أساس العدّ: {BASIS_LABEL[estimate.policy.countBasis]} ·
          الحقّ الشهري: {money(estimate.tuition, currency)} ·
          الحصص المنجزة: {t.completedSessions} من {t.approvedSessions}
          <br />
          {/* السطر الذي يُغني عن السؤال: من أين جاء المبلغ */}
          الوحدات المحتسبة: {t.countedUnits} من {t.attendedUnits} حضوراً ·
          قيمة الوحدة × الوحدات المحتسبة = {money(t.teacherAmount, currency)}
        </p>
      ),
    },

    ...(defaulters.length > 0
      ? [
          {
            kind: "table" as const,
            key: "defaulters",
            title: (
              <h3 data-flow-title="" style={{ margin: "5mm 0 2mm", fontSize: "11pt" }}>
                المخلَّفون — دَينٌ باقٍ ({defaulters.length})
              </h3>
            ),
            head: (
              <thead data-flow-head="">
                <tr>
                  <th style={{ width: "8%" }}>الترتيب</th>
                  <th style={{ width: "34%" }}>اللقب والاسم</th>
                  <th style={{ width: "16%" }}>هاتف الوليّ</th>
                  <th style={{ width: "14%" }}>
                    حضر<PrintGloss text="عدد الحصص التي حضرها" />
                  </th>
                  <th style={{ width: "14%" }}>
                    نصيب الأستاذ<PrintGloss text="ما تأخذه إن سدّد" />
                  </th>
                  <th style={{ width: "14%" }}>الإمضاء</th>
                </tr>
              </thead>
            ),
            rows: defaulters.map((s, i) => {
              /*
                نصيبُ الأستاذ لا دَينُ المؤسسة: الطالب عليه 1,500
                للمؤسسة، ونصيبُ الأستاذ منها 1,125 — ومن قرأ الأوّل على
                ورقته ظنّه حقَّه الضائع.
              */
              const share = pendingTeacherShare(estimate, s);

              return (
                <tr key={s.studentId} data-flow-row="">
                  <td className="c">{i + 1}</td>
                  <td>{s.lastName} {s.firstName}</td>
                  <td className="c">{s.parentPhone}</td>
                  <td className="c">{s.present}</td>
                  <td className="c b">{share === null ? "—" : money(share, currency)}</td>
                  <td />
                </tr>
              );
            }),
            tail: (
              <tr data-flow-tail="">
                <td colSpan={4} style={{ textAlign: "end", fontWeight: 700 }}>
                  نصيبك المؤجَّل من هؤلاء
                </td>
                {/* من الخادم لا جمعاً للعمود — الورقة لا تحسب ما حسبه غيرُها */}
                <td className="c b">
                  {t.outstandingTeacherShare === null
                    ? "—"
                    : money(t.outstandingTeacherShare, currency)}
                </td>
                <td />
              </tr>
            ),
          },
        ]
      : []),
  ];

  /*
   * الإمضاء تحت الجدول بمسافة — لا في أسفل الورقة.
   *
   * جُرّب في التذييل فنزل إلى حافّة الورقة، فبقي بينه وبين آخر جدولٍ
   * فراغٌ يبلغ نصف الورقة أحياناً — يُقرأ انقطاعاً لا خاتمة. فصار
   * **كتلةً في التدفّق**: يتبع آخر ما كُتب بعشرين مليمتراً، ويُحسب في
   * ميزانية الورقة كسائر الكتل — فإن لم يسعها انتقل إلى التي بعدها
   * كاملاً بدل أن يُقصّ.
   *
   * والترقيم وحده يبقى في التذييل، وهو الذي ينزل إلى الحافّة.
   */
  const signatures: PrintBlock = {
    kind: "keep",
    key: "signatures",
    node: (
      /*
       * خانتان لا سطر: الأستاذُ يُقرّ بما قبض والإدارةُ بما دفعت،
       * وكلٌّ يُمضي على إقراره لا على سطرٍ مشترك. والأستاذ إلى اليمين
       * (‏أوّلُ الورقة العربية) والإدارة إلى اليسار، والختم لها وحدها.
       */
      <div
        style={{
          marginTop: "16mm",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <PrintSignature role="الأستاذ" seal={false} />
        <PrintSignature role="مدير المؤسسة" />
      </div>
    ),
  };

  /*
    المؤجَّل من كشوفٍ سابقة — على الورقة لا في الشاشة وحدها.

    الأستاذ يُمضي على ما يقبض، وهو راتبُ هذا الكشف **ومتأخّراتٌ** سُدِّدت
    بعد تخليص كشوفها. فتُكتب مفصَّلةً بأصلها — أيُّ كشفٍ وبأيّ رمزٍ وأيُّ
    دفعةٍ سدَّدتها — لا مبلغاً مجموعاً بلا سند.
  */
  if (arrears.length > 0) {
    const arrearsTotal = arrears.reduce((sum, share) => sum + share.shareAmount, 0);

    blocks.push({
      kind: "table",
      key: "arrears",
      title: (
        <h3 data-flow-title="" style={{ margin: "5mm 0 2mm", fontSize: "11pt" }}>
          {arrearsPaid
            ? `متأخّراتٌ دُفعت مع هذا الكشف — سدَّدها الطلبة بعد تخليص كشوفها (${arrears.length})`
            : `نصيبٌ مؤجَّل — سدَّده الطلبة بعد تخليص كشوفها ولم يدخل في دفعةٍ بعد (${arrears.length})`}
        </h3>
      ),
      head: (
        <thead data-flow-head="">
          <tr>
            <th style={{ width: "24%" }}>
              الطالب<PrintGloss text="سدَّد دَينه بعد تخليص كشفه" />
            </th>
            <th style={{ width: "34%" }}>
              الكشف الأصلي<PrintGloss text="مادّته وفوجه ورقم شهره" />
            </th>
            <th style={{ width: "18%" }}>
              رمز الورقة<PrintGloss text="المطبوع تحت باركودها" />
            </th>
            <th style={{ width: "10%" }}>
              حضر<PrintGloss text="حصصه في ذلك الكشف" />
            </th>
            <th style={{ width: "14%" }}>
              نصيبك<PrintGloss text="حضوره × قيمة الوحدة وقتها" />
            </th>
          </tr>
        </thead>
      ),
      rows: arrears.map((share) => {
        const origin = share.originalSettlement;
        const student = share.debtCollection.invoice.studentEnrollment.student;

        return (
          <tr key={share.id} data-flow-row="">
            <td>
              {student.lastName} {student.firstName}
            </td>
            <td>
              {origin
                ? `${origin.teachingAssignment.subject.name} · ${origin.teachingAssignment.studyGroup.name} · ${
                    origin.attendanceSheet.label?.trim() ||
                    `الشهر رقم ${origin.attendanceSheet.number}`
                  }`
                : "—"}
            </td>
            <td className="c" style={{ direction: "ltr" }}>
              {origin?.attendanceSheet.code ?? "—"}
            </td>
            <td className="c">{share.attendedUnits ?? "—"}</td>
            <td className="c b">{money(share.shareAmount, currency)}</td>
          </tr>
        );
      }),
      tail: (
        <tr data-flow-tail="">
          <td colSpan={4} style={{ textAlign: "end", fontWeight: 700 }}>
            {arrearsPaid ? "مجموع المتأخّرات" : "مجموع المؤجَّل"}
          </td>
          <td className="c b">{money(arrearsTotal, currency)}</td>
        </tr>
      ),
    });

    /* وسطرٌ يجمع الاثنين — هو ما يُقبض فعلاً */
    blocks.push({
      kind: "keep",
      key: "grand-total",
      node: (
        <p
          style={{
            margin: "3mm 0 0",
            fontSize: "11pt",
            fontWeight: 800,
            textAlign: "center",
          }}
        >
          {arrearsPaid ? "الإجمالي المدفوع" : "الإجمالي المستحقّ"}:{" "}
          {money(t.teacherAmount, currency)} +{" "}
          {money(arrearsTotal, currency)} ={" "}
          <span style={{ textDecoration: "underline" }}>
            {money(t.teacherAmount + arrearsTotal, currency)}
          </span>
        </p>
      ),
    });
  }

  blocks.push(signatures);

  /* بصمةُ ما يغيّر الارتفاعات: عددُ الأسطر في كل جدول ومقدارُ نصوصها */
  const signature = [
    estimate.rows.length,
    buckets.buckets.length,
    defaulters.map((s) => `${s.studentId}:${s.present}`).join(","),
    arrears.map((s) => s.id).join(","),
    estimate.policy.method,
  ].join("|");

  const { measureRef, pages } = usePagedFlow(signature, blocks.length);


  /*
   * طورُ القياس — ورقةٌ خفيّة فيها كلُّ الكتل بعلاماتها.
   *
   * وتذييلُها أطولُ ما سيكون (الإمضاء والترقيم معاً)، فما دونه يزيد
   * الورقةَ سعةً ولا ينقصها.
   */
  if (!pages) {
    return (
      <div className="sheet-print" dir="rtl">
        <div className="sheet-measure" ref={measureRef}>
          <section className="sheet-measure-page" data-measure-page="">
            {header}

            {blocks.map((block, index) => (
              <div key={block.key} data-flow-index={index}>
                {block.kind === "keep" ? (
                  block.node
                ) : (
                  <>
                    {block.title}
                    <table className="sheet-print-table" data-flow-table="">
                      {block.head}
                      <tbody>
                        {block.rows}
                        {block.tail}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            ))}

            <footer className="sheet-print-foot" data-measure-foot="">
              <span style={{ display: "block" }}>الصفحة 1 من 1</span>
            </footer>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="sheet-print" dir="rtl">
      {pages.map(({ pieces, fillMm }, page) => {
        return (
          <section className="sheet-page" key={page}>
            {header}

            {pieces.map((piece, at) => {
              const block = blocks[piece.index];

              if (block.kind === "keep") {
                return <Fragment key={`${block.key}-${at}`}>{block.node}</Fragment>;
              }

              if (piece.kind !== "table") return null;

              return (
                <Fragment key={`${block.key}-${at}`}>
                  {piece.withTitle && block.title}

                  <table className="sheet-print-table">
                    {block.head}
                    <tbody>
                      {block.rows.slice(piece.from, piece.to + 1)}
                      {piece.withTail && block.tail}
                    </tbody>
                  </table>
                </Fragment>
              );
            })}

            {/* الفراغ الذي ينزل بالتذييل إلى أسفل الورقة — محسوبٌ لا مفروض */}
            <div style={{ height: `${fillMm.toFixed(2)}mm` }} />

            {/* الترقيم وحده في الحافّة — والإمضاء كتلةٌ فوقه في التدفّق */}
            <footer className="sheet-print-foot">
              {pages.length > 1 && (
                <span style={{ display: "block" }}>
                  الصفحة {page + 1} من {pages.length}
                </span>
              )}
            </footer>
          </section>
        );
      })}
    </div>
  );
}

// --------------------------------------------------

function StatusBadge({ student }: { student: Estimate["students"][number] }) {
  const tone = student.uninvoiced
    ? { bg: "rgba(252,211,77,0.14)", fg: "#fcd34d", label: "بلا فاتورة" }
    : student.defaulter
      ? student.invoice!.paid > 0
        ? { bg: "rgba(252,211,77,0.14)", fg: "#fcd34d", label: "جزئي" }
        : { bg: "rgba(253,164,175,0.14)", fg: "#fda4af", label: "مخلَّف" }
      : { bg: "rgba(134,239,172,0.14)", fg: "#86efac", label: "مثبَّت الدفع" };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {!student.defaulter && !student.uninvoiced && <CircleCheckBig className="h-3 w-3" />}
      {tone.label}
    </span>
  );
}

/**
 * ترويسةُ عمودٍ بشرحها تحتها.
 *
 * أسماءُ الأعمدة في هذا الكشف اصطلاحاتٌ لا كلماتٌ عامّة: «المحتسبون»
 * غيرُ «الحاضرون»، و«غير محصَّل» يُقوَّم بسعرٍ غير الذي فوقه. ومن قرأ
 * الاسم وحده خمَّن معناه — وتخمينُه في ورقةٍ مالية يُنتج قراءةً خاطئة
 * لا سؤالاً. فالشرح مكتوبٌ في الورقة نفسها لا في ذاكرة من ملأها.
 */
/** الشرح في الورقة المطبوعة — سطرٌ ثانٍ أصغر داخل الترويسة */
function PrintGloss({ text }: { text: string }) {
  return (
    <span style={{ display: "block", fontWeight: 400, fontSize: "6.5pt", marginTop: "0.4mm" }}>
      ({text})
    </span>
  );
}

function Head({
  title,
  gloss,
  end,
}: {
  title: string;
  gloss: string;
  end?: boolean;
}) {
  return (
    <span className={`block leading-tight ${end ? "text-end" : "text-center"}`}>
      <span className="block">{title}</span>
      <span className="mt-0.5 block text-[9.5px] font-normal text-white/25">({gloss})</span>
    </span>
  );
}

/* الحقول والقوائم انتقلت إلى components/shared/FilterPanel — لوحٌ واحد للكشوف الثلاثة */

function Meta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[11px] text-white/40">{label}:</span>
      <span className={strong ? "font-black" : "font-bold text-white/85"}>{value || "—"}</span>
    </span>
  );
}

function Stat({
  label, value, tone, strong,
}: {
  label: string;
  value: string;
  tone: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <span className="mb-1 block text-[11px] text-white/40">{label}</span>
      <span className={`block font-black ${strong ? "text-xl" : "text-base"}`} style={{ color: tone }}>
        {value}
      </span>
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
      <ClipboardList className="mb-3 h-11 w-11 text-white/15" />
      <p className="text-white/60">{title}</p>
      <p className="mt-1.5 max-w-md text-xs text-white/35">{hint}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  لوحُ المتأخّرات — بنبرتين                                          */
/* ------------------------------------------------------------------ */

/*
 * جدولٌ واحد بحالين: ما ينتظر القبض (كهرماني) وما قُبض مع هذا الكشف
 * (أخضر). والأعمدة واحدة عمداً — العين تقارئ بينهما دون أن تتعلّم
 * شكلين، والفارق في اللون والعنوان لا في البنية.
 */

const ARREARS_SKIN = {
  pending: {
    frame: "border-amber-400/25 bg-amber-500/[0.04]",
    divider: "border-amber-400/20",
    dividerSoft: "border-amber-400/15",
    dividerFaint: "border-amber-400/10",
    head: "text-amber-100",
    muted: "text-amber-100/70",
    faint: "text-amber-100/50",
    value: "text-amber-200",
  },
  settled: {
    frame: "border-emerald-400/25 bg-emerald-500/[0.04]",
    divider: "border-emerald-400/20",
    dividerSoft: "border-emerald-400/15",
    dividerFaint: "border-emerald-400/10",
    head: "text-emerald-100",
    muted: "text-emerald-100/70",
    faint: "text-emerald-100/50",
    value: "text-emerald-200",
  },
} as const;

type ArrearsPanelProps = {
  tone: keyof typeof ARREARS_SKIN;
  title: string;
  lead: string;
  note: string;
  shares: DebtShare[];
  total: number;
  currency: string;
  /** الكشفُ المفتوح — به يُعرف أصلُ السطر: منه أم من غيره */
  sheetId: string;
};

function ArrearsPanel({
  tone,
  title,
  lead,
  note,
  shares,
  total,
  currency,
  sheetId,
}: ArrearsPanelProps) {
  const skin = ARREARS_SKIN[tone];

  return (
  <div className={`mt-4 overflow-hidden rounded-2xl border ${skin.frame}`}>
    <div className={`flex flex-wrap items-center justify-between gap-3 border-b ${skin.divider} px-4 py-3`}>
      <span className={`flex items-center gap-2 text-sm font-black ${skin.head}`}>
        <Wallet className="h-4 w-4" />
        {title}
      </span>

      <span className={`flex items-baseline gap-2 text-xs ${skin.muted}`}>
        {lead}
        <span className={`text-base font-black ${skin.value}`}>
          {money(total, currency)}
        </span>
      </span>
    </div>

    <p className={`border-b ${skin.dividerFaint} px-4 py-2 text-[11px] leading-relaxed ${skin.faint}`}>
      {note}
    </p>

    <table className="w-full text-sm">
      <thead>
        <tr className={`border-b ${skin.dividerSoft} text-xs ${skin.faint}`}>
          <th className="px-4 py-2.5 text-start font-bold">الطالب</th>
          <th className="px-4 py-2.5 text-start font-bold">من كشف</th>
          <th className="w-28 px-3 py-2.5 text-center font-bold">حضر</th>
          <th className="w-32 px-3 py-2.5 text-center font-bold">المحصَّل</th>
          <th className="w-32 px-3 py-2.5 text-center font-bold">نصيب الأستاذ</th>
        </tr>
      </thead>

      <tbody>
        {shares.map((share) => {
          const origin = share.originalSettlement;
          const student = share.debtCollection.invoice.studentEnrollment.student;

          return (
            <tr key={share.id} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-2.5 font-bold">
                {student.lastName} {student.firstName}
              </td>

              <td className="px-4 py-2.5 text-white/70">
                {origin ? (
                  <>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                      {/*
                        شارةُ الأصل: «من هذا الكشف» أو «من كشفٍ
                        سابق» — تُقرأ قبل السطر فلا يُظنّ أنّ
                        المؤجَّل كلَّه من غيره.
                      */}
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-black"
                        style={
                          origin.attendanceSheet.id === sheetId
                            ? { background: "rgba(147,197,253,0.18)", color: "#93c5fd" }
                            : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }
                        }
                      >
                        {origin.attendanceSheet.id === sheetId
                          ? "من هذا الكشف"
                          : "من كشفٍ سابق"}
                      </span>

                      {origin.teachingAssignment.subject.name} ·{" "}
                      {origin.teachingAssignment.studyGroup.name} ·{" "}
                      {origin.attendanceSheet.label?.trim() ||
                        `الشهر رقم ${origin.attendanceSheet.number}`}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-white/35">
                      رمز الورقة{" "}
                      <span className="font-mono" dir="ltr">
                        {origin.attendanceSheet.code}
                      </span>
                      {" · سُدّد بدفعة "}
                      <span className="font-mono" dir="ltr">
                        {share.debtCollection.payment.paymentNumber}
                      </span>
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </td>

              <td className="px-3 py-2.5 text-center text-white/70">
                {share.attendedUnits ?? "—"}
              </td>

              <td className="px-3 py-2.5 text-center text-white/70">
                {money(share.collectedAmount, currency)}
              </td>

              <td className={`px-3 py-2.5 text-center font-black ${skin.value}`}>
                {money(share.shareAmount, currency)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
  );
}
