import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarRange,
  Check,
  CircleCheckBig,
  FilePlus2,
  Info,
  Loader2,
  Printer,
  RefreshCw,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { logoSpec, type LogoSpec } from "../../components/print/logo";
import { SheetPreview } from "../../components/print/SheetPreview";
import { useAcademicYears } from "../../core/api/reference.api";
import { useAuthStore } from "../../core/stores/auth.store";
import { useSchool, useSchoolStore } from "../../core/stores/school.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import {
  createPayment,
  generateInvoices,
  listInvoices,
  money,
  MONTHS,
  type Invoice,
  type PaymentMethod,
} from "../finance/finance.api";
import {
  deriveOptions,
  fullName,
  getSheet,
  isoDate,
  listAssignments,
  listAttendance,
  listEnrollments,
  listSheets,
  resolveAssignment,
  sheetTitle,
  type Assignment,
  type AttendanceRow,
  type EnrollmentRow,
  type Sheet,
  type SheetFilters,
} from "./attendance.api";
import {
  attendanceOf,
  FEE_LABEL,
  FEE_PRINT,
  FEE_TONE,
  feeDate,
  feeStateOf,
  fillingLabel,
  heldSessions,
  invoicePeriodOf,
  paidOnOf,
  sheetMonthLabel,
  sheetRange,
  spanLabel,
  type FeeState,
  type SheetFilling,
} from "./fees";

const ACCENT = "#86efac";

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

/** تاريخ اليوم بتوقيت الجهاز — لا UTC: بعد منتصف الليل يختلفان يوماً */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** صفٌّ واحد في الكشف — الطالب وحصصه وحقّه */
interface FeeRow {
  enrollment: EnrollmentRow;
  invoice: Invoice | undefined;
  state: FeeState;
  attended: number;
  absent: number;
  blank: number;
  paidOn: string | null;
}

/**
 * كشف دفع الحقوق الشهري.
 *
 * الورقة تسأل عن أربعة أشياء لكل طالب: كم حصةً أخذ، وهل دفع، ومتى،
 * وإمضاؤه. وهي أربعةٌ من مصدرين لا يلتقيان في المخطّط — الحصص من كشف
 * الحضور المرقَّم، والمال من فاتورة الشهر التقويمي. فالشاشة تجمعهما
 * وتُظهر الربط صراحةً بدل أن تُخفيه: «حقوق ديسمبر 2026» مكتوبةٌ فوق
 * الجدول وقابلةٌ للتصحيح.
 *
 * والتأكيد هنا ليس تعليماً على ورقة: هو دفعةٌ حقيقية (Payment) بتاريخها
 * وطريقتها، يخرج منها إيصالٌ كإيصال شبّاك المحاسبة — فلا يوجد في النظام
 * «مدفوعٌ» لا يقابله مالٌ مسجَّل.
 */
export default function MonthlyFeesPage() {
  const exitTo = useScreenExit();
  const can = useAuthStore((s) => s.hasPermission);
  const schoolName = useSchool("school.name_ar");

  /* الانتقاء على settings لا على ناتج logoSpec — الأخير كائن جديد كل مرّة */
  const logo = logoSpec(useSchoolStore((s) => s.settings));

  const yearsQuery = useAcademicYears();
  const years = yearsQuery.data ?? [];

  const [yearId, setYearId] = useState("");
  const [filters, setFilters] = useState<SheetFilters>(EMPTY_FILTERS);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetId, setSheetId] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [cells, setCells] = useState<Map<string, AttendanceRow>>(new Map());
  const [invoices, setInvoices] = useState<Map<string, Invoice>>(new Map());

  /** الشهر التقويمي للفواتير — مشتقٌّ من الكشف، ويُصحَّح يدوياً عند اللزوم */
  const [period, setPeriod] = useState<{ month: number; year: number } | null>(null);
  const [overridden, setOverridden] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [paying, setPaying] = useState<FeeRow | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);

  /* السنة الافتراضية هي الجارية — لا أوّل ما يعود من الخادم */
  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId((years.find((y) => y.isCurrent) ?? years[0]).id);
  }, [years, yearId]);

  // --------------------------------------------------
  // القدوم من كشف الحضور — `?y=سنة&a=إسناد&s=كشف`
  //
  // الانتقال بين الشاشتين كان يعني إعادةَ اختيار خمسة مرشِّحاتٍ يدوياً
  // لبلوغ الكشف نفسه. فالرابط يحملها، وتُستهلَك بعد تطبيقها فلا تُعيد
  // فرض نفسها على اختيارٍ لاحق.
  // --------------------------------------------------

  const [params, setParams] = useSearchParams();
  const linkYear = params.get("y");
  const linkAssignment = params.get("a");
  const linkSheet = params.get("s");

  useEffect(() => {
    if (linkYear) setYearId(linkYear);
  }, [linkYear]);

  useEffect(() => {
    if (!linkAssignment || assignments.length === 0) return;

    const target = assignments.find((a) => a.id === linkAssignment);
    if (!target) return;

    setFilters({
      stageId: target.studyGroup.level.educationStage.id,
      levelId: target.studyGroup.level.id,
      subjectId: target.subject.id,
      teacherId: target.teacher.id,
      groupId: target.studyGroup.id,
    });
  }, [linkAssignment, assignments]);

  useEffect(() => {
    if (!linkSheet || !sheets.some((s) => s.id === linkSheet)) return;

    setSheetId(linkSheet);
    setParams({}, { replace: true });
  }, [linkSheet, sheets, setParams]);

  // --------------------------------------------------
  // الإسنادات — منها تُشتقّ كل قوائم التصفية
  // --------------------------------------------------

  useEffect(() => {
    if (!yearId) return;

    let alive = true;
    setLoadingRefs(true);
    setFilters(EMPTY_FILTERS);

    listAssignments(yearId)
      .then((rows) => alive && setAssignments(rows))
      .catch((err) => alive && setError(err?.response?.data?.message ?? "تعذّر جلب الإسنادات"))
      .finally(() => alive && setLoadingRefs(false));

    return () => {
      alive = false;
    };
  }, [yearId]);

  const options = useMemo(() => deriveOptions(assignments, filters), [assignments, filters]);
  const assignment = useMemo(() => resolveAssignment(assignments, filters), [assignments, filters]);

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

  // --------------------------------------------------
  // كشوف الإسناد
  // --------------------------------------------------

  useEffect(() => {
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
        /* آخر كشف هو الجاري عادةً */
        setSheetId(rows.length > 0 ? rows[rows.length - 1].id : "");
      })
      .catch((err) => alive && setError(err?.response?.data?.message ?? "تعذّر جلب الكشوف"));

    return () => {
      alive = false;
    };
  }, [assignment]);

  /* اختيار كشفٍ آخر يُعيد اشتقاق الشهر — التصحيح اليدوي يخصّ كشفه وحده */
  useEffect(() => setOverridden(false), [sheetId]);

  // --------------------------------------------------
  // تحميل الكشف: الحصص والمسجَّلون والحضور
  // --------------------------------------------------

  const loadSheet = useCallback(async () => {
    if (!assignment || !sheetId) {
      setSheet(null);
      setEnrollments([]);
      setCells(new Map());
      setInvoices(new Map());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [loaded, enrollmentRows] = await Promise.all([
        getSheet(sheetId),
        listEnrollments(assignment.id),
      ]);

      setSheet(loaded);
      setEnrollments(enrollmentRows);

      if (!overridden) setPeriod(invoicePeriodOf(loaded.sessions));

      /* الحضور يُقرأ على مدى أعمدة الكشف — أضيقُ نطاقٍ يكفيها */
      if (loaded.sessions.length > 0) {
        const dates = loaded.sessions.map((s) => isoDate(s.sessionDate)).sort();

        const rows = await listAttendance({
          teachingAssignmentId: assignment.id,
          dateFrom: dates[0],
          dateTo: dates[dates.length - 1],
        });

        const owned = new Set(loaded.sessions.map((s) => s.id));

        setCells(
          new Map(
            rows
              .filter((r) => owned.has(r.sessionId))
              .map((r) => [`${r.studentEnrollmentId}|${r.sessionId}`, r]),
          ),
        );
      } else {
        setCells(new Map());
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر تحميل الكشف");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment, sheetId]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  // --------------------------------------------------
  // الفواتير — الشهر التقويمي لهذا الكشف
  //
  // تُجلب على حدة لا مع الكشف: تصحيحُ الشهر يعيد جلبها وحدها، وتأكيدُ
  // دفعةٍ يُحدّثها وحدها. وربطُها بالكشف يُعيد تحميل الحضور بلا سبب.
  // --------------------------------------------------

  const loadInvoices = useCallback(async () => {
    if (!assignment || !period) {
      setInvoices(new Map());
      return;
    }

    const found = new Map<string, Invoice>();
    let page = 1;

    try {
      for (;;) {
        const { invoices: rows, pagination } = await listInvoices({
          subjectId: assignment.subject.id,
          studyGroupId: assignment.studyGroup.id,
          month: period.month,
          year: period.year,
          limit: 100,
          page,
        });

        /* الملغاة ليست حقاً على الطالب — كغيابها تماماً */
        for (const invoice of rows) {
          if (invoice.status !== "CANCELLED") {
            found.set(invoice.studentEnrollment.id, invoice);
          }
        }

        if (!pagination || page >= pagination.totalPages || pagination.totalPages === 0) break;
        page++;
      }

      setInvoices(found);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر جلب فواتير الشهر");
    }
  }, [assignment, period]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // --------------------------------------------------
  // الصفوف — مشتقّة لا مخزَّنة
  // --------------------------------------------------

  const sessions = sheet?.sessions ?? [];

  /**
   * المنجزة وحدها تُحسب — `heldSessions`.
   *
   * الملغاة لم تقع فلا هي حضورٌ ولا غياب ولا خانةٌ تنتظر الملء، وعدُّها
   * فراغاً كان سيجعل كل كشفٍ فيه حصةٌ ملغاة «ناقصاً» أبداً مهما اكتمل.
   * والمجدولة لم تُدرَّس بعد، فخانتُها الفارغة انتظارٌ لا إهمالُ تدوين.
   *
   * وهذا نفسه ما يفعله الخادم حين يخلّص، فما يُطبع هنا يطابق مستحقّ
   * الأستاذ هناك.
   */
  const counted = useMemo(() => heldSessions(sessions), [sessions]);

  /** مجال الكشف بتاريخيه — ما يُعرض للمستخدم بدل اسم شهر */
  const range = useMemo(() => sheetRange(counted), [counted]);

  const rows = useMemo<FeeRow[]>(
    () =>
      enrollments.map((enrollment) => {
        const invoice = invoices.get(enrollment.id);
        const { attended, absent, blank } = attendanceOf(enrollment.id, counted, cells);

        return {
          enrollment,
          invoice,
          state: feeStateOf(invoice),
          attended,
          absent,
          blank,
          paidOn: paidOnOf(invoice),
        };
      }),
    [enrollments, invoices, counted, cells],
  );

  /**
   * امتلاء الكشف — محسوبٌ لا مخزَّن.
   *
   * وليس «انتهى الشهر»: الشهر لا يُنهي شيئاً، والتقويم لا يعرف متى
   * فرغ الأستاذ من فوجه. الكشف وعاءٌ تُرسَل إليه حصصٌ بعدد ما قرّرته
   * المؤسسة، فيمتلئ حين تصله كلُّها ويُدوَّن فيها حضورُ كلِّ مسجَّل.
   *
   * وأثرُه على الورقة لا على الشاشة وحدها: «ع.ح» في كشفٍ لم يمتلئ رقمٌ
   * ناقص، يُوقَّع عليه كأنّه نهائي.
   */
  const filling = useMemo<SheetFilling>(() => {
    const planned = sheet?.sessionCount ?? 0;
    const arrived = counted.length;
    const undated = rows.reduce((sum, row) => sum + row.blank, 0);

    return {
      planned,
      arrived,
      awaited: Math.max(0, planned - arrived),
      undated,
      full: planned > 0 && arrived >= planned && undated === 0,
    };
  }, [sheet, counted, rows]);

  /** ما يُقرأ قبل إهدار ورقة — أو `null` إن امتلأ الكشف */
  const printWarning = useMemo(() => {
    if (filling.full) return null;

    const parts: string[] = [];

    if (filling.awaited > 0) {
      parts.push(`${filling.awaited} حصة لم تصل الكشف بعد`);
    }
    if (filling.undated > 0) {
      parts.push(`${filling.undated} خانة حضور لم تُدوَّن`);
    }

    if (parts.length === 0) return null;

    return `الكشف لم يمتلئ بعد: ${parts.join("، ")}. عمود «ع.ح» في الورقة سيخرج ناقصاً — أكمل التدوين في كشف الحضور اليومي، أو اطبعها على علمٍ بذلك.`;
  }, [filling]);

  const totals = useMemo(() => {
    let paid = 0;
    let due = 0;
    let remaining = 0;
    let missing = 0;

    for (const row of rows) {
      if (row.state === "PAID") paid++;
      if (row.state === "DUE" || row.state === "PARTIAL") due++;
      if (row.state === "NONE") missing++;
      remaining += row.invoice?.remaining ?? 0;
    }

    return { paid, due, remaining, missing };
  }, [rows]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 2600);
  };

  /**
   * توليد فواتير الشهر لهذا الفوج.
   *
   * الخادم يولّد لكل مواد الفوج لا لهذه المادة وحدها — وهو الصواب:
   * الشهر يُفوتَر مرّةً للفوج كلّه، وتوليدُ مادةٍ مادةً كان سيترك
   * فواتيرَ ناقصةً كلّما نُسي أستاذ. والعملية Idempotent: القائم
   * يُتخطّى ولا يُكرَّر، فالضغط مرّتين لا يضاعف شيئاً.
   */
  const generate = async () => {
    if (!assignment || !period || !yearId) return;

    setGenerating(true);
    setError(null);

    try {
      const result = await generateInvoices({
        academicYearId: yearId,
        month: period.month,
        year: period.year,
        studyGroupIds: [assignment.studyGroup.id],
      });

      await loadInvoices();

      const noFee = result.skippedNoFee.length;

      flash(
        `وُلِّدت ${result.created} فاتورة` +
          (result.skippedExisting > 0 ? ` · ${result.skippedExisting} كانت موجودة` : "") +
          (noFee > 0 ? ` · ${noFee} بلا حقّ اشتراك` : ""),
      );

      /*
       * السبب لا العدد.
       *
       * «15 تسجيلاً بلا حقّ اشتراك» صحيحٌ ولا يُفيد: المستخدم يرى
       * التسعيرة أمامه في القائمة فيظنّ الخلل في النظام. والسببُ
       * الغالب تاريخُ السريان — سعرٌ يبدأ بعد الشهر المطلوب.
       */
      if (noFee > 0) {
        const why = (result.feeDiagnoses ?? [])
          .map((d) => `• ${d.subject} — ${d.studyGroup} (${d.students} طالباً): ${d.reason}`)
          .join("\n");

        setError(
          `${noFee} تسجيلاً لم تُولَّد فاتورته:\n${why || "اضبط السعر من المالية ← حقوق الاشتراك ثمّ أعد التوليد."}`,
        );
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر توليد الفواتير");
    } finally {
      setGenerating(false);
    }
  };

  const ready = Boolean(assignment && sheet);
  const printable = ready && rows.length > 0;

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="كشف دفع الحقوق الشهري" subtitle="حصصُ الشهر · الدفع · الإمضاء">
        <button
          onClick={() => exitTo(PATHS.attendance)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-[1600px] p-6">
        {/* ================= المرشِّحات ================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
          className="mb-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field label="السنة الدراسية">
              <select value={yearId} onChange={(e) => setYearId(e.target.value)} className={selectClass}>
                {years.map((y) => (
                  <option key={y.id} value={y.id} className="bg-[#0a0f1a]">
                    {y.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="الطور">
              <Picker value={filters.stageId} onChange={(v) => setFilter("stageId", v)} items={options.stages} all="كل الأطوار" />
            </Field>

            <Field label="المستوى">
              <Picker value={filters.levelId} onChange={(v) => setFilter("levelId", v)} items={options.levels} all="كل المستويات" />
            </Field>

            <Field label="المادة">
              <Picker value={filters.subjectId} onChange={(v) => setFilter("subjectId", v)} items={options.subjects} all="اختر المادة" />
            </Field>

            <Field label="الأستاذ">
              <Picker
                value={filters.teacherId}
                onChange={(v) => setFilter("teacherId", v)}
                items={options.teachers.map((t) => ({ id: t.id, name: fullName(t) }))}
                all="اختر الأستاذ"
              />
            </Field>

            <Field label="الفوج">
              <Picker value={filters.groupId} onChange={(v) => setFilter("groupId", v)} items={options.groups} all="اختر الفوج" />
            </Field>

            {/* الكشف بدل الشهر: وحدةٌ إدارية لا مدىً تقويمي */}
            {assignment && (
              <Field label="الكشف">
                <select
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  className={selectClass}
                  disabled={sheets.length === 0}
                >
                  {sheets.length === 0 ? (
                    <option value="" className="bg-[#0a0f1a]">لا كشوف بعد</option>
                  ) : (
                    sheets.map((s) => (
                      <option key={s.id} value={s.id} className="bg-[#0a0f1a]">
                        {sheetTitle(s)}
                      </option>
                    ))
                  )}
                </select>
              </Field>
            )}

            {(loadingRefs || loading) && <Loader2 className="mb-2.5 h-4 w-4 animate-spin text-white/40" />}
          </div>
        </motion.div>

        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {/* whitespace-pre-line: التشخيص سطرٌ لكل فوج */}
            <span className="whitespace-pre-line leading-relaxed">{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        )}

        {!assignment ? (
          <Empty
            title="اختر المادة والأستاذ والفوج"
            hint="الكشف يُبنى على الإسناد التدريسي — منه تُقرأ الحصص والمسجَّلون والحقوق."
          />
        ) : sheets.length === 0 ? (
          <Empty
            title="لا كشوف لهذا الإسناد"
            hint="أنشئ كشف الحضور أولاً من «كشف الحضور اليومي» — منه تأتي حصص الشهر."
          />
        ) : (
          <>
            {/* ================= ترويسة الكشف ================= */}
            {sheet && (
              <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-2.5 text-sm">
                  <Meta label="المؤسسة" value={schoolName} strong />
                  <Meta label="المادة" value={assignment.subject.name} strong />
                  <Meta label="الأستاذ" value={fullName(assignment.teacher)} />
                  <Meta label="المستوى" value={assignment.studyGroup.level.name} />
                  <Meta label="الفوج" value={assignment.studyGroup.name} />
                  <Meta label="الشهر" value={sheetMonthLabel(sheet)} strong />
                  <Meta label="الحصص" value={`${filling.arrived} / ${filling.planned}`} />

                  {/* الامتلاء — يُقرأ قبل الطباعة لا بعدها */}
                  <span
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold"
                    style={
                      filling.full
                        ? { background: "rgba(134,239,172,0.14)", color: ACCENT }
                        : { background: "rgba(252,211,77,0.14)", color: "#fcd34d" }
                    }
                  >
                    {filling.full ? (
                      <CircleCheckBig className="h-3.5 w-3.5" />
                    ) : (
                      <TriangleAlert className="h-3.5 w-3.5" />
                    )}
                    {fillingLabel(filling)}
                  </span>
                </div>

                {/*
                  مجال الكشف أوّلاً، ثمّ ربطُه بالفاتورة.

                  الترتيب مقصود: الكشف **فترة** لا شهر، ومن رأى «ديسمبر»
                  وحده ظنّ حصص جانفي ضائعةً وهي في هذا الكشف نفسه. فيُعرض
                  المجال بتاريخيه صريحاً، ويبقى الشهر تحته لأنّه لا يخصّ
                  الكشف بل الفاتورة التي لا تعرف إلّا الشهور.
                */}
                <div className="mb-4 space-y-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <CalendarRange className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                    <span className="text-xs text-white/60">مجال الكشف</span>

                    {range ? (
                      <>
                        <span className="font-black" dir="ltr">
                          {feeDate(range.from)} — {feeDate(range.to)}
                        </span>
                        <span className="text-[11px] text-white/35">
                          {spanLabel(range)} · {filling.arrived} حصة وصلت الكشف
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-amber-200">
                        لا حصص في هذا الكشف بعد — أرسل إليه حصصه من كشف الحضور اليومي
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-3">
                    <Wallet className="h-4 w-4 shrink-0 text-white/40" />
                    <span className="text-xs text-white/60">حقوقه تُقرأ من فواتير شهر</span>

                    <select
                      value={period?.month ?? ""}
                      disabled={!period}
                      onChange={(e) => {
                        setOverridden(true);
                        setPeriod((p) => ({
                          month: Number(e.target.value),
                          year: p?.year ?? new Date().getFullYear(),
                        }));
                      }}
                      className={selectClass}
                    >
                      {!period && <option value="" className="bg-[#0a0f1a]">—</option>}
                      {MONTHS.map((name, i) => (
                        <option key={name} value={i + 1} className="bg-[#0a0f1a]">{name}</option>
                      ))}
                    </select>

                    <input
                      type="number"
                      value={period?.year ?? ""}
                      disabled={!period}
                      placeholder="السنة"
                      onChange={(e) => {
                        setOverridden(true);
                        setPeriod((p) => ({ month: p?.month ?? 1, year: Number(e.target.value) }));
                      }}
                      className={`${selectClass} w-24`}
                    />

                    <span className="text-[11px] text-white/35">
                      {overridden
                        ? "شهرٌ مختار يدوياً"
                        : "الفاتورة شهريّة في النظام، فتُقيَّد حقوق الفترة في شهر أوّل حصة منها"}
                    </span>

                  {totals.missing > 0 && (
                    <span className="ms-auto flex items-center gap-3">
                      <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-200">
                        {totals.missing} طالباً بلا فاتورة في هذا الشهر
                      </span>

                      {can("invoice.create") && (
                        <button
                          onClick={generate}
                          disabled={generating}
                          title="يولّد فواتير هذا الشهر لكل مواد الفوج — والموجود لا يتكرّر"
                          className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black text-[#04251a] transition hover:brightness-110 disabled:opacity-40"
                          style={{ background: ACCENT }}
                        >
                          {generating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FilePlus2 className="h-4 w-4" />
                          )}
                          ولّد فواتير الشهر
                        </button>
                      )}
                    </span>
                  )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => {
                      loadSheet();
                      loadInvoices();
                    }}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-white/10"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    تحديث
                  </button>

                  {/*
                    الطباعة تمرّ بالمعاينة دائماً — لا زرَّ يطبع مباشرة.
                    الورقة تُقرأ قبل أن تُتلَف، وفي المعاينة نفسها زرُّ
                    الطباعة وتنبيهُ النقص.
                  */}
                  <button
                    onClick={() => setPreviewing(true)}
                    disabled={!printable}
                    className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-[#04251a] transition hover:brightness-110 disabled:opacity-35"
                    style={{ background: ACCENT }}
                  >
                    <Printer className="h-4 w-4" />
                    معاينة وطباعة
                  </button>

                  <span className="ms-auto flex flex-wrap items-center gap-4 text-xs">
                    <span className="text-white/50">
                      خالص: <span className="font-black" style={{ color: ACCENT }}>{totals.paid}</span>
                    </span>
                    <span className="text-white/50">
                      غير خالص: <span className="font-black text-rose-300">{totals.due}</span>
                    </span>
                    <span className="text-white/50">
                      المتبقّي: <span className="font-black text-white/85">{money(totals.remaining)}</span>
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* ================= الجدول ================= */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-white/50">
                    <th className="w-12 px-3 py-3 text-center font-bold">ترتيب</th>
                    <th className="px-4 py-3 text-start font-bold">اللقب والاسم</th>
                    <th className="w-20 px-3 py-3 text-center font-bold">حضر</th>
                    <th className="w-20 px-3 py-3 text-center font-bold">غاب</th>
                    <th className="w-28 px-3 py-3 text-center font-bold">المبلغ</th>
                    <th className="w-28 px-3 py-3 text-center font-bold">المتبقّي</th>
                    <th className="w-28 px-3 py-3 text-center font-bold">الحالة</th>
                    <th className="w-28 px-3 py-3 text-center font-bold">تاريخ الدفع</th>
                    <th className="w-32 px-3 py-3" />
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center text-white/50">
                        لا مسجَّلين في هذا الإسناد
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
                      const tone = FEE_TONE[row.state];

                      return (
                        <tr
                          key={row.enrollment.id}
                          className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
                        >
                          <td className="px-3 py-2.5 text-center text-white/40">{index + 1}</td>
                          <td className="px-4 py-2.5 font-bold">{fullName(row.enrollment.student)}</td>
                          <td className="px-3 py-2.5 text-center font-black" style={{ color: ACCENT }}>
                            {row.attended}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-rose-300/80">
                            {row.absent || ""}
                          </td>
                          <td className="px-3 py-2.5 text-center text-white/70">
                            {row.invoice ? money(row.invoice.total) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold">
                            {row.invoice ? money(row.invoice.remaining) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                              style={{ background: tone.bg, color: tone.fg }}
                            >
                              {FEE_LABEL[row.state]}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-white/60" dir="ltr">
                            {feeDate(row.paidOn) || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {can("payment.create") && row.invoice && row.state !== "PAID" && (
                              <button
                                onClick={() => setPaying(row)}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black text-[#04251a] transition hover:brightness-110"
                                style={{ background: ACCENT }}
                              >
                                <Check className="h-3.5 w-3.5" />
                                تأكيد الدفع
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-white/30">
              <Info className="h-3.5 w-3.5" />
              الخانة الفارغة في كشف الحضور ليست غياباً — لا تُحسب حاضراً ولا غائباً
            </p>
          </>
        )}
      </div>

      {/* ================= المعاينة والورقة ================= */}
      {previewing && sheet && assignment && (
        <SheetPreview
          title="كشف دفع الحقوق الشهري"
          subtitle={`${assignment.subject.name} · ${assignment.studyGroup.level.name} · ${assignment.studyGroup.name} · الشهر ${sheetMonthLabel(sheet)}`}
          warning={printWarning}
          onClose={() => setPreviewing(false)}
        >
          <FeesSheetPrint
            schoolName={schoolName}
            assignment={assignment}
            sheet={sheet}
            rows={rows}
            logo={logo}
          />
        </SheetPreview>
      )}

      {paying && paying.invoice && (
        <PayDialog
          row={paying}
          onClose={() => setPaying(null)}
          onDone={async (message) => {
            setPaying(null);
            await loadInvoices();
            flash(message);
          }}
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
// تأكيد الدفع
//
// دفعةٌ حقيقية بتاريخها وطريقتها، لا علامةٌ على ورقة: الخادم يخصمها من
// الفاتورة ويُخرج إيصالها. والمبلغ افتراضاً كامل المتبقّي لأنّ الغالب في
// الشبّاك أن يدفع الطالب حقّه كاملاً — والجزئي يُكتب بيده.
// --------------------------------------------------

function PayDialog({
  row,
  onClose,
  onDone,
}: {
  row: FeeRow;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const invoice = row.invoice!;

  const [amount, setAmount] = useState(String(invoice.remaining));
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number(amount);
  const invalid = !Number.isFinite(value) || value <= 0 || value > invoice.remaining;

  const submit = async () => {
    setBusy(true);
    setError(null);

    try {
      await createPayment({
        allocations: [{ invoiceId: invoice.id, paidAmount: value }],
        paymentMethod: method,
        paymentDate: date,
      });

      onDone(
        value >= invoice.remaining
          ? `خالص — ${fullName(row.enrollment.student)}`
          : `دفعة جزئية — ${fullName(row.enrollment.student)}`,
      );
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر تسجيل الدفعة");
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
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-115 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0a0f1a] p-6"
      >
        <h3 className="mb-1 text-lg font-black">تأكيد الدفع</h3>
        <p className="mb-5 text-xs leading-relaxed text-white/45">
          <span className="font-bold text-white/80">{fullName(row.enrollment.student)}</span> —
          فاتورة {invoice.invoiceNumber}. المتبقّي {money(invoice.remaining)} من{" "}
          {money(invoice.total)}.
        </p>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">المبلغ المدفوع</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">تاريخ الدفع</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">طريقة الدفع</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none"
            >
              <option value="CASH" className="bg-[#0a0f1a]">نقداً</option>
              <option value="CARD" className="bg-[#0a0f1a]">بطاقة</option>
              <option value="BANK_TRANSFER" className="bg-[#0a0f1a]">تحويل بنكي</option>
            </select>
          </label>

          {error && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm leading-relaxed text-rose-200">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={submit}
              disabled={busy || invalid}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 font-black text-[#04251a] transition hover:brightness-110 disabled:opacity-40"
              style={{ background: ACCENT }}
            >
              {busy ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Check className="h-4.5 w-4.5" />}
              تأكيد
            </button>
            <button
              onClick={onClose}
              className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
            >
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// --------------------------------------------------
// الورقة المطبوعة — نقلاً عن الأصل حرفياً
//
// نصفان على ورقةٍ واحدة: 1..26 يميناً و27..52 يساراً، بفاصلٍ ثخين
// بينهما. وهي ليست زخرفة: الورقة الأصلية تُملأ بالقلم في الشبّاك،
// ومن اعتاد أن يجد الطالب رقم 30 في أعلى النصف الأيسر يضيع إن نُقل.
// --------------------------------------------------

const ROWS_PER_BLOCK = 26;
const ROWS_PER_PAGE = ROWS_PER_BLOCK * 2;

function FeesSheetPrint({
  schoolName,
  assignment,
  sheet,
  rows,
  logo,
}: {
  schoolName: string;
  assignment: Assignment;
  sheet: Sheet;
  rows: FeeRow[];
  logo: LogoSpec;
}) {
  const count = Math.max(rows.length, ROWS_PER_PAGE);
  const pages = Math.ceil(count / ROWS_PER_PAGE);
  const printedOn = new Date().toLocaleDateString("fr-DZ");

  /* الشعار على الورقة أكبر منه على الإيصال — 297mm لا 80mm */
  const logoWidth = Math.max(24, Math.round(logo.widthMm * 1.4));

  return (
    <div className="sheet-print" dir="rtl">
      {Array.from({ length: pages }).map((_, page) => (
        <section className="sheet-page" key={page}>
          <header className="sheet-print-top">
            <div className="sheet-print-side">
              <span>المستوى : {assignment.studyGroup.level.name}</span>
              <span>الشهر : {sheetMonthLabel(sheet)}</span>
              <span className="sheet-print-printed">حُرِّر في {printedOn}</span>
            </div>

            <div className="sheet-print-center">
              {logo.src && (
                <img
                  src={logo.src}
                  alt=""
                  className="sheet-print-logo"
                  style={{ width: `${logoWidth}mm`, filter: logo.filter }}
                />
              )}
              <h1>{schoolName}</h1>
              <div className="sheet-print-year">{assignment.academicYear.name}</div>
              <h2>كشف دفع الحقوق الشهري للطلبة</h2>
            </div>

            <div className="sheet-print-side sheet-print-side-end">
              <span>المادة : {assignment.subject.name}</span>
              <span>الأستاذ : {fullName(assignment.teacher)}</span>
              <span>الفوج : {assignment.studyGroup.name}</span>
            </div>
          </header>

          <table className="sheet-print-table">
            <thead>
              <tr>
                {[0, 1].map((block) => (
                  <Fragment key={block}>
                    <th style={{ width: "4%" }}>ترتيب</th>
                    <th style={{ width: "15%" }}>اللقب والاسم</th>
                    <th style={{ width: "5%" }}>ع . ح</th>
                    <th style={{ width: "9%" }}>الامضاء</th>
                    <th style={{ width: "9%" }}>التاريخ</th>
                    <th
                      style={{ width: "8%" }}
                      className={block === 0 ? "fees-print-split" : undefined}
                    >
                      الحالة
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {Array.from({ length: ROWS_PER_BLOCK }).map((_, offset) => (
                <tr key={offset}>
                  {[0, 1].map((block) => {
                    const index = page * ROWS_PER_PAGE + block * ROWS_PER_BLOCK + offset;
                    const row = rows[index];

                    /* صفٌّ مرقَّم فارغ — الورقة تُطبع كاملةً وتُملأ بالقلم */
                    return (
                      <Fragment key={block}>
                        <td className="c">{index + 1}</td>
                        <td>{row ? fullName(row.enrollment.student) : ""}</td>
                        <td className="c b">{row ? row.attended : ""}</td>
                        <td />
                        <td className="c">{row ? feeDate(row.paidOn) : ""}</td>
                        <td
                          className={`c${block === 0 ? " fees-print-split" : ""}`}
                        >
                          {row ? FEE_PRINT[row.state] : ""}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <footer className="sheet-print-foot">
            {pages > 1 ? `الصفحة ${page + 1} من ${pages}` : "الصفحة 1"}
          </footer>
        </section>
      ))}
    </div>
  );
}

// --------------------------------------------------

const selectClass =
  "rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-bold outline-none transition focus:border-white/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold text-white/45">{label}</span>
      {children}
    </label>
  );
}

function Picker({
  value,
  onChange,
  items,
  all,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { id: string; name: string }[];
  all: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      <option value="" className="bg-[#0a0f1a]">{all}</option>
      {items.map((i) => (
        <option key={i.id} value={i.id} className="bg-[#0a0f1a]">{i.name}</option>
      ))}
    </select>
  );
}

function Meta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[11px] text-white/40">{label}:</span>
      <span className={strong ? "font-black" : "font-bold text-white/85"}>{value || "—"}</span>
    </span>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
      <BadgeDollarSign className="mb-3 h-11 w-11 text-white/15" />
      <p className="text-white/60">{title}</p>
      <p className="mt-1.5 max-w-md text-xs text-white/35">{hint}</p>
    </div>
  );
}
