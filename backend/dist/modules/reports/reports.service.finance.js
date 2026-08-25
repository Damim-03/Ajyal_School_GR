"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataQualityReportService = exports.cancellationsReportService = exports.auditReportService = exports.allocationsReportService = exports.teacherPaymentsReportService = exports.settlementsReportService = exports.debtCollectionsReportService = exports.debtsReportService = exports.receiptsReportService = exports.paymentsReportService = exports.invoicesReportService = void 0;
const client_1 = require("../../core/prisma/client");
const reporting_1 = require("../../core/reporting");
const reports_contract_1 = require("./reports.contract");
const reports_filters_1 = require("./reports.filters");
const reports_meta_1 = require("./reports.meta");
const reports_assemble_1 = require("./reports.assemble");
const reports_queries_1 = require("./reports.queries");
const reports_rows_finance_1 = require("./reports.rows.finance");
const reports_rows_teacher_1 = require("./reports.rows.teacher");
const reports_rows_audit_1 = require("./reports.rows.audit");
const reports_scope_1 = require("./reports.scope");
const reports_table_1 = require("./reports.table");
const reports_tables_finance_1 = require("./reports.tables.finance");
// ======================================================
// خدماتُ التقارير المالية والتخليص والتدقيق
//
// نفسُ الخطوات الأربع في `reports.service.ts`: تصفيةٌ بالقدرات،
// فحلُّ فترة، فجلبٌ متوازٍ، فتجميعٌ إلى المظروف الموحّد.
// ======================================================
const academicYearOf = async (id) => {
    if (id) {
        return client_1.prisma.academicYear.findUnique({
            where: { id },
            select: { id: true, name: true },
        });
    }
    return client_1.prisma.academicYear.findFirst({
        where: { isCurrent: true },
        select: { id: true, name: true },
    });
};
const referenceMonth = (query) => {
    const period = (0, reports_scope_1.resolvePeriod)(query);
    if (period.yearMonth)
        return period.yearMonth;
    if (period.range)
        return (0, reporting_1.yearMonthOf)(period.range.to);
    return (0, reporting_1.yearMonthOf)(new Date());
};
const tableRequest = (query) => ({
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
});
/** المقدّمةُ المشتركة لكلّ تقرير: قدرات، فترة، سنة دراسية */
const prepare = async (reportKey, query) => {
    const { filters } = (0, reports_filters_1.applyCapability)(reportKey, query);
    const selection = (0, reports_meta_1.resolveSelection)(reportKey, filters, query.comparison);
    const academicYear = await academicYearOf(filters.academicYearId);
    return {
        selection,
        academicYear,
        scoped: { ...filters, academicYearId: academicYear?.id },
        request: tableRequest(query),
    };
};
// ======================================================
// الفواتير — §22
// ======================================================
const invoicesReportService = async (query) => {
    const { selection, academicYear, scoped, request } = await prepare("invoices", query);
    const sort = (0, reports_table_1.resolveSort)(request, reports_tables_finance_1.INVOICE_SORT);
    const reference = referenceMonth(scoped);
    const previous = selection.previous
        ? (0, reports_meta_1.previousQuery)(scoped, selection)
        : undefined;
    const [financial, table, bySubject, previousFinancial] = await Promise.all([
        (0, reports_queries_1.fetchFinancialSnapshot)(scoped, reference),
        (0, reports_rows_finance_1.fetchInvoiceRows)(scoped, request, sort),
        (0, reports_rows_finance_1.revenueBySubject)(scoped),
        previous ? (0, reports_queries_1.fetchFinancialSnapshot)(previous, reference) : undefined,
    ]);
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "invoices", query, selection, academicYear }),
        summary: (0, reports_assemble_1.assembleFinancialSummary)({
            current: financial,
            previous: previousFinancial,
        }),
        charts: [
            (0, reports_assemble_1.assembleInvoiceStatusChart)(financial.byStatus),
            (0, reports_assemble_1.assembleMonthlyFinancialChart)(financial.byMonth),
            (0, reports_contract_1.chart)({
                key: "revenueBySubject",
                title: "الإيراد حسب المادة",
                kind: "horizontalBar",
                unit: "money",
                categories: bySubject.map((row) => row.name),
                series: [
                    {
                        key: "invoiced",
                        label: "المفوتر",
                        data: bySubject.map((row) => row.invoiced),
                    },
                    {
                        key: "collected",
                        label: "المحصَّل",
                        data: bySubject.map((row) => row.invoiced - row.remaining),
                    },
                ],
                drill: {
                    to: "/reports/invoices",
                    param: "subjectId",
                    categoryIds: bySubject.map((row) => row.id),
                },
            }),
        ],
        table: (0, reports_table_1.buildTable)({
            columns: reports_tables_finance_1.INVOICE_COLUMNS,
            rows: table.rows,
            total: table.total,
            request,
            sort,
        }),
    };
};
exports.invoicesReportService = invoicesReportService;
// ======================================================
// الدفعات — §23
// ======================================================
const paymentsReportService = async (query) => {
    const { selection, academicYear, scoped, request } = await prepare("payments", query);
    const sort = (0, reports_table_1.resolveSort)(request, reports_tables_finance_1.PAYMENT_SORT);
    const reference = referenceMonth(scoped);
    const [financial, table] = await Promise.all([
        (0, reports_queries_1.fetchFinancialSnapshot)(scoped, reference),
        (0, reports_rows_finance_1.fetchPaymentRows)(scoped, request, sort),
    ]);
    const cancelled = await client_1.prisma.payment.count({
        where: { status: "CANCELLED" },
    });
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "payments", query, selection, academicYear }),
        summary: (0, reports_contract_1.summaryOf)([
            (0, reports_contract_1.metric)("collected", (0, reporting_1.toNumber)(financial.payments.paymentTotal)),
            (0, reports_contract_1.metric)("paymentCount", financial.payments.paymentCount),
            (0, reports_contract_1.metric)("averagePayment", financial.payments.paymentCount > 0
                ? (0, reporting_1.toNumber)(financial.payments.paymentTotal) /
                    financial.payments.paymentCount
                : null),
            /* §21: الملغى يُعرض عدداً ولا يدخل المجاميع */
            (0, reports_contract_1.metric)("cancelledPayments", cancelled),
        ]),
        charts: [(0, reports_assemble_1.assemblePaymentMethodChart)(financial.methods)],
        table: (0, reports_table_1.buildTable)({
            columns: reports_tables_finance_1.PAYMENT_COLUMNS,
            rows: table.rows,
            total: table.total,
            request,
            sort,
        }),
    };
};
exports.paymentsReportService = paymentsReportService;
// ======================================================
// الإيصالات — §24
// ======================================================
const receiptsReportService = async (query) => {
    const { selection, academicYear, scoped, request } = await prepare("receipts", query);
    const sort = (0, reports_table_1.resolveSort)(request, reports_tables_finance_1.RECEIPT_SORT);
    const [counts, table] = await Promise.all([
        (0, reports_rows_finance_1.receiptCounts)(scoped),
        (0, reports_rows_finance_1.fetchReceiptRows)(scoped, request, sort),
    ]);
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "receipts", query, selection, academicYear }),
        summary: (0, reports_contract_1.summaryOf)([
            (0, reports_contract_1.metric)("totalReceipts", counts.total),
            (0, reports_contract_1.metric)("activeReceipts", counts.active),
            (0, reports_contract_1.metric)("cancelledReceipts", counts.cancelled),
            (0, reports_contract_1.metric)("reprintedReceipts", counts.reprinted),
            (0, reports_contract_1.metric)("printedReceipts", counts.printed),
            (0, reports_contract_1.metric)("notPrintedReceipts", counts.notPrinted),
        ]),
        charts: [
            (0, reports_contract_1.chart)({
                key: "receiptStatus",
                title: "حالات الإيصالات",
                kind: "donut",
                unit: "count",
                categories: ["نشط", "ملغى", "أُعيد طبعه"],
                series: [
                    {
                        key: "count",
                        label: "العدد",
                        data: [counts.active, counts.cancelled, counts.reprinted],
                    },
                ],
            }),
        ],
        table: (0, reports_table_1.buildTable)({
            columns: reports_tables_finance_1.RECEIPT_COLUMNS,
            rows: table.rows,
            total: table.total,
            request,
            sort,
        }),
    };
};
exports.receiptsReportService = receiptsReportService;
// ======================================================
// الديون — §25
// ======================================================
const debtsReportService = async (query) => {
    const { selection, academicYear, scoped, request } = await prepare("debts", query);
    const sort = (0, reports_table_1.resolveSort)(request, reports_tables_finance_1.DEBT_SORT);
    const reference = referenceMonth(scoped);
    const period = (0, reports_scope_1.resolvePeriod)(scoped);
    const [financial, table, aging, collections, studentsInDebt] = await Promise.all([
        (0, reports_queries_1.fetchFinancialSnapshot)(scoped, reference),
        (0, reports_rows_finance_1.fetchDebtRows)(scoped, reference, request, sort),
        (0, reports_rows_finance_1.debtAging)(scoped, reference),
        (0, reports_queries_1.aggregateDebtCollections)(period.range),
        (0, reports_queries_1.countStudentsInDebt)((0, reports_scope_1.invoiceScope)(scoped)),
    ]);
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "debts", query, selection, academicYear }),
        summary: (0, reports_assemble_1.assembleDebtSummary)(financial, {
            studentsInDebt,
            collectedOld: collections.collectedOld,
        }),
        charts: [
            (0, reports_contract_1.chart)({
                key: "debtAging",
                title: "تعتيق الدَّين",
                kind: "bar",
                unit: "money",
                categories: reporting_1.DEBT_AGE_BUCKETS.map((bucket) => bucket.label),
                series: [
                    {
                        key: "amount",
                        label: "المبلغ",
                        data: reporting_1.DEBT_AGE_BUCKETS.map((bucket) => aging.get(bucket.key)?.amount ?? 0),
                    },
                ],
            }),
        ],
        table: (0, reports_table_1.buildTable)({
            columns: reports_tables_finance_1.DEBT_COLUMNS,
            rows: table.rows,
            total: table.total,
            request,
            sort,
        }),
    };
};
exports.debtsReportService = debtsReportService;
// ======================================================
// تحصيل الديون — §26
// ======================================================
const debtCollectionsReportService = async (query) => {
    const { selection, academicYear, scoped, request } = await prepare("debt-collections", query);
    const sort = (0, reports_table_1.resolveSort)(request, reports_tables_finance_1.DEBT_COLLECTION_SORT);
    const period = (0, reports_scope_1.resolvePeriod)(scoped);
    const [collections, table] = await Promise.all([
        (0, reports_queries_1.aggregateDebtCollections)(period.range),
        (0, reports_rows_finance_1.fetchDebtCollectionRows)(scoped, request, sort),
    ]);
    const shareTotal = table.rows.reduce((sum, row) => sum + row.teacherShareAmount, 0);
    return {
        meta: (0, reports_meta_1.buildMeta)({
            report: "debt-collections",
            query,
            selection,
            academicYear,
        }),
        summary: (0, reports_contract_1.summaryOf)([
            (0, reports_contract_1.metric)("collectedOldDebt", (0, reporting_1.toNumber)(collections.collectedOld)),
            (0, reports_contract_1.metric)("collectionCount", collections.collectionCount),
            /*
             * حصصُ الأساتذة من **هذه الصفحة** لا من الفترة كلِّها.
             *
             * والعنوانُ يقول ذلك، لأنّ حساب المجموع الحقيقي يحتاج
             * تجميعاً مستقلّاً لم يُطلب هنا — وإظهارُ رقمِ صفحةٍ كأنّه
             * مجموعُ فترةٍ كذبٌ صامت.
             */
            (0, reports_contract_1.metric)("teacherSharesOnPage", shareTotal),
        ]),
        charts: [],
        table: (0, reports_table_1.buildTable)({
            columns: reports_tables_finance_1.DEBT_COLLECTION_COLUMNS,
            rows: table.rows,
            total: table.total,
            request,
            sort,
        }),
    };
};
exports.debtCollectionsReportService = debtCollectionsReportService;
// ======================================================
// التخليص — §29
// ======================================================
const settlementsReportService = async (query) => {
    const { selection, academicYear, scoped, request } = await prepare("settlements", query);
    const sort = (0, reports_table_1.resolveSort)(request, reports_tables_finance_1.SETTLEMENT_SORT);
    const [counts, table, byTeacher, teachers] = await Promise.all([
        (0, reports_rows_teacher_1.settlementCounts)(scoped),
        (0, reports_rows_teacher_1.fetchSettlementRows)(scoped, request, sort),
        (0, reports_rows_teacher_1.entitlementByTeacher)(scoped),
        (0, reports_queries_1.fetchTeacherSnapshot)(scoped),
    ]);
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "settlements", query, selection, academicYear }),
        summary: (0, reports_contract_1.summaryOf)([
            (0, reports_contract_1.metric)("totalSettlements", counts.total),
            (0, reports_contract_1.metric)("draftSettlements", counts.draft),
            (0, reports_contract_1.metric)("confirmedSettlements", counts.confirmed),
            (0, reports_contract_1.metric)("paidSettlements", counts.paid),
            (0, reports_contract_1.metric)("cancelledSettlements", counts.cancelled),
            /* المسوّدة خارج الالتزام — حسابٌ لم يُعتمد */
            (0, reports_contract_1.metric)("committedEntitlement", counts.committedAmount),
            (0, reports_contract_1.metric)("draftEntitlement", counts.draftAmount),
            (0, reports_contract_1.metric)("teacherPaid", (0, reporting_1.toNumber)(teachers.allocations.allocatedPaid)),
        ]),
        charts: [
            (0, reports_contract_1.chart)({
                key: "entitlementByTeacher",
                title: "المستحقّ حسب الأستاذ",
                kind: "horizontalBar",
                unit: "money",
                categories: byTeacher.map((row) => row.name),
                series: [
                    {
                        key: "settlements",
                        label: "من التخليص",
                        data: byTeacher.map((row) => row.fromSettlements),
                    },
                    {
                        key: "debtShares",
                        label: "من حصص الدَّين",
                        data: byTeacher.map((row) => row.fromDebtShares),
                    },
                ],
                drill: {
                    to: "/reports/settlements",
                    param: "teacherId",
                    categoryIds: byTeacher.map((row) => row.id),
                },
            }),
        ],
        table: (0, reports_table_1.buildTable)({
            columns: reports_tables_finance_1.SETTLEMENT_COLUMNS,
            rows: table.rows,
            total: table.total,
            request,
            sort,
            rowDrill: reports_tables_finance_1.SETTLEMENT_ROW_DRILL,
        }),
    };
};
exports.settlementsReportService = settlementsReportService;
// ======================================================
// دفعات الأساتذة — §31
// ======================================================
const teacherPaymentsReportService = async (query) => {
    const { selection, academicYear, scoped, request } = await prepare("teacher-payments", query);
    const sort = (0, reports_table_1.resolveSort)(request, reports_tables_finance_1.TEACHER_PAYMENT_SORT);
    const [teachers, table, cancelled] = await Promise.all([
        (0, reports_queries_1.fetchTeacherSnapshot)(scoped),
        (0, reports_rows_teacher_1.fetchTeacherPaymentRows)(scoped, request, sort),
        client_1.prisma.teacherPayment.count({ where: { status: "CANCELLED" } }),
    ]);
    const paid = (0, reporting_1.toNumber)(teachers.payments.teacherPaymentTotal);
    const allocated = (0, reporting_1.toNumber)(teachers.allocations.allocatedPaid);
    return {
        meta: (0, reports_meta_1.buildMeta)({
            report: "teacher-payments",
            query,
            selection,
            academicYear,
        }),
        summary: (0, reports_contract_1.summaryOf)([
            (0, reports_contract_1.metric)("teacherPaid", paid),
            (0, reports_contract_1.metric)("teacherPaymentCount", teachers.payments.teacherPaymentCount),
            (0, reports_contract_1.metric)("averageTeacherPayment", teachers.payments.teacherPaymentCount > 0
                ? paid / teachers.payments.teacherPaymentCount
                : null),
            /* §32 §39: ينبغي أن يكون صفراً */
            (0, reports_contract_1.metric)("unallocatedTeacherPayment", paid - allocated),
            (0, reports_contract_1.metric)("cancelledTeacherPayments", cancelled),
        ]),
        charts: [],
        table: (0, reports_table_1.buildTable)({
            columns: reports_tables_finance_1.TEACHER_PAYMENT_COLUMNS,
            rows: table.rows,
            total: table.total,
            request,
            sort,
        }),
    };
};
exports.teacherPaymentsReportService = teacherPaymentsReportService;
// ======================================================
// تخصيصات دفعات الأساتذة — §32
// ======================================================
const allocationsReportService = async (query) => {
    const { selection, academicYear, scoped, request } = await prepare("allocations", query);
    const sort = (0, reports_table_1.resolveSort)(request, reports_tables_finance_1.ALLOCATION_SORT);
    const table = await (0, reports_rows_teacher_1.fetchAllocationRows)(scoped, request, sort);
    const toSettlements = table.rows
        .filter((row) => row.targetKind === "settlement")
        .reduce((sum, row) => sum + row.amount, 0);
    const toDebtShares = table.rows
        .filter((row) => row.targetKind === "debtShare")
        .reduce((sum, row) => sum + row.amount, 0);
    const orphans = table.rows.filter((row) => row.targetKind === "unknown");
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "allocations", query, selection, academicYear }),
        summary: (0, reports_contract_1.summaryOf)([
            (0, reports_contract_1.metric)("allocationCount", table.total),
            (0, reports_contract_1.metric)("allocatedToSettlements", toSettlements),
            (0, reports_contract_1.metric)("allocatedToDebtShares", toDebtShares),
            /* حالةٌ لا ينبغي أن تقع — تُعرض لتُعالَج لا لتُخفى */
            (0, reports_contract_1.metric)("orphanAllocations", orphans.length),
        ]),
        charts: [
            (0, reports_contract_1.chart)({
                key: "allocationTargets",
                title: "وجهة التخصيصات (هذه الصفحة)",
                kind: "donut",
                unit: "money",
                categories: ["تخليص", "حصص دَين"],
                series: [
                    {
                        key: "amount",
                        label: "المبلغ",
                        data: [toSettlements, toDebtShares],
                    },
                ],
            }),
        ],
        table: (0, reports_table_1.buildTable)({
            columns: reports_tables_finance_1.ALLOCATION_COLUMNS,
            rows: table.rows,
            total: table.total,
            request,
            sort,
        }),
    };
};
exports.allocationsReportService = allocationsReportService;
// ======================================================
// التدقيق — §37
// ======================================================
const auditReportService = async (query) => {
    const { selection, academicYear, scoped, request } = await prepare("audit", query);
    const sort = (0, reports_table_1.resolveSort)(request, reports_tables_finance_1.AUDIT_SORT);
    const [counts, table] = await Promise.all([
        (0, reports_rows_audit_1.auditCounts)(scoped),
        (0, reports_rows_audit_1.fetchAuditRows)(scoped, request, sort),
    ]);
    const of = (action) => counts.byAction.find((row) => row.action === action)?._count ?? 0;
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "audit", query, selection, academicYear }),
        summary: (0, reports_contract_1.summaryOf)([
            (0, reports_contract_1.metric)("auditEntries", counts.total),
            (0, reports_contract_1.metric)("auditCreates", of("CREATE")),
            (0, reports_contract_1.metric)("auditUpdates", of("UPDATE")),
            (0, reports_contract_1.metric)("auditCancels", of("CANCEL")),
            (0, reports_contract_1.metric)("auditConfirms", of("CONFIRM")),
            (0, reports_contract_1.metric)("auditRecomputes", of("RECOMPUTE")),
        ]),
        charts: [
            (0, reports_contract_1.chart)({
                key: "auditByEntity",
                title: "الوقائع حسب الكيان",
                kind: "horizontalBar",
                unit: "count",
                categories: counts.byEntity.map((row) => row.entity),
                series: [
                    {
                        key: "count",
                        label: "العدد",
                        data: counts.byEntity.map((row) => row._count),
                    },
                ],
            }),
        ],
        table: (0, reports_table_1.buildTable)({
            columns: reports_tables_finance_1.AUDIT_COLUMNS,
            rows: table.rows,
            total: table.total,
            request,
            sort,
        }),
    };
};
exports.auditReportService = auditReportService;
// ======================================================
// الإلغاءات — §38
// ======================================================
const cancellationsReportService = async (query) => {
    const { selection, academicYear, scoped, request } = await prepare("cancellations", query);
    const table = await (0, reports_rows_audit_1.fetchCancellationRows)(scoped, request);
    const totalAmount = table.rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
    return {
        meta: (0, reports_meta_1.buildMeta)({
            report: "cancellations",
            query,
            selection,
            academicYear,
        }),
        summary: (0, reports_contract_1.summaryOf)([
            (0, reports_contract_1.metric)("cancellationCount", table.total),
            (0, reports_contract_1.metric)("cancelledAmountOnPage", totalAmount),
        ]),
        charts: [],
        table: (0, reports_table_1.buildTable)({
            columns: reports_tables_finance_1.CANCELLATION_COLUMNS,
            rows: table.rows,
            total: table.total,
            request,
            sort: { key: "cancelledAt", direction: "desc", orderBy: {} },
        }),
        /*
         * §72: بلاغُ النقص حين يبلغ مصدرٌ سقفَ الجلب.
         *
         * ويُرسل في `partialErrors` لا يُكتم: شاشةُ مراجعةٍ تعرض
         * مجموعاً ناقصاً بلا تنبيه أسوأُ من شاشةٍ لا تعمل.
         */
        ...(table.truncated
            ? {
                partialErrors: [
                    {
                        section: "table",
                        message: "بلغ أحد المصادر سقف الجلب — القائمة ناقصة. ضيّق الفترة لرؤية الكلّ.",
                    },
                ],
            }
            : {}),
    };
};
exports.cancellationsReportService = cancellationsReportService;
// ======================================================
// جودة البيانات — §39
// ======================================================
const dataQualityReportService = async (query) => {
    const { selection, academicYear, request } = await prepare("data-quality", query);
    const issues = await (0, reports_rows_audit_1.runDataQualityChecks)();
    const critical = issues.filter((issue) => issue.severity === "critical" && issue.count > 0);
    const warnings = issues.filter((issue) => issue.severity === "warning" && issue.count > 0);
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "data-quality", query, selection, academicYear }),
        summary: (0, reports_contract_1.summaryOf)([
            (0, reports_contract_1.metric)("checksRun", issues.length),
            (0, reports_contract_1.metric)("criticalIssues", critical.length),
            (0, reports_contract_1.metric)("warningIssues", warnings.length),
            (0, reports_contract_1.metric)("affectedRecords", issues.reduce((sum, issue) => sum + issue.count, 0)),
        ]),
        charts: [],
        /*
         * الفحوصُ كلُّها تُعرض بما فيها الأصفار — §39.
         *
         * والصفرُ معلومة: «فُحص ولم يُوجد» يطمئن، بخلاف غياب السطر
         * الذي يُقرأ «لم يُفحص». وشاشةُ جودة البيانات تفقد قيمتَها إن
         * لم تُظهر ما فحصته.
         *
         * ولا ترقيمَ خادمياً هنا: الفحوصُ سبعةٌ ثابتة، والترقيمُ عبثٌ.
         */
        table: {
            columns: reports_tables_finance_1.DATA_QUALITY_COLUMNS,
            rows: issues,
            pagination: {
                page: 1,
                pageSize: issues.length || 1,
                total: issues.length,
                totalPages: 1,
                hasNext: false,
                hasPrevious: false,
            },
            sort: null,
        },
    };
};
exports.dataQualityReportService = dataQualityReportService;
//# sourceMappingURL=reports.service.finance.js.map