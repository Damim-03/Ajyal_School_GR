"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAttendanceSnapshot = exports.fetchTeacherSnapshot = exports.fetchFinancialSnapshot = exports.countSessions = exports.countActiveStudents = exports.aggregateTeacherPayments = exports.aggregateTeacherAllocations = exports.aggregateDebtShares = exports.settlementsByStatus = exports.aggregateSettlements = exports.attendanceCounts = exports.aggregateDebtCollections = exports.countStudentsInDebt = exports.aggregateOldDebt = exports.paymentsByMethod = exports.aggregatePayments = exports.invoicesByStatus = exports.invoicesByMonth = exports.aggregateInvoices = void 0;
const client_1 = require("../../core/prisma/client");
const reporting_1 = require("../../core/reporting");
const reports_scope_1 = require("./reports.scope");
const aggregateInvoices = async (where) => {
    const result = await client_1.prisma.invoice.aggregate({
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
exports.aggregateInvoices = aggregateInvoices;
/**
 * الفوترةُ شهراً بشهر — سلسلةُ §6.
 *
 * `groupBy` على حقلَي الأعمال لا على تاريخ. فالفاتورةُ المُدخَلة
 * متأخّرةً تقع في شهرها، والرسمُ البياني يعرض الاستحقاق لا الإدخال.
 */
const invoicesByMonth = async (where) => client_1.prisma.invoice.groupBy({
    by: ["year", "month"],
    where,
    _sum: { total: true, remaining: true },
    _count: true,
    orderBy: [{ year: "asc" }, { month: "asc" }],
});
exports.invoicesByMonth = invoicesByMonth;
const invoicesByStatus = async (where) => client_1.prisma.invoice.groupBy({
    by: ["status"],
    where,
    _sum: { total: true, remaining: true },
    _count: true,
});
exports.invoicesByStatus = invoicesByStatus;
// --------------------------------------------------
// الدفعات
// --------------------------------------------------
const aggregatePayments = async (where) => {
    const result = await client_1.prisma.payment.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
    });
    return { paymentTotal: result._sum.amount, paymentCount: result._count };
};
exports.aggregatePayments = aggregatePayments;
const paymentsByMethod = async (where) => client_1.prisma.payment.groupBy({
    by: ["paymentMethod"],
    where,
    _sum: { amount: true },
    _count: true,
});
exports.paymentsByMethod = paymentsByMethod;
// --------------------------------------------------
// الديون
// --------------------------------------------------
/**
 * متبقّي الفواتير الأقدم من فترة المرجع — الدَّين القديم.
 */
const aggregateOldDebt = async (query, reference) => {
    const result = await client_1.prisma.invoice.aggregate({
        where: (0, reports_scope_1.oldDebtScope)(query, reference),
        _sum: { remaining: true },
        _count: true,
    });
    return { oldRemaining: result._sum.remaining, oldInvoiceCount: result._count };
};
exports.aggregateOldDebt = aggregateOldDebt;
/**
 * عددُ الطلبة المدينين — لا عددُ الفواتير.
 *
 * `groupBy` على الطالب ثم عدُّ المجموعات: طالبٌ عليه خمسُ فواتير
 * مدينٌ **واحد** لا خمسة. والعدُّ المباشر للفواتير كان سيضخّم
 * الرقمَ أضعافاً ويجعل «37 طالباً مديناً» تُقرأ «180».
 *
 * ويمرّ عبر التسجيل لأنّ الفاتورة لا تحمل الطالبَ مباشرةً.
 */
const countStudentsInDebt = async (where) => {
    const rows = await client_1.prisma.invoice.findMany({
        where: { ...where, remaining: { gt: 0 } },
        select: { studentEnrollment: { select: { studentId: true } } },
        distinct: ["studentEnrollmentId"],
    });
    return new Set(rows.map((row) => row.studentEnrollment.studentId)).size;
};
exports.countStudentsInDebt = countStudentsInDebt;
/**
 * تحصيلُ الديون القديمة — §26.
 *
 * الشرطُ على `collectedAt` لا على شهر الفاتورة الأصلي: التحصيلُ
 * واقعةٌ في يومه، والفاتورةُ تبقى في شهرها (§52.7).
 */
const aggregateDebtCollections = async (range) => {
    const result = await client_1.prisma.debtCollection.aggregate({
        where: {
            ...reporting_1.activeDebtCollection,
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
exports.aggregateDebtCollections = aggregateDebtCollections;
// --------------------------------------------------
// الحضور
// --------------------------------------------------
const attendanceCounts = async (where) => {
    const rows = await client_1.prisma.attendance.groupBy({
        by: ["status"],
        where,
        _count: true,
    });
    return (0, reporting_1.countsFromGroupBy)(rows.map((row) => ({ status: row.status, _count: row._count })));
};
exports.attendanceCounts = attendanceCounts;
// --------------------------------------------------
// مالُ الأساتذة
// --------------------------------------------------
const aggregateSettlements = async (where) => {
    const result = await client_1.prisma.settlement.aggregate({
        where,
        _sum: { teacherAmount: true },
        _count: true,
    });
    return {
        settlementEntitlement: result._sum.teacherAmount,
        settlementCount: result._count,
    };
};
exports.aggregateSettlements = aggregateSettlements;
const settlementsByStatus = async (where) => client_1.prisma.settlement.groupBy({
    by: ["status"],
    where,
    _sum: { teacherAmount: true },
    _count: true,
});
exports.settlementsByStatus = settlementsByStatus;
/**
 * حصصُ الأساتذة من الديون المحصَّلة — §52.8.
 *
 * مصدرٌ ثانٍ للاستحقاق لا يُغفَل: أستاذٌ درّس سبتمبر وحُصّلت ديونُه
 * في نوفمبر يستحقّ حصّةً منها.
 */
const aggregateDebtShares = async (where) => {
    const result = await client_1.prisma.teacherDebtShare.aggregate({
        where,
        _sum: { shareAmount: true },
        _count: true,
    });
    return {
        debtShareEntitlement: result._sum.shareAmount,
        debtShareCount: result._count,
    };
};
exports.aggregateDebtShares = aggregateDebtShares;
/**
 * المدفوعُ للأساتذة — من التخصيصات لا من مجاميع الدفعات.
 *
 * §32: الدفعةُ الواحدة تُوزَّع على تخليصٍ وحصصِ دَين، والمجموعُ
 * الخام لا يقول أين ذهب كلُّ دينار. والتخصيصُ يتبع دفعتَه في
 * الإلغاء، فالشرطُ يمرّ بها.
 */
const aggregateTeacherAllocations = async (where) => {
    const result = await client_1.prisma.teacherPaymentAllocation.aggregate({
        where: { teacherPayment: where },
        _sum: { amount: true },
        _count: true,
    });
    return {
        allocatedPaid: result._sum.amount,
        allocationCount: result._count,
    };
};
exports.aggregateTeacherAllocations = aggregateTeacherAllocations;
const aggregateTeacherPayments = async (where) => {
    const result = await client_1.prisma.teacherPayment.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
    });
    return {
        teacherPaymentTotal: result._sum.amount,
        teacherPaymentCount: result._count,
    };
};
exports.aggregateTeacherPayments = aggregateTeacherPayments;
// --------------------------------------------------
// الأعداد التشغيلية
// --------------------------------------------------
const countActiveStudents = async (where) => client_1.prisma.student.count({ where });
exports.countActiveStudents = countActiveStudents;
const countSessions = async (where) => client_1.prisma.session.count({ where });
exports.countSessions = countSessions;
/**
 * لقطةٌ ماليةٌ كاملة لفترة، برحلةٍ واحدة زمنياً.
 *
 * الستّةُ مستقلّةٌ فعلاً — لا يحتاج أحدُها ناتجَ الآخر — فتوازيها
 * صحيحٌ لا تحسينٌ متسرّع. ولو احتاج أحدُها الآخر لكان `Promise.all`
 * خطأً يُخفي ترتيباً ضرورياً.
 */
const fetchFinancialSnapshot = async (query, reference) => {
    const invoiceWhere = (0, reports_scope_1.invoiceScope)(query);
    const paymentWhere = (0, reports_scope_1.paymentScope)(query);
    const [invoices, payments, methods, byMonth, byStatus, cancelledInvoices] = await Promise.all([
        (0, exports.aggregateInvoices)(invoiceWhere),
        (0, exports.aggregatePayments)(paymentWhere),
        (0, exports.paymentsByMethod)(paymentWhere),
        (0, exports.invoicesByMonth)(invoiceWhere),
        (0, exports.invoicesByStatus)((0, reports_scope_1.invoiceScope)(query, { includeCancelled: true })),
        client_1.prisma.invoice.count({
            where: (0, reports_scope_1.invoiceScope)({ ...query, invoiceStatus: "CANCELLED" }),
        }),
    ]);
    const oldDebt = reference
        ? await (0, exports.aggregateOldDebt)(query, reference)
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
exports.fetchFinancialSnapshot = fetchFinancialSnapshot;
const fetchTeacherSnapshot = async (query) => {
    const settlementWhere = (0, reports_scope_1.settlementScope)(query);
    const paymentWhere = (0, reports_scope_1.teacherPaymentScope)(query);
    const [settlements, debtShares, allocations, payments, byStatus] = await Promise.all([
        (0, exports.aggregateSettlements)(settlementWhere),
        (0, exports.aggregateDebtShares)({
            status: { not: "CANCELLED" },
            ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        }),
        (0, exports.aggregateTeacherAllocations)(paymentWhere),
        (0, exports.aggregateTeacherPayments)(paymentWhere),
        (0, exports.settlementsByStatus)((0, reports_scope_1.settlementScope)(query, { includeCancelled: true })),
    ]);
    return { settlements, debtShares, allocations, payments, byStatus };
};
exports.fetchTeacherSnapshot = fetchTeacherSnapshot;
const fetchAttendanceSnapshot = async (query) => (0, exports.attendanceCounts)((0, reports_scope_1.attendanceScope)(query));
exports.fetchAttendanceSnapshot = fetchAttendanceSnapshot;
//# sourceMappingURL=reports.queries.js.map