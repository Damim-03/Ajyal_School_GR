import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
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
import { usePagedBlocks } from "../../components/print/paged-sheet";
import { printedStamp } from "../../components/print/printed-at";
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
import { SheetScanner } from "./components/sheet-scan";
import { useSheetJump } from "./hooks/use-sheet-jump";
import { PaymentDoneDialog } from "./components/payment-receipt";
import { formatInputAmount } from "../../core/utils/money";
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
  type Payment,
  type PaymentMethod,
} from "../finance/finance.api";
import {
  deriveOptions,
  filterSummary,
  fullName,
  getSheet,
  isoDate,
  listAssignments,
  listAttendance,
  listEnrollments,
  listSheets,
  resolveAssignment,
  sheetCode,
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
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.hasPermission);
  const schoolName = useSchool("school.name_ar");

  /* الانتقاء على settings لا على ناتج logoSpec — الأخير كائن جديد كل مرّة */
  const logo = logoSpec(useSchoolStore((s) => s.settings));

  const yearsQuery = useAcademicYears();
  const years = yearsQuery.data ?? [];

  const [yearId, setYearId] = useState("");
  const [filters, setFilters] = useState<SheetFilters>(EMPTY_FILTERS);
  /** بحثٌ داخل الكشف — عرضٌ لا حذف: المجاميع والورقة على الكشف كلِّه */
  const [search, setSearch] = useState("");
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

  /*
   * الدفعة المقبوضة للتوّ — تبقى معروضةً حتّى تُقرأ أرقامُها.
   *
   * السطرُ الأخضر العابر لا يكفي في الشبّاك: الوليُّ ينتظر ورقته،
   * والإدارة تحتاج رقم الإيصال الذي حُفظ في المالية.
   */
  const [received, setReceived] = useState<Payment | null>(null);
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

  /* المسح ينقل الشاشة إلى كشفٍ آخر — انظر `use-sheet-jump` */
  const { jumpTo, jumping } = useSheetJump({
    assignments,
    sheets,
    setYearId,
    setFilters,
    setSheetId,
  });

  // --------------------------------------------------
  // كشوف الإسناد
  // --------------------------------------------------

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

  /**
   * ورقةٌ فارغة — لا حضورَ دُوِّن بعد.
   *
   * فعمود «ع.ح» يخرج فارغاً لا أصفاراً: الصفر يُقرأ «حضر لا شيء» وهو
   * خبرٌ عن الطالب، والحقيقةُ أنّ أحداً لم يدوّن بعد. والورقة في هذه
   * الحال ذاهبةٌ إلى الشبّاك أو إلى الأستاذ لتُملأ بالقلم.
   */
  const blankForm = cells.size === 0;

  /** ما يُقرأ قبل إهدار ورقة — أو `null` إن امتلأ الكشف */
  const printWarning = useMemo(() => {
    if (filling.full) return null;

    /* لا تدوينَ أصلاً: ورقةٌ للملء بالقلم، لا كشفٌ ناقص */
    if (blankForm) {
      return "لا حضورَ مدوَّناً في هذا الكشف بعد، فعمود «ع.ح» يخرج فارغاً ليُملأ بالقلم. أكمل التدوين في كشف الحضور اليومي إن أردتها محسوبة.";
    }

    const parts: string[] = [];

    if (filling.awaited > 0) {
      parts.push(`${filling.awaited} حصة لم تصل الكشف بعد`);
    }
    if (filling.undated > 0) {
      parts.push(`${filling.undated} خانة حضور لم تُدوَّن`);
    }

    if (parts.length === 0) return null;

    return `الكشف لم يمتلئ بعد: ${parts.join("، ")}. عمود «ع.ح» في الورقة سيخرج ناقصاً — أكمل التدوين في كشف الحضور اليومي، أو اطبعها على علمٍ بذلك.`;
  }, [filling, blankForm]);

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

  /** ما يبقى مقروءاً حين يُطوى لوح المرشِّحات */
  const chips = useMemo<FilterChip[]>(() => {
    const year = years.find((y) => y.id === yearId);

    return [
      ...(year ? [{ label: "السنة", value: year.name }] : []),
      ...filterSummary(options, filters),
      ...(sheet ? [{ label: "الكشف", value: sheetTitle(sheet) }] : []),
    ];
  }, [years, yearId, options, filters, sheet]);

  /**
   * صفوفُ العرض — مصفّاةً بالبحث ومحتفظةً بترتيبها في الكشف.
   *
   * والمجاميع وشريط الطباعة يقرآن `rows` كاملةً: البحثُ نظرةٌ في الجدول
   * لا اقتطاعٌ من الكشف، ولو تبع المجموعُ البحثَ لخرجت «المتبقّي» رقماً
   * يخصّ طالباً واحداً في موضعٍ يُقرأ على أنّه حصيلةُ الفوج.
   */
  const visible = useMemo(
    () =>
      rows
        .map((row, index) => ({ row, order: index + 1 }))
        .filter((item) => matchesQuery(fullName(item.row.enrollment.student), search)),
    [rows, search],
  );

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
        <FilterPanel
          accent={ACCENT}
          storageKey="attendance.fees"
          collapseKey={assignment?.id ?? ""}
          busy={loadingRefs || loading}
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
              items={options.teachers.map((t) => ({ id: t.id, name: fullName(t) }))}
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

          {/* الكشف بدل الشهر: وحدةٌ إدارية لا مدىً تقويمي */}
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
                    الجسر إلى مستحقّ الأستاذ.

                    الورقتان وجهان لكشفٍ واحد: هذه تقول مَن سدَّد من الطلبة،
                    وتلك تقول كم يستحقّ أستاذُهم منه. والانتقال كان يعني
                    إعادةَ اختيار خمسة مرشِّحاتٍ في الشاشة الأخرى — فالرابط
                    يحمل السنة والإسناد والكشف، وتفتح الشاشةُ على نفس الورقة.
                  */}
                  {assignment && sheet && (
                    <button
                      onClick={() =>
                        navigate(
                          `${PATHS.attendanceExpected}?y=${yearId}&a=${assignment.id}&s=${sheet.id}`,
                        )
                      }
                      title="مستحقّ الأستاذ عن هذا الكشف بعينه"
                      className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-sky-500/15 hover:text-sky-200"
                    >
                      <CalendarClock className="h-4 w-4" />
                      الكشف التقديري لهذا الكشف
                    </button>
                  )}

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
              {/* البحث فوق الجدول — يبقى ظاهراً ولو طُوي لوح المرشِّحات */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  shown={visible.length}
                  total={rows.length}
                  accent={ACCENT}
                />

                <span className="text-[11px] text-white/35">
                  {rows.length} مسجَّلاً — المجاميع أعلاه على الكشف كلِّه
                </span>
              </div>

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
                  ) : visible.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center text-white/40">
                        لا طالب باسم «{search.trim()}» في هذا الكشف
                      </td>
                    </tr>
                  ) : (
                    visible.map(({ row, order }) => {
                      const tone = FEE_TONE[row.state];

                      return (
                        <tr
                          key={row.enrollment.id}
                          className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
                        >
                          <td className="px-3 py-2.5 text-center text-white/40">{order}</td>
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
          onRefresh={async () => {
            /* الحضور والمال معاً — الورقة تجمعهما فلا يُحدَّث أحدهما وحده */
            await Promise.all([loadSheet(), loadInvoices()]);
          }}
          onClose={() => setPreviewing(false)}
        >
          <FeesSheetPrint
            schoolName={schoolName}
            assignment={assignment}
            sheet={sheet}
            rows={rows}
            blankForm={blankForm}
            logo={logo}
          />
        </SheetPreview>
      )}

      {paying && paying.invoice && (
        <PayDialog
          row={paying}
          onClose={() => setPaying(null)}
          onDone={async (message, payment) => {
            /* الإيصال أوّلاً: الوليُّ واقفٌ ينتظر، وإعادةُ جلب الفواتير تأخذ وقتها */
            setPaying(null);
            setReceived(payment);
            flash(message);
            await loadInvoices();
          }}
        />
      )}

      {received && (
        <PaymentDoneDialog payment={received} onClose={() => setReceived(null)} />
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
  onDone: (message: string, payment: Payment) => void;
}) {
  const invoice = row.invoice!;

  /*
   * المبلغ يُكتب بمنزلتيه كما يُعرض في كل موضعٍ آخر.
   *
   * كان يُعرض خاماً — «1500» في حقلٍ بجانبه «المتبقّي 1,500.00 دج» —
   * فيقرأ الموظّف رقمين بصيغتين ويتردّد: أهو نفسُه أم نصفُه؟ والحقل
   * يُعاد تنسيقه عند الخروج منه فيطابق ما سيُحفظ.
   */
  const [amount, setAmount] = useState(() => formatInputAmount(invoice.remaining));
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
      const payment = await createPayment({
        allocations: [{ invoiceId: invoice.id, paidAmount: value }],
        paymentMethod: method,
        paymentDate: date,
      });

      onDone(
        value >= invoice.remaining
          ? `خالص — ${fullName(row.enrollment.student)}`
          : `دفعة جزئية — ${fullName(row.enrollment.student)}`,
        payment,
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
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => {
                const typed = Number(amount);
                if (Number.isFinite(typed) && amount.trim() !== "") {
                  setAmount(formatInputAmount(typed));
                }
              }}
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

/**
 * عُرفُ الورقة الأصلية: ستّةٌ وعشرون في النصف الواحد.
 *
 * وهو **سقفٌ لا سعةٌ مضمونة**: السعة تُقاس بعد الرسم، لأنّ اسماً طويلاً
 * يلتفّ سطرين فيصير الصفّ ضعفَ ارتفاعه. انظر `usePagedBlocks` في
 * `components/print/paged-sheet`.
 */
const ROWS_PER_BLOCK = 26;

function FeesSheetPrint({
  schoolName,
  assignment,
  sheet,
  rows,
  blankForm,
  logo,
}: {
  schoolName: string;
  assignment: Assignment;
  sheet: Sheet;
  rows: FeeRow[];
  /** لا حضورَ دُوِّن — فالمحسوب من الحضور يخرج فارغاً ليُكتب بالقلم */
  blankForm: boolean;
  logo: LogoSpec;
}) {
  const printedOn = printedStamp();

  /* الشعار على الورقة أكبر منه على الإيصال — 297mm لا 80mm */
  const logoWidth = Math.max(24, Math.round(logo.widthMm * 1.4));

  /* بصمةُ ما يغيّر ارتفاع الصفوف — الأسماء وحدها في هذا الكشف */
  const signature = rows.map((row) => fullName(row.enrollment.student)).join("|");

  const { measureRef, perBlock } = usePagedBlocks(signature, ROWS_PER_BLOCK);

  const header = (
    <header className="sheet-print-top">
      <div className="sheet-print-side">
        <span>المستوى : {assignment.studyGroup.level.name}</span>
        <span>الشهر : {sheetMonthLabel(sheet)}</span>
        <span className="sheet-print-printed">حُرِّر في {printedOn}</span>
        <SheetBarcode code={sheetCode(sheet)} />
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
  );

  const columns = (
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
  );

  /** صفٌّ يحمل طالبين: يمينُ الورقة ويسارُها */
  const bodyRow = (offset: number, base: number, blockSize: number) => (
    <tr key={offset}>
      {[0, 1].map((block) => {
        const index = base + block * blockSize + offset;
        const row = rows[index];

        /* صفٌّ مرقَّم فارغ — الورقة تُطبع كاملةً وتُملأ بالقلم */
        return (
          <Fragment key={block}>
            <td className="c">{index + 1}</td>
            <td>{row ? fullName(row.enrollment.student) : ""}</td>
            <td className="c b">{row && !blankForm ? row.attended : ""}</td>
            <td />
            <td className="c">{row ? feeDate(row.paidOn) : ""}</td>
            <td className={`c${block === 0 ? " fees-print-split" : ""}`}>
              {row ? FEE_PRINT[row.state] : ""}
            </td>
          </Fragment>
        );
      })}
    </tr>
  );

  /*
   * طورُ القياس — نصفٌ واحد بنصف المسجَّلين، فيمرّ كلُّ اسمٍ بالقياس.
   * لا تُرى ولا تُطبع ولا تحمل صنف `.sheet-page` فلا تُعدّ ورقةً.
   */
  if (!perBlock) {
    const half = Math.max(1, Math.ceil(Math.max(rows.length, ROWS_PER_BLOCK * 2) / 2));

    return (
      <div className="sheet-print" dir="rtl">
        <div className="sheet-measure" ref={measureRef}>
          <section className="sheet-measure-page" data-measure-page="">
            {header}

            <table className="sheet-print-table">
              {columns}
              <tbody>{Array.from({ length: half }, (_, offset) => bodyRow(offset, 0, half))}</tbody>
            </table>

            <footer className="sheet-print-foot" data-measure-foot="">
              الصفحة 1 من 1
            </footer>
          </section>
        </div>
      </div>
    );
  }

  const perPage = perBlock * 2;
  const count = Math.max(rows.length, perPage);
  const pages = Math.ceil(count / perPage);

  return (
    <div className="sheet-print" dir="rtl">
      {Array.from({ length: pages }).map((_, page) => (
        <section className="sheet-page" key={page}>
          {header}

          <table className="sheet-print-table">
            {columns}
            <tbody>
              {Array.from({ length: perBlock }, (_, offset) =>
                bodyRow(offset, page * perPage, perBlock),
              )}
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

/* حقول المرشِّحات وقوائمها في components/shared/FilterPanel — و`selectClass` باقٍ لحقول تصحيح الشهر */

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
