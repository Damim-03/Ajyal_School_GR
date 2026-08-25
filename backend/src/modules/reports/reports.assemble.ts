import {
  attendance as attendanceMetric,
  cashCollected,
  cashFlow,
  change,
  debt,
  invoicing,
  teacherFinancials,
  toNumber,
  yearMonthKey,
} from "../../core/reporting";
import {
  ReportChart,
  SummaryValue,
  chart,
  metric,
  summaryOf,
} from "./reports.contract";
import type {
  FinancialSnapshot,
  TeacherSnapshot,
} from "./reports.queries";
import type { AttendanceCounts } from "../../core/reporting";

// ======================================================
// التجميع — دوالُّ نقيّة
//
// الفصلُ عن الجلب مقصود. لو بُني المظروفُ داخل الخدمة التي تستعلم،
// لما أمكن اختبارُ شيءٍ منه بلا قاعدة بيانات — ولا قاعدةَ فيها
// بيانات بعد، ولا حصّةَ اتصالاتٍ تحتمل اختباراً يفتح وصلةً لكل
// حالة.
//
// فهنا تُختبر أسئلةٌ حقيقية بلا وصلةٍ واحدة: هل استُثني الملغى من
// المجموع؟ هل صارت النسبةُ `null` حين لا فواتير؟ هل ظهر الرسمُ
// فارغاً حين كلُّ قيمه صفر؟
// ======================================================

// --------------------------------------------------
// أداةُ المقارنة
// --------------------------------------------------

/**
 * بطاقةٌ بمقارنتها.
 *
 * `previous` قد تكون `undefined` حين لا مقارنةَ مطلوبة، و`null`
 * حين طُلبت ولم تُحسب. والحالتان تُنتجان بطاقةً بلا مقارنة — لكنّ
 * التمييزَ بينهما يبقى في `meta.comparison`.
 */
const compared = (
  key: string,
  current: number | null,
  previous?: number | null,
): SummaryValue => {
  if (previous === undefined) return metric(key, current);

  const delta = change(current ?? 0, previous ?? 0);

  return metric(key, current, {
    previous: previous ?? null,
    absolute: delta.absolute,
    percentage: delta.percentage,
  });
};

// --------------------------------------------------
// المالية
// --------------------------------------------------

export type FinancialSummaryInput = {
  current: FinancialSnapshot;
  previous?: FinancialSnapshot;
};

export const assembleFinancialSummary = ({
  current,
  previous,
}: FinancialSummaryInput) => {
  const now = invoicing(current.invoices);
  const cash = cashCollected(current.payments);

  const before = previous ? invoicing(previous.invoices) : undefined;
  const cashBefore = previous ? cashCollected(previous.payments) : undefined;

  return summaryOf([
    compared("invoiced", now.invoiced, before?.invoiced),
    compared("collected", now.collected, before?.collected),
    compared("outstanding", now.outstanding, before?.outstanding),
    compared("collectionRate", now.collectionRate, before?.collectionRate),
    compared("averagePayment", cash.average, cashBefore?.average),
    /*
     * الفواتير الملغاة تُعرض عدداً ولا تدخل أيَّ مجموعٍ مالي — §21.
     *
     * إخفاؤها كلّياً كان سيمنع الإدارةَ من ملاحظة إلغاءٍ غير
     * معتاد، وإدخالُها في المجاميع كان سيكذب. فالعدُّ وحده.
     */
    metric("cancelledInvoices", current.cancelledInvoices),
    metric("paymentCount", cash.count),
  ]);
};

export const assembleDebtSummary = (
  snapshot: FinancialSnapshot,
  input: { studentsInDebt: number; collectedOld: unknown },
) => {
  const totals = invoicing(snapshot.invoices);

  const debtTotals = debt({
    /*
     * الجاري = كلُّ المتبقّي ناقصَ القديم.
     *
     * ولا يُستعلم عنه مستقلّاً: استعلامان منفصلان قد يقعان على
     * حدَّي فترةٍ مختلفين إن تغيّرت الساعةُ بينهما، فيظهر مجموعٌ
     * لا يساوي جمعَ جزأيه — وهو أسوأ ما يُرى في تقريرٍ مالي.
     */
    currentRemaining:
      totals.outstanding - toNumber(snapshot.oldDebt.oldRemaining),
    previousRemaining: snapshot.oldDebt.oldRemaining,
    studentsInDebt: input.studentsInDebt,
    collectedOld: input.collectedOld as never,
  });

  return summaryOf([
    metric("debtTotal", debtTotals.total),
    metric("debtCurrent", debtTotals.current),
    metric("debtOld", debtTotals.old),
    metric("collectedOldDebt", debtTotals.collectedOld),
    metric("studentsInDebt", debtTotals.studentsInDebt),
    metric("oldRecoveryRate", debtTotals.oldRecoveryRate),
  ]);
};

// --------------------------------------------------
// الأساتذة
// --------------------------------------------------

export const assembleTeacherSummary = (
  current: TeacherSnapshot,
  previous?: TeacherSnapshot,
) => {
  const now = teacherFinancials({
    settlementEntitlement: current.settlements.settlementEntitlement,
    debtShareEntitlement: current.debtShares.debtShareEntitlement,
    allocatedPaid: current.allocations.allocatedPaid,
  });

  const before = previous
    ? teacherFinancials({
        settlementEntitlement: previous.settlements.settlementEntitlement,
        debtShareEntitlement: previous.debtShares.debtShareEntitlement,
        allocatedPaid: previous.allocations.allocatedPaid,
      })
    : undefined;

  return summaryOf([
    compared("teacherEntitlement", now.entitlement, before?.entitlement),
    compared("teacherPaid", now.paid, before?.paid),
    compared("teacherOutstanding", now.outstanding, before?.outstanding),
    metric("teacherFromSettlements", now.fromSettlements),
    metric("teacherFromDebtShares", now.fromDebtShares),
    /*
     * الفجوةُ بين مجموع الدفعات ومجموع التخصيصات — §32 و§39.
     *
     * ينبغي أن تكون صفراً دائماً. وظهورُها يعني ديناراً دُفع بلا
     * بيانِ مقابله، فتُعرض في نظرة العموم لا تُخبَّأ في شاشة جودة
     * البيانات وحدها.
     */
    metric(
      "unallocatedTeacherPayment",
      toNumber(current.payments.teacherPaymentTotal) -
        toNumber(current.allocations.allocatedPaid),
    ),
  ]);
};

// --------------------------------------------------
// الحضور
// --------------------------------------------------

export const assembleAttendanceSummary = (
  current: AttendanceCounts,
  previous?: AttendanceCounts,
) => {
  const now = attendanceMetric(current);
  const before = previous ? attendanceMetric(previous) : undefined;

  return summaryOf([
    compared("attendanceRate", now.attendanceRate, before?.attendanceRate),
    compared("absenceRate", now.absenceRate, before?.absenceRate),
    metric("lateRate", now.lateRate),
    metric("excusedRate", now.excusedRate),
    metric("attendanceRecords", now.total),
  ]);
};

// --------------------------------------------------
// التدفّق النقدي — §33
// --------------------------------------------------

export const assembleCashFlowSummary = (input: {
  studentPayments: unknown;
  debtCollections: unknown;
  teacherPayments: unknown;
}) => {
  const flow = cashFlow({
    studentPayments: input.studentPayments as never,
    debtCollections: input.debtCollections as never,
    teacherPayments: input.teacherPayments as never,
  });

  return summaryOf([
    metric("moneyIn", flow.moneyIn),
    metric("moneyOut", flow.moneyOut),
    metric("netCashMovement", flow.netMovement),
    metric("ofWhichDebtCollection", flow.ofWhichDebtCollection),
    metric("teacherCostRatio", flow.teacherCostRatio),
  ]);
};

// ======================================================
// الرسوم
// ======================================================

type MonthRow = {
  year: number;
  month: number;
  _sum: { total: unknown; remaining: unknown };
  _count: number;
};

/**
 * سلسلةُ الإيراد والتحصيل والمتبقّي شهراً بشهر — §6.
 *
 * ثلاثُ سلاسل على محورٍ واحد لا ثلاثةُ رسوم: المقارنةُ بينها هي
 * المعلومة، وفصلُها يُجبر القارئَ على المطابقة بعينه.
 */
export const assembleMonthlyFinancialChart = (
  rows: MonthRow[],
): ReportChart => {
  const categories = rows.map((row) =>
    yearMonthKey({ year: row.year, month: row.month }),
  );

  const invoiced = rows.map((row) => toNumber(row._sum.total as never));
  const remaining = rows.map((row) => toNumber(row._sum.remaining as never));

  return chart({
    key: "financialByMonth",
    title: "الفوترة والتحصيل شهرياً",
    kind: "line",
    unit: "money",
    categories,
    series: [
      { key: "invoiced", label: "المفوتر", data: invoiced },
      {
        key: "collected",
        label: "المحصَّل",
        data: invoiced.map((value, index) => value - remaining[index]),
      },
      { key: "outstanding", label: "المتبقّي", data: remaining },
    ],
  });
};

type StatusRow = {
  status: string;
  _sum: { total: unknown };
  _count: number;
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  PENDING: "معلَّقة",
  PARTIAL: "مسدَّدة جزئياً",
  PAID: "مسدَّدة",
  CANCELLED: "ملغاة",
};

/**
 * توزيعُ حالات الفواتير — §22.
 *
 * `donut` لأنّ الفئات أربع. و§60 يمنع الدائريَّ حين تكثر الفئات،
 * لأنّ العينَ لا تقارن زوايا متقاربة — وأربعٌ حدٌّ مقبول.
 */
export const assembleInvoiceStatusChart = (rows: StatusRow[]): ReportChart => {
  const ordered = ["PENDING", "PARTIAL", "PAID", "CANCELLED"].filter((status) =>
    rows.some((row) => row.status === status),
  );

  return chart({
    key: "invoiceStatus",
    title: "توزيع حالات الفواتير",
    kind: "donut",
    unit: "count",
    categories: ordered.map((status) => INVOICE_STATUS_LABEL[status] ?? status),
    series: [
      {
        key: "count",
        label: "العدد",
        data: ordered.map(
          (status) => rows.find((row) => row.status === status)?._count ?? 0,
        ),
      },
    ],
    drill: {
      to: "/reports/invoices",
      param: "invoiceStatus",
      categoryIds: ordered,
    },
  });
};

type MethodRow = {
  paymentMethod: string;
  _sum: { amount: unknown };
  _count: number;
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "نقداً",
  CARD: "بطاقة",
  BANK_TRANSFER: "تحويل بنكي",
};

export const assemblePaymentMethodChart = (rows: MethodRow[]): ReportChart =>
  chart({
    key: "paymentMethods",
    title: "طرق الدفع",
    kind: "horizontalBar",
    unit: "money",
    categories: rows.map(
      (row) => METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod,
    ),
    series: [
      {
        key: "amount",
        label: "المبلغ",
        data: rows.map((row) => toNumber(row._sum.amount as never)),
      },
    ],
    drill: {
      to: "/reports/payments",
      param: "paymentMethod",
      categoryIds: rows.map((row) => row.paymentMethod),
    },
  });

const ATTENDANCE_LABEL: Record<keyof AttendanceCounts, string> = {
  PRESENT: "حاضر",
  ABSENT: "غائب",
  LATE: "متأخّر",
  EXCUSED: "معذور",
};

export const assembleAttendanceChart = (
  counts: AttendanceCounts,
): ReportChart => {
  const keys = Object.keys(ATTENDANCE_LABEL) as (keyof AttendanceCounts)[];

  return chart({
    key: "attendanceBreakdown",
    title: "توزيع الحضور",
    kind: "donut",
    unit: "count",
    categories: keys.map((key) => ATTENDANCE_LABEL[key]),
    series: [
      { key: "count", label: "العدد", data: keys.map((key) => counts[key]) },
    ],
    drill: {
      to: "/reports/attendance",
      param: "attendanceStatus",
      categoryIds: keys,
    },
  });
};
