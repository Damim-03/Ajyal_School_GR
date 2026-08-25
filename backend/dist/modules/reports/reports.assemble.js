"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assembleAttendanceChart = exports.assemblePaymentMethodChart = exports.assembleInvoiceStatusChart = exports.assembleMonthlyFinancialChart = exports.assembleCashFlowSummary = exports.assembleAttendanceSummary = exports.assembleTeacherSummary = exports.assembleDebtSummary = exports.assembleFinancialSummary = void 0;
const reporting_1 = require("../../core/reporting");
const reports_contract_1 = require("./reports.contract");
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
const compared = (key, current, previous) => {
    if (previous === undefined)
        return (0, reports_contract_1.metric)(key, current);
    const delta = (0, reporting_1.change)(current ?? 0, previous ?? 0);
    return (0, reports_contract_1.metric)(key, current, {
        previous: previous ?? null,
        absolute: delta.absolute,
        percentage: delta.percentage,
    });
};
const assembleFinancialSummary = ({ current, previous, }) => {
    const now = (0, reporting_1.invoicing)(current.invoices);
    const cash = (0, reporting_1.cashCollected)(current.payments);
    const before = previous ? (0, reporting_1.invoicing)(previous.invoices) : undefined;
    const cashBefore = previous ? (0, reporting_1.cashCollected)(previous.payments) : undefined;
    return (0, reports_contract_1.summaryOf)([
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
        (0, reports_contract_1.metric)("cancelledInvoices", current.cancelledInvoices),
        (0, reports_contract_1.metric)("paymentCount", cash.count),
    ]);
};
exports.assembleFinancialSummary = assembleFinancialSummary;
const assembleDebtSummary = (snapshot, input) => {
    const totals = (0, reporting_1.invoicing)(snapshot.invoices);
    const debtTotals = (0, reporting_1.debt)({
        /*
         * الجاري = كلُّ المتبقّي ناقصَ القديم.
         *
         * ولا يُستعلم عنه مستقلّاً: استعلامان منفصلان قد يقعان على
         * حدَّي فترةٍ مختلفين إن تغيّرت الساعةُ بينهما، فيظهر مجموعٌ
         * لا يساوي جمعَ جزأيه — وهو أسوأ ما يُرى في تقريرٍ مالي.
         */
        currentRemaining: totals.outstanding - (0, reporting_1.toNumber)(snapshot.oldDebt.oldRemaining),
        previousRemaining: snapshot.oldDebt.oldRemaining,
        studentsInDebt: input.studentsInDebt,
        collectedOld: input.collectedOld,
    });
    return (0, reports_contract_1.summaryOf)([
        (0, reports_contract_1.metric)("debtTotal", debtTotals.total),
        (0, reports_contract_1.metric)("debtCurrent", debtTotals.current),
        (0, reports_contract_1.metric)("debtOld", debtTotals.old),
        (0, reports_contract_1.metric)("collectedOldDebt", debtTotals.collectedOld),
        (0, reports_contract_1.metric)("studentsInDebt", debtTotals.studentsInDebt),
        (0, reports_contract_1.metric)("oldRecoveryRate", debtTotals.oldRecoveryRate),
    ]);
};
exports.assembleDebtSummary = assembleDebtSummary;
// --------------------------------------------------
// الأساتذة
// --------------------------------------------------
const assembleTeacherSummary = (current, previous) => {
    const now = (0, reporting_1.teacherFinancials)({
        settlementEntitlement: current.settlements.settlementEntitlement,
        debtShareEntitlement: current.debtShares.debtShareEntitlement,
        allocatedPaid: current.allocations.allocatedPaid,
    });
    const before = previous
        ? (0, reporting_1.teacherFinancials)({
            settlementEntitlement: previous.settlements.settlementEntitlement,
            debtShareEntitlement: previous.debtShares.debtShareEntitlement,
            allocatedPaid: previous.allocations.allocatedPaid,
        })
        : undefined;
    return (0, reports_contract_1.summaryOf)([
        compared("teacherEntitlement", now.entitlement, before?.entitlement),
        compared("teacherPaid", now.paid, before?.paid),
        compared("teacherOutstanding", now.outstanding, before?.outstanding),
        (0, reports_contract_1.metric)("teacherFromSettlements", now.fromSettlements),
        (0, reports_contract_1.metric)("teacherFromDebtShares", now.fromDebtShares),
        /*
         * الفجوةُ بين مجموع الدفعات ومجموع التخصيصات — §32 و§39.
         *
         * ينبغي أن تكون صفراً دائماً. وظهورُها يعني ديناراً دُفع بلا
         * بيانِ مقابله، فتُعرض في نظرة العموم لا تُخبَّأ في شاشة جودة
         * البيانات وحدها.
         */
        (0, reports_contract_1.metric)("unallocatedTeacherPayment", (0, reporting_1.toNumber)(current.payments.teacherPaymentTotal) -
            (0, reporting_1.toNumber)(current.allocations.allocatedPaid)),
    ]);
};
exports.assembleTeacherSummary = assembleTeacherSummary;
// --------------------------------------------------
// الحضور
// --------------------------------------------------
const assembleAttendanceSummary = (current, previous) => {
    const now = (0, reporting_1.attendance)(current);
    const before = previous ? (0, reporting_1.attendance)(previous) : undefined;
    return (0, reports_contract_1.summaryOf)([
        compared("attendanceRate", now.attendanceRate, before?.attendanceRate),
        compared("absenceRate", now.absenceRate, before?.absenceRate),
        (0, reports_contract_1.metric)("lateRate", now.lateRate),
        (0, reports_contract_1.metric)("excusedRate", now.excusedRate),
        (0, reports_contract_1.metric)("attendanceRecords", now.total),
    ]);
};
exports.assembleAttendanceSummary = assembleAttendanceSummary;
// --------------------------------------------------
// التدفّق النقدي — §33
// --------------------------------------------------
const assembleCashFlowSummary = (input) => {
    const flow = (0, reporting_1.cashFlow)({
        studentPayments: input.studentPayments,
        debtCollections: input.debtCollections,
        teacherPayments: input.teacherPayments,
    });
    return (0, reports_contract_1.summaryOf)([
        (0, reports_contract_1.metric)("moneyIn", flow.moneyIn),
        (0, reports_contract_1.metric)("moneyOut", flow.moneyOut),
        (0, reports_contract_1.metric)("netCashMovement", flow.netMovement),
        (0, reports_contract_1.metric)("ofWhichDebtCollection", flow.ofWhichDebtCollection),
        (0, reports_contract_1.metric)("teacherCostRatio", flow.teacherCostRatio),
    ]);
};
exports.assembleCashFlowSummary = assembleCashFlowSummary;
/**
 * سلسلةُ الإيراد والتحصيل والمتبقّي شهراً بشهر — §6.
 *
 * ثلاثُ سلاسل على محورٍ واحد لا ثلاثةُ رسوم: المقارنةُ بينها هي
 * المعلومة، وفصلُها يُجبر القارئَ على المطابقة بعينه.
 */
const assembleMonthlyFinancialChart = (rows) => {
    const categories = rows.map((row) => (0, reporting_1.yearMonthKey)({ year: row.year, month: row.month }));
    const invoiced = rows.map((row) => (0, reporting_1.toNumber)(row._sum.total));
    const remaining = rows.map((row) => (0, reporting_1.toNumber)(row._sum.remaining));
    return (0, reports_contract_1.chart)({
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
exports.assembleMonthlyFinancialChart = assembleMonthlyFinancialChart;
const INVOICE_STATUS_LABEL = {
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
const assembleInvoiceStatusChart = (rows) => {
    const ordered = ["PENDING", "PARTIAL", "PAID", "CANCELLED"].filter((status) => rows.some((row) => row.status === status));
    return (0, reports_contract_1.chart)({
        key: "invoiceStatus",
        title: "توزيع حالات الفواتير",
        kind: "donut",
        unit: "count",
        categories: ordered.map((status) => INVOICE_STATUS_LABEL[status] ?? status),
        series: [
            {
                key: "count",
                label: "العدد",
                data: ordered.map((status) => rows.find((row) => row.status === status)?._count ?? 0),
            },
        ],
        drill: {
            to: "/reports/invoices",
            param: "invoiceStatus",
            categoryIds: ordered,
        },
    });
};
exports.assembleInvoiceStatusChart = assembleInvoiceStatusChart;
const METHOD_LABEL = {
    CASH: "نقداً",
    CARD: "بطاقة",
    BANK_TRANSFER: "تحويل بنكي",
};
const assemblePaymentMethodChart = (rows) => (0, reports_contract_1.chart)({
    key: "paymentMethods",
    title: "طرق الدفع",
    kind: "horizontalBar",
    unit: "money",
    categories: rows.map((row) => METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod),
    series: [
        {
            key: "amount",
            label: "المبلغ",
            data: rows.map((row) => (0, reporting_1.toNumber)(row._sum.amount)),
        },
    ],
    drill: {
        to: "/reports/payments",
        param: "paymentMethod",
        categoryIds: rows.map((row) => row.paymentMethod),
    },
});
exports.assemblePaymentMethodChart = assemblePaymentMethodChart;
const ATTENDANCE_LABEL = {
    PRESENT: "حاضر",
    ABSENT: "غائب",
    LATE: "متأخّر",
    EXCUSED: "معذور",
};
const assembleAttendanceChart = (counts) => {
    const keys = Object.keys(ATTENDANCE_LABEL);
    return (0, reports_contract_1.chart)({
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
exports.assembleAttendanceChart = assembleAttendanceChart;
//# sourceMappingURL=reports.assemble.js.map