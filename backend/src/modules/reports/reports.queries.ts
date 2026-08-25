import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  AttendanceCounts,
  YearMonth,
  activeDebtCollection,
  activeTeacherAllocation,
  countsFromGroupBy,
} from "../../core/reporting";
import type { ReportQuery } from "./reports.filters";
import {
  attendanceScope,
  invoiceScope,
  oldDebtScope,
  paymentScope,
  settlementScope,
  teacherPaymentScope,
} from "./reports.scope";

// ======================================================
// الاستعلامات — §51
//
// قاعدتان لا استثناء لهما:
//
//   1. **التجميعُ في القاعدة لا في JavaScript.** جلبُ كلّ الفواتير
//      ثم `reduce` عليها ينقل ميغابايتاتٍ عبر الشبكة ليُنتج رقماً
//      واحداً، ويصير أبطأ كلّما نمت المؤسسة — أي أنّه يعمل في
//      التجريب ويسقط في الإنتاج.
//
//   2. **الاستعلاماتُ المستقلّة تتوازى.** ستّةُ تجميعاتٍ متسلسلة
//      تُكلّف ستَّ رحلاتٍ ذهاباً وإياباً؛ و`Promise.all` يجعلها
//      رحلةً واحدة زمنياً. وهذا مهمٌّ هنا تحديداً: التجمّعُ خمسةُ
//      اتصالات، فالتوازي مضبوطٌ بسقفه ولا يُغرق القاعدة.
//
// وكلُّ دالّةٍ هنا تأخذ `where` جاهزاً من `reports.scope` ولا تبني
// شرطاً بنفسها — فمنطقُ الفلترة في مكانٍ واحد يُختبر وحده.
// ======================================================

// --------------------------------------------------
// الفوترة
// --------------------------------------------------

export type InvoiceAggregate = {
  invoicedTotal: Prisma.Decimal | null;
  remainingTotal: Prisma.Decimal | null;
  discountTotal: Prisma.Decimal | null;
  invoiceCount: number;
};

export const aggregateInvoices = async (
  where: Prisma.InvoiceWhereInput,
): Promise<InvoiceAggregate> => {
  const result = await prisma.invoice.aggregate({
    where,
    _sum: { total: true, remaining: true, discount: true },
    _count: true,
  });

  return {
    invoicedTotal: result._sum.total,
    remainingTotal: result._sum.remaining,
    discountTotal: result._sum.discount,
    invoiceCount: result._count,
  };
};

/**
 * الفوترةُ شهراً بشهر — سلسلةُ §6.
 *
 * `groupBy` على حقلَي الأعمال لا على تاريخ. فالفاتورةُ المُدخَلة
 * متأخّرةً تقع في شهرها، والرسمُ البياني يعرض الاستحقاق لا الإدخال.
 */
export const invoicesByMonth = async (where: Prisma.InvoiceWhereInput) =>
  prisma.invoice.groupBy({
    by: ["year", "month"],
    where,
    _sum: { total: true, remaining: true },
    _count: true,
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

export const invoicesByStatus = async (where: Prisma.InvoiceWhereInput) =>
  prisma.invoice.groupBy({
    by: ["status"],
    where,
    _sum: { total: true, remaining: true },
    _count: true,
  });

// --------------------------------------------------
// الدفعات
// --------------------------------------------------

export const aggregatePayments = async (
  where: Prisma.PaymentWhereInput,
): Promise<{ paymentTotal: Prisma.Decimal | null; paymentCount: number }> => {
  const result = await prisma.payment.aggregate({
    where,
    _sum: { amount: true },
    _count: true,
  });

  return { paymentTotal: result._sum.amount, paymentCount: result._count };
};

export const paymentsByMethod = async (where: Prisma.PaymentWhereInput) =>
  prisma.payment.groupBy({
    by: ["paymentMethod"],
    where,
    _sum: { amount: true },
    _count: true,
  });

// --------------------------------------------------
// الديون
// --------------------------------------------------

/**
 * متبقّي الفواتير الأقدم من فترة المرجع — الدَّين القديم.
 */
export const aggregateOldDebt = async (
  query: Partial<ReportQuery>,
  reference: YearMonth,
) => {
  const result = await prisma.invoice.aggregate({
    where: oldDebtScope(query, reference),
    _sum: { remaining: true },
    _count: true,
  });

  return { oldRemaining: result._sum.remaining, oldInvoiceCount: result._count };
};

/**
 * عددُ الطلبة المدينين — لا عددُ الفواتير.
 *
 * `groupBy` على الطالب ثم عدُّ المجموعات: طالبٌ عليه خمسُ فواتير
 * مدينٌ **واحد** لا خمسة. والعدُّ المباشر للفواتير كان سيضخّم
 * الرقمَ أضعافاً ويجعل «37 طالباً مديناً» تُقرأ «180».
 *
 * ويمرّ عبر التسجيل لأنّ الفاتورة لا تحمل الطالبَ مباشرةً.
 */
export const countStudentsInDebt = async (
  where: Prisma.InvoiceWhereInput,
): Promise<number> => {
  const rows = await prisma.invoice.findMany({
    where: { ...where, remaining: { gt: 0 } },
    select: { studentEnrollment: { select: { studentId: true } } },
    distinct: ["studentEnrollmentId"],
  });

  return new Set(rows.map((row) => row.studentEnrollment.studentId)).size;
};

/**
 * تحصيلُ الديون القديمة — §26.
 *
 * الشرطُ على `collectedAt` لا على شهر الفاتورة الأصلي: التحصيلُ
 * واقعةٌ في يومه، والفاتورةُ تبقى في شهرها (§52.7).
 */
export const aggregateDebtCollections = async (range: {
  from: Date;
  to: Date;
} | null) => {
  const result = await prisma.debtCollection.aggregate({
    where: {
      ...activeDebtCollection,
      ...(range ? { collectedAt: { gte: range.from, lte: range.to } } : {}),
    },
    _sum: { collectedAmount: true },
    _count: true,
  });

  return {
    collectedOld: result._sum.collectedAmount,
    collectionCount: result._count,
  };
};

// --------------------------------------------------
// الحضور
// --------------------------------------------------

export const attendanceCounts = async (
  where: Prisma.AttendanceWhereInput,
): Promise<AttendanceCounts> => {
  const rows = await prisma.attendance.groupBy({
    by: ["status"],
    where,
    _count: true,
  });

  return countsFromGroupBy(
    rows.map((row) => ({ status: row.status, _count: row._count })),
  );
};

// --------------------------------------------------
// مالُ الأساتذة
// --------------------------------------------------

export const aggregateSettlements = async (
  where: Prisma.SettlementWhereInput,
) => {
  const result = await prisma.settlement.aggregate({
    where,
    _sum: { teacherAmount: true },
    _count: true,
  });

  return {
    settlementEntitlement: result._sum.teacherAmount,
    settlementCount: result._count,
  };
};

export const settlementsByStatus = async (
  where: Prisma.SettlementWhereInput,
) =>
  prisma.settlement.groupBy({
    by: ["status"],
    where,
    _sum: { teacherAmount: true },
    _count: true,
  });

/**
 * حصصُ الأساتذة من الديون المحصَّلة — §52.8.
 *
 * مصدرٌ ثانٍ للاستحقاق لا يُغفَل: أستاذٌ درّس سبتمبر وحُصّلت ديونُه
 * في نوفمبر يستحقّ حصّةً منها.
 */
export const aggregateDebtShares = async (
  where: Prisma.TeacherDebtShareWhereInput,
) => {
  const result = await prisma.teacherDebtShare.aggregate({
    where,
    _sum: { shareAmount: true },
    _count: true,
  });

  return {
    debtShareEntitlement: result._sum.shareAmount,
    debtShareCount: result._count,
  };
};

/**
 * المدفوعُ للأساتذة — من التخصيصات لا من مجاميع الدفعات.
 *
 * §32: الدفعةُ الواحدة تُوزَّع على تخليصٍ وحصصِ دَين، والمجموعُ
 * الخام لا يقول أين ذهب كلُّ دينار. والتخصيصُ يتبع دفعتَه في
 * الإلغاء، فالشرطُ يمرّ بها.
 */
export const aggregateTeacherAllocations = async (
  where: Prisma.TeacherPaymentWhereInput,
) => {
  const result = await prisma.teacherPaymentAllocation.aggregate({
    where: { teacherPayment: where },
    _sum: { amount: true },
    _count: true,
  });

  return {
    allocatedPaid: result._sum.amount,
    allocationCount: result._count,
  };
};

export const aggregateTeacherPayments = async (
  where: Prisma.TeacherPaymentWhereInput,
) => {
  const result = await prisma.teacherPayment.aggregate({
    where,
    _sum: { amount: true },
    _count: true,
  });

  return {
    teacherPaymentTotal: result._sum.amount,
    teacherPaymentCount: result._count,
  };
};

// --------------------------------------------------
// الأعداد التشغيلية
// --------------------------------------------------

export const countActiveStudents = async (
  where: Prisma.StudentWhereInput,
): Promise<number> => prisma.student.count({ where });

export const countSessions = async (
  where: Prisma.SessionWhereInput,
): Promise<number> => prisma.session.count({ where });

// ======================================================
// الحزم — §51: ما يستقلّ يتوازى
// ======================================================

export type FinancialSnapshot = Awaited<
  ReturnType<typeof fetchFinancialSnapshot>
>;

/**
 * لقطةٌ ماليةٌ كاملة لفترة، برحلةٍ واحدة زمنياً.
 *
 * الستّةُ مستقلّةٌ فعلاً — لا يحتاج أحدُها ناتجَ الآخر — فتوازيها
 * صحيحٌ لا تحسينٌ متسرّع. ولو احتاج أحدُها الآخر لكان `Promise.all`
 * خطأً يُخفي ترتيباً ضرورياً.
 */
export const fetchFinancialSnapshot = async (
  query: Partial<ReportQuery>,
  reference: YearMonth | null,
) => {
  const invoiceWhere = invoiceScope(query);
  const paymentWhere = paymentScope(query);

  const [invoices, payments, methods, byMonth, byStatus, cancelledInvoices] =
    await Promise.all([
      aggregateInvoices(invoiceWhere),
      aggregatePayments(paymentWhere),
      paymentsByMethod(paymentWhere),
      invoicesByMonth(invoiceWhere),
      invoicesByStatus(invoiceScope(query, { includeCancelled: true })),
      prisma.invoice.count({
        where: invoiceScope({ ...query, invoiceStatus: "CANCELLED" }),
      }),
    ]);

  const oldDebt = reference
    ? await aggregateOldDebt(query, reference)
    : { oldRemaining: null, oldInvoiceCount: 0 };

  return {
    invoices,
    payments,
    methods,
    byMonth,
    byStatus,
    cancelledInvoices,
    oldDebt,
  };
};

export type TeacherSnapshot = Awaited<ReturnType<typeof fetchTeacherSnapshot>>;

export const fetchTeacherSnapshot = async (query: Partial<ReportQuery>) => {
  const settlementWhere = settlementScope(query);
  const paymentWhere = teacherPaymentScope(query);

  const [settlements, debtShares, allocations, payments, byStatus] =
    await Promise.all([
      aggregateSettlements(settlementWhere),
      aggregateDebtShares({
        status: { not: "CANCELLED" },
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      }),
      aggregateTeacherAllocations(paymentWhere),
      aggregateTeacherPayments(paymentWhere),
      settlementsByStatus(settlementScope(query, { includeCancelled: true })),
    ]);

  return { settlements, debtShares, allocations, payments, byStatus };
};

export const fetchAttendanceSnapshot = async (query: Partial<ReportQuery>) =>
  attendanceCounts(attendanceScope(query));
