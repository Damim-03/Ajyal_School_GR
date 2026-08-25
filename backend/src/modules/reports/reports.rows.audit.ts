import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import { toNumber } from "../../core/reporting";
import type { ReportQuery } from "./reports.filters";
import { resolvePeriod } from "./reports.scope";
import { skipTake, type ResolvedSort, type TableRequest } from "./reports.table";

// ======================================================
// التدقيق والإلغاءات وجودة البيانات — §37 §38 §39
// ======================================================

// --------------------------------------------------
// سجلُّ التدقيق — §37
// --------------------------------------------------

export type AuditRow = {
  id: string;
  createdAt: string;
  user: string | null;
  entity: string;
  entityId: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
};

export const fetchAuditRows = async (
  query: Partial<ReportQuery>,
  request: TableRequest,
  sort: ResolvedSort,
): Promise<{ rows: AuditRow[]; total: number }> => {
  const { range } = resolvePeriod(query);

  /*
   * التدقيقُ وحدَه يُفلتر بـ`createdAt` — وهذا ليس نقضاً لـ§58 بل
   * تطبيقٌ له.
   *
   * §58 يقول: اقرأ حقلَ الأعمال حين يوجد. وواقعةُ التدقيق **حقلُ
   * أعمالها هو لحظةُ وقوعها**: السؤالُ هنا «متى عُدِّلت القيمة»
   * لا «لأيّ شهرٍ كانت». فـ`createdAt` هي الجواب لا بديلٌ عنه.
   */
  const where: Prisma.FinancialAuditLogWhereInput = range
    ? { createdAt: { gte: range.from, lte: range.to } }
    : {};

  const [total, logs] = await prisma.$transaction([
    prisma.financialAuditLog.count({ where }),
    prisma.financialAuditLog.findMany({
      where,
      ...skipTake(request),
      orderBy: sort.orderBy as Prisma.FinancialAuditLogOrderByWithRelationInput,
      select: {
        id: true,
        createdAt: true,
        entity: true,
        entityId: true,
        action: true,
        field: true,
        oldValue: true,
        newValue: true,
        reason: true,
        user: { select: { firstName: true, lastName: true, username: true } },
      },
    }),
  ]);

  const rows: AuditRow[] = logs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    /*
     * الاسمُ الكامل لا اسمَ الدخول: السجلُّ يُقرأ في مراجعةٍ
     * إدارية، و«admin» لا تقول من فعل. والسقوطُ إلى اسم الدخول
     * حين لا اسمَ كامل، وإلى `null` حين حُذف المستخدم أو كان
     * الفعلُ نظامياً.
     */
    user: log.user
      ? `${log.user.firstName} ${log.user.lastName}`.trim() || log.user.username
      : null,
    entity: log.entity,
    entityId: log.entityId,
    action: log.action,
    field: log.field,
    oldValue: log.oldValue,
    newValue: log.newValue,
    reason: log.reason,
  }));

  return { rows, total };
};

export const auditCounts = async (query: Partial<ReportQuery>) => {
  const { range } = resolvePeriod(query);
  const where: Prisma.FinancialAuditLogWhereInput = range
    ? { createdAt: { gte: range.from, lte: range.to } }
    : {};

  const [byAction, byEntity, total] = await Promise.all([
    prisma.financialAuditLog.groupBy({ by: ["action"], where, _count: true }),
    prisma.financialAuditLog.groupBy({ by: ["entity"], where, _count: true }),
    prisma.financialAuditLog.count({ where }),
  ]);

  return { byAction, byEntity, total };
};

// --------------------------------------------------
// الإلغاءات — §38
//
// خمسةُ كياناتٍ تُلغى، ولكلٍّ جدولُه. فالشاشةُ تجمعها في قائمةٍ
// واحدة موحّدة الشكل: من ألغى، وماذا، ومتى، ولماذا، وبكم.
// --------------------------------------------------

export type CancellationRow = {
  id: string;
  kind: "invoice" | "payment" | "receipt" | "settlement" | "teacherPayment";
  kindLabel: string;
  reference: string;
  subject: string;
  amount: number | null;
  cancelledAt: string;
  cancelledBy: string | null;
  reason: string | null;
};

const nameOf = (
  user: { firstName: string; lastName: string } | null | undefined,
): string | null => (user ? `${user.firstName} ${user.lastName}`.trim() : null);

/**
 * الإلغاءاتُ الخمسة مجموعةً.
 *
 * الترقيمُ يقع **بعد** الدمج والفرز في الذاكرة، لا في كلّ استعلام:
 * ترقيمُ خمسة مصادر مستقلّةٍ ثمّ دمجُها يُنتج صفحةً لا تمثّل
 * الترتيب الزمني — الصفحةُ الثانية قد تحمل واقعةً أحدثَ من الأولى.
 *
 * والكلفةُ مقبولة لأنّ الإلغاءات قليلةٌ بطبيعتها: نظامٌ تكثر فيه
 * الإلغاءات مشكلتُه في مكانٍ آخر. ويُحدّ الجلبُ بسقفٍ صريح لئلّا
 * يتحوّل هذا الافتراضُ إلى عطبٍ متى بطل.
 */
const CANCELLATION_FETCH_LIMIT = 2000;

export const fetchCancellationRows = async (
  query: Partial<ReportQuery>,
  request: TableRequest,
): Promise<{ rows: CancellationRow[]; total: number; truncated: boolean }> => {
  const { range } = resolvePeriod(query);
  const window = range
    ? { gte: range.from, lte: range.to }
    : undefined;

  const cancelled = window ? { not: null, ...window } : { not: null };

  const [invoices, payments, receipts, settlements, teacherPayments] =
    await Promise.all([
      prisma.invoice.findMany({
        where: { status: "CANCELLED", cancelledAt: cancelled },
        take: CANCELLATION_FETCH_LIMIT,
        orderBy: { cancelledAt: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          cancelledAt: true,
          cancelReason: true,
          cancelledBy: { select: { firstName: true, lastName: true } },
          studentEnrollment: {
            select: { student: { select: { firstName: true, lastName: true } } },
          },
        },
      }),
      prisma.payment.findMany({
        where: { status: "CANCELLED", cancelledAt: cancelled },
        take: CANCELLATION_FETCH_LIMIT,
        orderBy: { cancelledAt: "desc" },
        select: {
          id: true,
          paymentNumber: true,
          amount: true,
          cancelledAt: true,
          cancelReason: true,
          cancelledBy: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.receipt.findMany({
        where: { status: "CANCELLED", cancelledAt: cancelled },
        take: CANCELLATION_FETCH_LIMIT,
        orderBy: { cancelledAt: "desc" },
        select: {
          id: true,
          receiptNumber: true,
          cancelledAt: true,
          cancelReason: true,
          cancelledBy: { select: { firstName: true, lastName: true } },
          payment: { select: { amount: true } },
        },
      }),
      prisma.settlement.findMany({
        where: { status: "CANCELLED", cancelledAt: cancelled },
        take: CANCELLATION_FETCH_LIMIT,
        orderBy: { cancelledAt: "desc" },
        select: {
          id: true,
          settlementNumber: true,
          teacherAmount: true,
          cancelledAt: true,
          cancelReason: true,
          cancelledBy: { select: { firstName: true, lastName: true } },
          teacher: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.teacherPayment.findMany({
        where: { status: "CANCELLED", cancelledAt: cancelled },
        take: CANCELLATION_FETCH_LIMIT,
        orderBy: { cancelledAt: "desc" },
        select: {
          id: true,
          paymentNumber: true,
          amount: true,
          cancelledAt: true,
          cancelReason: true,
          cancelledBy: { select: { firstName: true, lastName: true } },
          teacher: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

  const all: CancellationRow[] = [
    ...invoices.map((row) => ({
      id: row.id,
      kind: "invoice" as const,
      kindLabel: "فاتورة",
      reference: row.invoiceNumber,
      subject:
        `${row.studentEnrollment.student.firstName} ${row.studentEnrollment.student.lastName}`.trim(),
      amount: toNumber(row.total),
      cancelledAt: row.cancelledAt!.toISOString(),
      cancelledBy: nameOf(row.cancelledBy),
      reason: row.cancelReason,
    })),
    ...payments.map((row) => ({
      id: row.id,
      kind: "payment" as const,
      kindLabel: "دفعة طالب",
      reference: row.paymentNumber,
      subject: "—",
      amount: toNumber(row.amount),
      cancelledAt: row.cancelledAt!.toISOString(),
      cancelledBy: nameOf(row.cancelledBy),
      reason: row.cancelReason,
    })),
    ...receipts.map((row) => ({
      id: row.id,
      kind: "receipt" as const,
      kindLabel: "إيصال",
      reference: row.receiptNumber,
      subject: "—",
      amount: toNumber(row.payment.amount),
      cancelledAt: row.cancelledAt!.toISOString(),
      cancelledBy: nameOf(row.cancelledBy),
      reason: row.cancelReason,
    })),
    ...settlements.map((row) => ({
      id: row.id,
      kind: "settlement" as const,
      kindLabel: "تخليص",
      reference: row.settlementNumber,
      subject: `${row.teacher.firstName} ${row.teacher.lastName}`.trim(),
      amount: toNumber(row.teacherAmount),
      cancelledAt: row.cancelledAt!.toISOString(),
      cancelledBy: nameOf(row.cancelledBy),
      reason: row.cancelReason,
    })),
    ...teacherPayments.map((row) => ({
      id: row.id,
      kind: "teacherPayment" as const,
      kindLabel: "دفعة أستاذ",
      reference: row.paymentNumber,
      subject: `${row.teacher.firstName} ${row.teacher.lastName}`.trim(),
      amount: toNumber(row.amount),
      cancelledAt: row.cancelledAt!.toISOString(),
      cancelledBy: nameOf(row.cancelledBy),
      reason: row.cancelReason,
    })),
  ].sort((a, b) => b.cancelledAt.localeCompare(a.cancelledAt));

  const start = (request.page - 1) * request.pageSize;

  return {
    rows: all.slice(start, start + request.pageSize),
    total: all.length,
    /*
     * بلاغٌ صريح حين يبلغ مصدرٌ سقفَه.
     *
     * فالمجموعُ حينها ناقصٌ ولا يجوز أن يُقرأ كاملاً — والصمتُ
     * عنه يجعل شاشةَ مراجعةٍ تكذب، وهي آخرُ شاشةٍ يُحتمل فيها ذلك.
     */
    truncated: [invoices, payments, receipts, settlements, teacherPayments].some(
      (source) => source.length === CANCELLATION_FETCH_LIMIT,
    ),
  };
};

// --------------------------------------------------
// جودة البيانات — §39
//
// **لا يُعدَّل شيء.** فحصٌ وتنبيهٌ ورابطٌ إلى السجلّ فقط.
// --------------------------------------------------

export type DataQualityIssue = {
  key: string;
  label: string;
  description: string;
  severity: "warning" | "critical";
  count: number;
  drillTo: string | null;
};

export const runDataQualityChecks = async (): Promise<DataQualityIssue[]> => {
  const [
    sessionsWithoutAttendance,
    paymentsWithoutInvoice,
    unallocatedTeacherPayments,
    debtSharesWithoutCollection,
    invoicesWithNegativeRemaining,
    invoicesRemainingOverTotal,
    receiptsForCancelledPayments,
  ] = await Promise.all([
    /*
     * §17: وجودُ حصّةٍ لا يساوي تسجيلَ حضورها.
     *
     * حصّةٌ حالتُها COMPLETED بلا سجلّ حضورٍ واحد تعني ورقةً لم
     * تُملأ — والتخليصُ يُحسب على الحضور، فالنقصُ هنا ينقص مستحقَّ
     * أستاذ بلا أن ينتبه أحد.
     */
    prisma.session.count({
      where: { status: "COMPLETED", attendances: { none: {} } },
    }),

    /* دفعةٌ نشطة بلا فاتورةٍ تسدّدها — مالٌ دخل بلا وجهة */
    prisma.payment.count({
      where: { status: "ACTIVE", paymentInvoices: { none: {} } },
    }),

    /* §32: دفعةُ أستاذٍ بلا تخصيص — دُفع بلا بيانِ مقابل */
    prisma.teacherPayment.count({
      where: { status: "ACTIVE", allocations: { none: {} } },
    }),

    /*
     * حصّةُ دَينٍ نشطة على تحصيلٍ بطل.
     *
     * كتبتُ أوّلَ مرّة فحصاً عن «حصّة بلا تحصيل» — وهو عبثٌ:
     * `debtCollectionId` حقلٌ إلزامي في المخطّط فلا يخلو منه صفّ،
     * والعدُّ صفرٌ أبداً. فحصٌ يطمئن دائماً ولا يفحص شيئاً.
     *
     * والخللُ الحقيقي أنّ الدفعةَ التي أنشأت التحصيل أُلغيت
     * (§52.6) ولم تُلغَ الحصّةُ معها — فيبقى للأستاذ استحقاقٌ من
     * مالٍ لم يدخل الصندوق قطّ.
     */
    prisma.teacherDebtShare.count({
      where: {
        status: { not: "CANCELLED" },
        debtCollection: { payment: { status: "CANCELLED" } },
      },
    }),

    /* متبقٍّ سالب: سُدِّد أكثرُ من المستحقّ */
    prisma.invoice.count({
      where: { status: { not: "CANCELLED" }, remaining: { lt: 0 } },
    }),

    /*
     * متبقٍّ يفوق الإجمالي — يستحيل حسابياً.
     *
     * لا يُكتب شرطاً بين عمودين في Prisma، فيُقارَن على صفرٍ بعد
     * الطرح... وهذا غيرُ متاح أيضاً. فيُترك للعدّ الخام حين يُطلب
     * — والمقارنةُ هنا على `remaining > 0` مع `total = 0`، وهي
     * الحالةُ الوحيدة القابلة للفحص بلا SQL خام.
     */
    prisma.invoice.count({
      where: {
        status: { not: "CANCELLED" },
        total: 0,
        remaining: { gt: 0 },
      },
    }),

    /* إيصالٌ نشط لدفعةٍ ملغاة — الإلغاءُ لم يكتمل */
    prisma.receipt.count({
      where: { status: "ACTIVE", payment: { status: "CANCELLED" } },
    }),
  ]);

  const issues: DataQualityIssue[] = [
    {
      key: "sessionsWithoutAttendance",
      label: "حصص مكتملة بلا حضور مسجَّل",
      description:
        "حصّة حالتها «مكتملة» ولا سجلّ حضور واحد فيها. التخليص يُحسب على الحضور، فالنقص هنا ينقص مستحقّ الأستاذ.",
      severity: "warning",
      count: sessionsWithoutAttendance,
      drillTo: "/reports/attendance",
    },
    {
      key: "paymentsWithoutInvoice",
      label: "دفعات بلا فاتورة",
      description: "دفعة نشطة لا تسدّد أيّ فاتورة — مال دخل بلا وجهة معروفة.",
      severity: "critical",
      count: paymentsWithoutInvoice,
      drillTo: "/reports/payments",
    },
    {
      key: "unallocatedTeacherPayments",
      label: "دفعات أساتذة بلا تخصيص",
      description:
        "دفعة نشطة للأستاذ بلا تخصيص واحد — لا يُعرف مقابل أيّ استحقاق دُفعت.",
      severity: "critical",
      count: unallocatedTeacherPayments,
      drillTo: "/reports/teacher-payments",
    },
    {
      key: "debtSharesOnCancelledPayment",
      label: "حصص دَين على تحصيل بطل",
      description:
        "أُلغيت الدفعة التي حُصِّل بها الدَّين ولم تُلغَ حصّة الأستاذ معها — استحقاق قائم على مال لم يدخل الصندوق.",
      severity: "critical",
      count: debtSharesWithoutCollection,
      drillTo: null,
    },
    {
      key: "invoicesWithNegativeRemaining",
      label: "فواتير بمتبقٍّ سالب",
      description: "سُدِّد أكثر من المستحقّ. يحتاج مراجعة أو ردّاً.",
      severity: "warning",
      count: invoicesWithNegativeRemaining,
      drillTo: "/reports/invoices",
    },
    {
      key: "zeroTotalWithRemaining",
      label: "فواتير بإجمالي صفر ومتبقٍّ موجب",
      description: "حالة مستحيلة حسابياً — متبقٍّ على فاتورة قيمتها صفر.",
      severity: "critical",
      count: invoicesRemainingOverTotal,
      drillTo: "/reports/invoices",
    },
    {
      key: "receiptsForCancelledPayments",
      label: "إيصالات نشطة لدفعات ملغاة",
      description: "أُلغيت الدفعة وبقي إيصالها نشطاً — الإلغاء لم يكتمل.",
      severity: "critical",
      count: receiptsForCancelledPayments,
      drillTo: "/reports/receipts",
    },
  ];

  /*
   * تُعاد كلُّها بما فيها الأصفار.
   *
   * والصفرُ معلومة: «فُحص ولم يُوجد» يطمئن، بخلاف غياب السطر الذي
   * يُقرأ «لم يُفحص». وشاشةُ جودة البيانات تُفقد قيمتَها إن لم
   * تُظهر ما فحصته.
   */
  return issues;
};
