"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teachersReportService = exports.attendanceReportService = exports.studentsReportService = exports.financialReportService = exports.overviewReportService = void 0;
const client_1 = require("../../core/prisma/client");
const reporting_1 = require("../../core/reporting");
const reports_contract_1 = require("./reports.contract");
const reports_filters_1 = require("./reports.filters");
const reports_meta_1 = require("./reports.meta");
const reports_assemble_1 = require("./reports.assemble");
const reports_queries_1 = require("./reports.queries");
const reports_scope_1 = require("./reports.scope");
const reports_rows_1 = require("./reports.rows");
const reports_table_1 = require("./reports.table");
const reports_tables_1 = require("./reports.tables");
// ======================================================
// خدمةُ التقارير
//
// كلُّ تقريرٍ يمرّ بأربع خطواتٍ بهذا الترتيب:
//
//   1. تصفيةُ الفلاتر بقدرات التقرير   — §4
//   2. حلُّ الفترة وفترةِ المقارنة       — §34 §58
//   3. جلبٌ متوازٍ                       — §51
//   4. تجميعٌ نقيّ إلى المظروف الموحّد    — §57
//
// والخطوةُ الأولى قبل كلّ شيء: ما لا يدعمه التقريرُ لا يصل إلى
// استعلامٍ أصلاً، فلا يُقيّد نتيجةً بلا أن يُعلَن.
// ======================================================
const academicYearOf = async (id) => {
    if (id) {
        return client_1.prisma.academicYear.findUnique({
            where: { id },
            select: { id: true, name: true },
        });
    }
    /*
     * بلا سنةٍ مختارة تُستعمل الجارية.
     *
     * والسقوطُ إلى `null` مقبول: مؤسسةٌ لم تُنشئ سنةً بعد تعرض
     * تقاريرَ فارغةً بحالةٍ مفهومة، لا خطأً يُوهم بعطبٍ في النظام.
     */
    return client_1.prisma.academicYear.findFirst({
        where: { isCurrent: true },
        select: { id: true, name: true },
    });
};
/**
 * فترةُ المرجع لحساب «الدَّين القديم».
 *
 * الشهرُ المختار إن وُجد، وإلّا شهرُ نهاية المدى، وإلّا الشهرُ
 * الجاري. والترتيبُ مقصود: «قديم» تعني «أقدمُ ممّا أنظر إليه»، فإن
 * كنتُ أنظر إلى سبتمبر فدَينُ أغسطس قديمٌ ولو كنّا في ديسمبر.
 */
const referenceMonth = (query) => {
    const period = (0, reports_scope_1.resolvePeriod)(query);
    if (period.yearMonth)
        return period.yearMonth;
    if (period.range)
        return (0, reporting_1.yearMonthOf)(period.range.to);
    return (0, reporting_1.yearMonthOf)(new Date());
};
// ======================================================
// نظرةُ العموم — §5 §6
// ======================================================
const overviewReportService = async (query) => {
    const { filters } = (0, reports_filters_1.applyCapability)("overview", query);
    const selection = (0, reports_meta_1.resolveSelection)("overview", filters, query.comparison);
    const academicYear = await academicYearOf(filters.academicYearId);
    const scoped = { ...filters, academicYearId: academicYear?.id };
    const reference = referenceMonth(scoped);
    const period = (0, reports_scope_1.resolvePeriod)(scoped);
    const previous = selection.previous
        ? (0, reports_meta_1.previousQuery)(scoped, selection)
        : undefined;
    /*
     * الفترتان تُجلبان معاً.
     *
     * تسلسلُهما كان سيضاعف زمنَ الشاشة الأولى بلا سبب — وهي الشاشةُ
     * التي يُقاس عليها انطباعُ المستخدم عن سرعة النظام كلِّه.
     */
    const [financial, teachers, attendanceCounts, debtCollections, studentsInDebt, previousFinancial, previousTeachers, previousAttendance,] = await Promise.all([
        (0, reports_queries_1.fetchFinancialSnapshot)(scoped, reference),
        (0, reports_queries_1.fetchTeacherSnapshot)(scoped),
        (0, reports_queries_1.fetchAttendanceSnapshot)(scoped),
        (0, reports_queries_1.aggregateDebtCollections)(period.range),
        (0, reports_queries_1.countStudentsInDebt)((0, reports_scope_1.invoiceScope)(scoped)),
        previous ? (0, reports_queries_1.fetchFinancialSnapshot)(previous, reference) : undefined,
        previous ? (0, reports_queries_1.fetchTeacherSnapshot)(previous) : undefined,
        previous ? (0, reports_queries_1.fetchAttendanceSnapshot)(previous) : undefined,
    ]);
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "overview", query, selection, academicYear }),
        summary: {
            ...(0, reports_assemble_1.assembleFinancialSummary)({
                current: financial,
                previous: previousFinancial,
            }),
            ...(0, reports_assemble_1.assembleDebtSummary)(financial, {
                studentsInDebt,
                collectedOld: debtCollections.collectedOld,
            }),
            ...(0, reports_assemble_1.assembleTeacherSummary)(teachers, previousTeachers),
            ...(0, reports_assemble_1.assembleAttendanceSummary)(attendanceCounts, previousAttendance),
            ...(0, reports_assemble_1.assembleCashFlowSummary)({
                studentPayments: financial.payments.paymentTotal,
                debtCollections: debtCollections.collectedOld,
                teacherPayments: teachers.payments.teacherPaymentTotal,
            }),
        },
        charts: [
            (0, reports_assemble_1.assembleMonthlyFinancialChart)(financial.byMonth),
            (0, reports_assemble_1.assembleInvoiceStatusChart)(financial.byStatus),
            (0, reports_assemble_1.assembleAttendanceChart)(attendanceCounts),
        ],
        /*
         * §5: نظرةُ العموم بلا جدول.
         *
         * غرضُها «صورةُ المؤسسة في ثوانٍ»، والجدولُ يجرّ القارئَ إلى
         * التفاصيل في الشاشة التي وُجدت لتفاديها. والتفاصيلُ خلف
         * التنقيب.
         */
        table: null,
    };
};
exports.overviewReportService = overviewReportService;
// ======================================================
// التقرير المالي — §20 §21
// ======================================================
const financialReportService = async (query) => {
    const { filters } = (0, reports_filters_1.applyCapability)("financial", query);
    const selection = (0, reports_meta_1.resolveSelection)("financial", filters, query.comparison);
    const academicYear = await academicYearOf(filters.academicYearId);
    const scoped = { ...filters, academicYearId: academicYear?.id };
    const reference = referenceMonth(scoped);
    const period = (0, reports_scope_1.resolvePeriod)(scoped);
    const previous = selection.previous
        ? (0, reports_meta_1.previousQuery)(scoped, selection)
        : undefined;
    const [financial, debtCollections, studentsInDebt, previousFinancial] = await Promise.all([
        (0, reports_queries_1.fetchFinancialSnapshot)(scoped, reference),
        (0, reports_queries_1.aggregateDebtCollections)(period.range),
        (0, reports_queries_1.countStudentsInDebt)((0, reports_scope_1.invoiceScope)(scoped)),
        previous ? (0, reports_queries_1.fetchFinancialSnapshot)(previous, reference) : undefined,
    ]);
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "financial", query, selection, academicYear }),
        summary: {
            ...(0, reports_assemble_1.assembleFinancialSummary)({
                current: financial,
                previous: previousFinancial,
            }),
            ...(0, reports_assemble_1.assembleDebtSummary)(financial, {
                studentsInDebt,
                collectedOld: debtCollections.collectedOld,
            }),
        },
        charts: [
            (0, reports_assemble_1.assembleMonthlyFinancialChart)(financial.byMonth),
            (0, reports_assemble_1.assembleInvoiceStatusChart)(financial.byStatus),
            (0, reports_assemble_1.assemblePaymentMethodChart)(financial.methods),
        ],
        table: null,
    };
};
exports.financialReportService = financialReportService;
// ======================================================
// تقرير الطلبة — §8
// ======================================================
const studentsReportService = async (query) => {
    const { filters } = (0, reports_filters_1.applyCapability)("students", query);
    const selection = (0, reports_meta_1.resolveSelection)("students", filters, query.comparison);
    const academicYear = await academicYearOf(filters.academicYearId);
    const scoped = { ...filters, academicYearId: academicYear?.id };
    const request = {
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
    };
    const sort = (0, reports_table_1.resolveSort)(request, reports_tables_1.STUDENT_SORT);
    const [counts, table, attendanceCounts] = await Promise.all([
        (0, reports_rows_1.studentCounts)(scoped),
        (0, reports_rows_1.fetchStudentRows)(scoped, request, sort),
        (0, reports_queries_1.fetchAttendanceSnapshot)(scoped),
    ]);
    const genderChart = (0, reports_contract_1.chart)({
        key: "studentsByGender",
        title: "توزيع الطلبة بالجنس",
        kind: "donut",
        unit: "count",
        categories: counts.byGender.map((row) => row.gender === "MALE" ? "ذكور" : "إناث"),
        series: [
            {
                key: "count",
                label: "العدد",
                data: counts.byGender.map((row) => row._count),
            },
        ],
    });
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "students", query, selection, academicYear }),
        summary: {
            ...(0, reports_contract_1.summaryOf)([
                (0, reports_contract_1.metric)("totalStudents", counts.total),
                (0, reports_contract_1.metric)("activeStudents", counts.active),
                (0, reports_contract_1.metric)("inactiveStudents", counts.inactive),
                (0, reports_contract_1.metric)("activeRate", counts.activeRate),
                (0, reports_contract_1.metric)("studentsInDebt", counts.studentsInDebt),
            ]),
            ...(0, reports_assemble_1.assembleAttendanceSummary)(attendanceCounts),
        },
        charts: [genderChart, (0, reports_assemble_1.assembleAttendanceChart)(attendanceCounts)],
        table: (0, reports_table_1.buildTable)({
            columns: reports_tables_1.STUDENT_COLUMNS,
            rows: table.rows,
            total: table.total,
            request,
            sort,
            rowDrill: reports_tables_1.STUDENT_ROW_DRILL,
        }),
    };
};
exports.studentsReportService = studentsReportService;
// ======================================================
// تقرير الحضور — §18 §19
// ======================================================
const attendanceReportService = async (query) => {
    const { filters } = (0, reports_filters_1.applyCapability)("attendance", query);
    const selection = (0, reports_meta_1.resolveSelection)("attendance", filters, query.comparison);
    const academicYear = await academicYearOf(filters.academicYearId);
    const scoped = { ...filters, academicYearId: academicYear?.id };
    const request = {
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
    };
    const sort = (0, reports_table_1.resolveSort)(request, reports_tables_1.ATTENDANCE_SORT);
    const previous = selection.previous
        ? (0, reports_meta_1.previousQuery)(scoped, selection)
        : undefined;
    const [counts, table, previousCounts] = await Promise.all([
        (0, reports_queries_1.fetchAttendanceSnapshot)(scoped),
        (0, reports_rows_1.fetchAttendanceRows)(scoped, request, sort),
        previous ? (0, reports_queries_1.fetchAttendanceSnapshot)(previous) : undefined,
    ]);
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "attendance", query, selection, academicYear }),
        summary: (0, reports_assemble_1.assembleAttendanceSummary)(counts, previousCounts),
        charts: [(0, reports_assemble_1.assembleAttendanceChart)(counts)],
        table: (0, reports_table_1.buildTable)({
            columns: reports_tables_1.ATTENDANCE_COLUMNS,
            rows: table.rows,
            total: table.total,
            request,
            sort,
        }),
    };
};
exports.attendanceReportService = attendanceReportService;
// ======================================================
// تقرير الأساتذة — §27
// ======================================================
const teachersReportService = async (query) => {
    const { filters } = (0, reports_filters_1.applyCapability)("teachers", query);
    const selection = (0, reports_meta_1.resolveSelection)("teachers", filters, query.comparison);
    const academicYear = await academicYearOf(filters.academicYearId);
    const scoped = { ...filters, academicYearId: academicYear?.id };
    const request = {
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
    };
    const sort = (0, reports_table_1.resolveSort)(request, reports_tables_1.TEACHER_SORT);
    const previous = selection.previous
        ? (0, reports_meta_1.previousQuery)(scoped, selection)
        : undefined;
    const [teachers, table, previousTeachers] = await Promise.all([
        (0, reports_queries_1.fetchTeacherSnapshot)(scoped),
        (0, reports_rows_1.fetchTeacherRows)(scoped, request, sort),
        previous ? (0, reports_queries_1.fetchTeacherSnapshot)(previous) : undefined,
    ]);
    /*
     * ترتيبُ المستحقّين تنازلياً — من الصفحة المعروضة وحدها.
     *
     * وهذا قيدٌ يجب أن يُعرف: الرسمُ يعرض «أعلى مستحقّي هذه الصفحة»
     * لا أعلى المؤسسة، لأنّ المستحقّ محسوبٌ بعد الجلب من ثلاثة
     * مصادر فلا يُفرز في القاعدة. وعنوانُ الرسم يقول ذلك صراحةً بدل
     * أن يوهم بترتيبٍ شامل.
     */
    const ranked = [...table.rows].sort((a, b) => b.entitlement - a.entitlement);
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "teachers", query, selection, academicYear }),
        summary: (0, reports_assemble_1.assembleTeacherSummary)(teachers, previousTeachers),
        charts: [
            (0, reports_contract_1.chart)({
                key: "entitlementByTeacher",
                title: "المستحقّ حسب الأستاذ (هذه الصفحة)",
                kind: "horizontalBar",
                unit: "money",
                categories: ranked.map((row) => row.name),
                series: [
                    {
                        key: "entitlement",
                        label: "المستحقّ",
                        data: ranked.map((row) => row.entitlement),
                    },
                    {
                        key: "paid",
                        label: "المدفوع",
                        data: ranked.map((row) => row.paid),
                    },
                ],
                drill: {
                    to: "/reports/teachers",
                    param: "teacherId",
                    categoryIds: ranked.map((row) => row.id),
                },
            }),
        ],
        table: (0, reports_table_1.buildTable)({
            columns: reports_tables_1.TEACHER_COLUMNS,
            rows: table.rows,
            total: table.total,
            request,
            sort,
            rowDrill: reports_tables_1.TEACHER_ROW_DRILL,
        }),
    };
};
exports.teachersReportService = teachersReportService;
//# sourceMappingURL=reports.service.js.map