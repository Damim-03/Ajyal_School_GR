"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toNumber = exports.settlementDetailReportService = exports.teacherDetailReportService = exports.studentDetailReportService = exports.sessionsReportService = exports.academicReportService = exports.assignmentsReportService = exports.groupsReportService = exports.subjectsReportService = exports.levelsReportService = exports.stagesReportService = void 0;
const client_1 = require("../../core/prisma/client");
const reporting_1 = require("../../core/reporting");
Object.defineProperty(exports, "toNumber", { enumerable: true, get: function () { return reporting_1.toNumber; } });
const reports_contract_1 = require("./reports.contract");
const reports_filters_1 = require("./reports.filters");
const reports_meta_1 = require("./reports.meta");
const reports_assemble_1 = require("./reports.assemble");
const reports_academic_1 = require("./reports.academic");
const reports_detail_1 = require("./reports.detail");
const reports_table_1 = require("./reports.table");
const reporting_2 = require("../../core/reporting");
// ======================================================
// خدماتُ التقارير الأكاديمية والتفصيلية — §9 §11–§17 §28 §30
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
const tableRequest = (query) => ({
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
});
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
// التقاريرُ الأكاديمية — بُعدٌ واحد بخمس وجوه
// ======================================================
const ACADEMIC_COLUMNS = [
    (0, reports_table_1.column)("name", "الاسم", "text"),
    (0, reports_table_1.column)("context", "السياق", "text"),
    (0, reports_table_1.column)("students", "الطلبة", "number"),
    (0, reports_table_1.column)("assignments", "الإسنادات", "number"),
    (0, reports_table_1.column)("sessions", "الحصص", "number"),
    (0, reports_table_1.column)("attendanceRate", "نسبة الحضور", "percent"),
    (0, reports_table_1.column)("invoiced", "المفوتر", "money"),
    (0, reports_table_1.column)("collected", "المحصَّل", "money"),
    (0, reports_table_1.column)("outstanding", "المتبقّي", "money"),
];
const DIMENSION_TITLE = {
    educationStage: "الأطوار التعليمية",
    level: "المستويات",
    subject: "المواد",
    studyGroup: "الأفواج",
    teachingAssignment: "الإسنادات التدريسية",
};
const DIMENSION_PARAM = {
    educationStage: "educationStageId",
    level: "levelId",
    subject: "subjectId",
    studyGroup: "studyGroupId",
    teachingAssignment: "subjectId",
};
/**
 * فرزٌ في الذاكرة لا في القاعدة.
 *
 * الصفوفُ هنا مبنيّةٌ من طيّ خمسة استعلامات، فلا يقابلها عمودٌ
 * يُفرز به. والفرزُ على القائمة المطويّة كاملةً لا على صفحةٍ منها،
 * فهو صادقٌ خلافاً لفرز صفحة.
 *
 * والقائمةُ البيضاء تُطبَّق هنا أيضاً: `sortBy` مجهولٌ يسقط إلى
 * `students` بدل أن يُقرأ حقلاً غير موجود.
 */
const ACADEMIC_SORT_KEYS = [
    "name",
    "students",
    "assignments",
    "sessions",
    "attendanceRate",
    "invoiced",
    "collected",
    "outstanding",
];
const sortBuckets = (buckets, sortBy, direction) => {
    const key = ACADEMIC_SORT_KEYS.includes(sortBy ?? "")
        ? sortBy
        : "students";
    const sign = direction === "asc" ? 1 : -1;
    return [...buckets].sort((a, b) => {
        const left = a[key];
        const right = b[key];
        if (typeof left === "string" || typeof right === "string") {
            return sign * String(left ?? "").localeCompare(String(right ?? ""), "ar");
        }
        /*
         * `null` يُدفع إلى الآخر دائماً بصرف النظر عن الاتجاه.
         *
         * فوجٌ بلا سجلّاتِ حضورٍ نسبتُه `null` لا صفر (§48). ولو
         * عُومل صفراً لتصدّر ترتيبَ «الأسوأ حضوراً» فوجٌ لم يبدأ
         * الدراسة — تنبيهٌ كاذبٌ في قائمةٍ تُقرأ لاتّخاذ قرار.
         */
        if (left === null)
            return 1;
        if (right === null)
            return -1;
        return sign * (right - left);
    });
};
const academicChart = (dimension, buckets) => {
    const top = buckets.slice(0, 12);
    return [
        (0, reports_contract_1.chart)({
            key: `${dimension}Students`,
            title: `الطلبة حسب ${DIMENSION_TITLE[dimension]}`,
            kind: "horizontalBar",
            unit: "count",
            categories: top.map((row) => row.name),
            series: [
                {
                    key: "students",
                    label: "الطلبة",
                    data: top.map((row) => row.students),
                },
            ],
            drill: {
                to: "/reports/students",
                param: DIMENSION_PARAM[dimension],
                categoryIds: top.map((row) => row.id),
            },
        }),
        (0, reports_contract_1.chart)({
            key: `${dimension}Revenue`,
            title: `الإيراد حسب ${DIMENSION_TITLE[dimension]}`,
            kind: "horizontalBar",
            unit: "money",
            categories: top.map((row) => row.name),
            series: [
                {
                    key: "collected",
                    label: "المحصَّل",
                    data: top.map((row) => row.collected),
                },
                {
                    key: "outstanding",
                    label: "المتبقّي",
                    data: top.map((row) => row.outstanding),
                },
            ],
            drill: {
                to: "/reports/financial",
                param: DIMENSION_PARAM[dimension],
                categoryIds: top.map((row) => row.id),
            },
        }),
        (0, reports_contract_1.chart)({
            key: `${dimension}Attendance`,
            title: `نسبة الحضور حسب ${DIMENSION_TITLE[dimension]}`,
            kind: "horizontalBar",
            unit: "percent",
            categories: top.map((row) => row.name),
            series: [
                {
                    key: "rate",
                    label: "نسبة الحضور",
                    data: top.map((row) => row.attendanceRate),
                },
            ],
            drill: {
                to: "/reports/attendance",
                param: DIMENSION_PARAM[dimension],
                categoryIds: top.map((row) => row.id),
            },
        }),
    ];
};
const academicService = (reportKey, dimension) => async (query) => {
    const { selection, academicYear, scoped, request } = await prepare(reportKey, query);
    const buckets = await (0, reports_academic_1.aggregateAcademic)(scoped, dimension);
    const sorted = sortBuckets(buckets, query.sortBy, query.sortDir);
    /*
     * الترقيمُ بعد الطيّ والفرز.
     *
     * الأبعادُ قليلةٌ بطبيعتها — ثلاثةُ أطوار، عشرةُ مستويات،
     * عشراتُ الأفواج. فالجلبُ الكامل ثمّ التقطيع أرخصُ من محاولة
     * ترقيمٍ خادميّ على تجميعٍ لا يقابله جدول.
     */
    const start = (request.page - 1) * request.pageSize;
    const page = sorted.slice(start, start + request.pageSize);
    const totals = buckets.reduce((sum, bucket) => ({
        students: sum.students + bucket.students,
        sessions: sum.sessions + bucket.sessions,
        invoiced: sum.invoiced + bucket.invoiced,
        collected: sum.collected + bucket.collected,
        outstanding: sum.outstanding + bucket.outstanding,
    }), { students: 0, sessions: 0, invoiced: 0, collected: 0, outstanding: 0 });
    const attendance = (0, reporting_2.mergeAttendanceCounts)(buckets.map((bucket) => bucket.attendance));
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: reportKey, query, selection, academicYear }),
        summary: {
            ...(0, reports_contract_1.summaryOf)([
                (0, reports_contract_1.metric)(`${dimension}Count`, buckets.length),
                /*
                 * مجموعُ الطلبة عبر الأبعاد **قد يفوق** عددَ طلبة
                 * المؤسسة: طالبٌ في موادَّ من مستويين يُعدّ في كليهما.
                 *
                 * والاسمُ يقول ذلك — «مجموع الطلبة عبر الفئات» لا «عدد
                 * الطلبة» — لئلّا يُقرأ الرقمُ عدداً للأشخاص فيناقض
                 * تقريرَ الطلبة.
                 */
                (0, reports_contract_1.metric)("studentsAcrossBuckets", totals.students),
                (0, reports_contract_1.metric)("sessionCount", totals.sessions),
                (0, reports_contract_1.metric)("invoiced", totals.invoiced),
                (0, reports_contract_1.metric)("collected", totals.collected),
                (0, reports_contract_1.metric)("outstanding", totals.outstanding),
            ]),
            ...(0, reports_assemble_1.assembleAttendanceSummary)(attendance),
        },
        charts: academicChart(dimension, sorted),
        table: (0, reports_table_1.buildTable)({
            columns: ACADEMIC_COLUMNS,
            rows: page,
            total: buckets.length,
            request,
            sort: {
                key: ACADEMIC_SORT_KEYS.includes(query.sortBy ?? "")
                    ? query.sortBy
                    : "students",
                direction: query.sortDir,
                orderBy: {},
            },
        }),
    };
};
exports.stagesReportService = academicService("stages", "educationStage");
exports.levelsReportService = academicService("levels", "level");
exports.subjectsReportService = academicService("subjects", "subject");
exports.groupsReportService = academicService("groups", "studyGroup");
exports.assignmentsReportService = academicService("assignments", "teachingAssignment");
/**
 * التقريرُ الأكاديمي الجامع — §11.
 *
 * لا يكرّر الأبعاد الخمسة في استجابةٍ واحدة: ذلك يجلب كلَّ شيءٍ
 * خمسَ مرّات لشاشةٍ تعرض ملخّصاً. يعطي أعلى مستوى (الأطوار) ومنه
 * يُنقَّب إلى ما تحته.
 */
exports.academicReportService = academicService("academic", "educationStage");
// ======================================================
// الحصص — §17
// ======================================================
const SESSION_COLUMNS = [
    (0, reports_table_1.column)("sessionDate", "التاريخ", "date", { sortable: true }),
    (0, reports_table_1.column)("lessonNumber", "رقم الحصّة", "number", { sortable: true }),
    (0, reports_table_1.column)("subject", "المادة", "text"),
    (0, reports_table_1.column)("teacher", "الأستاذ", "text"),
    (0, reports_table_1.column)("studyGroup", "الفوج", "text"),
    (0, reports_table_1.column)("status", "الحالة", "status", { sortable: true }),
    (0, reports_table_1.column)("attendanceRecorded", "حضور مسجَّل", "number"),
    (0, reports_table_1.column)("enrolledStudents", "الطلبة المسجَّلون", "number"),
    (0, reports_table_1.column)("note", "ملاحظة", "text", { hiddenByDefault: true }),
];
const SESSION_SORT = {
    allowed: {
        sessionDate: (dir) => ({ sessionDate: dir }),
        lessonNumber: (dir) => ({ lessonNumber: dir }),
        status: (dir) => ({ status: dir }),
    },
    fallback: "sessionDate",
};
const sessionsReportService = async (query) => {
    const { selection, academicYear, scoped, request } = await prepare("sessions", query);
    const sort = (0, reports_table_1.resolveSort)(request, SESSION_SORT);
    const [counts, table] = await Promise.all([
        (0, reports_academic_1.sessionCounts)(scoped),
        (0, reports_academic_1.fetchSessionRows)(scoped, request, sort),
    ]);
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "sessions", query, selection, academicYear }),
        summary: (0, reports_contract_1.summaryOf)([
            (0, reports_contract_1.metric)("sessionCount", counts.total),
            (0, reports_contract_1.metric)("scheduledSessions", counts.scheduled),
            (0, reports_contract_1.metric)("completedSessions", counts.completed),
            (0, reports_contract_1.metric)("cancelledSessions", counts.cancelled),
            (0, reports_contract_1.metric)("sessionsWithAttendance", counts.withAttendance),
            /* §17: وجودُ الحصّة لا يساوي تسجيلَ حضورها */
            (0, reports_contract_1.metric)("sessionsWithoutAttendance", counts.withoutAttendance),
        ]),
        charts: [
            (0, reports_contract_1.chart)({
                key: "sessionStatus",
                title: "حالات الحصص",
                kind: "donut",
                unit: "count",
                categories: ["مجدولة", "مكتملة", "ملغاة"],
                series: [
                    {
                        key: "count",
                        label: "العدد",
                        data: [counts.scheduled, counts.completed, counts.cancelled],
                    },
                ],
            }),
        ],
        table: (0, reports_table_1.buildTable)({
            columns: SESSION_COLUMNS,
            rows: table.rows,
            total: table.total,
            request,
            sort,
        }),
    };
};
exports.sessionsReportService = sessionsReportService;
// ======================================================
// تقاريرُ التفصيل — §9 §28 §30
// ======================================================
const studentDetailReportService = async (studentId, query) => {
    const { selection, academicYear } = await prepare("students", query);
    const result = await (0, reports_detail_1.fetchStudentDetail)(studentId, academicYear?.id);
    if (!result)
        return null;
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "students", query, selection, academicYear }),
        summary: {
            ...(0, reports_contract_1.summaryOf)([
                (0, reports_contract_1.metric)("invoiced", result.financial.invoiced),
                (0, reports_contract_1.metric)("collected", result.financial.paid),
                (0, reports_contract_1.metric)("outstanding", result.financial.remaining),
            ]),
            ...(0, reports_assemble_1.assembleAttendanceSummary)(result.attendanceCounts),
        },
        charts: [
            (0, reports_contract_1.chart)({
                key: "studentAttendance",
                title: "توزيع الحضور",
                kind: "donut",
                unit: "count",
                categories: ["حاضر", "غائب", "متأخّر", "معذور"],
                series: [
                    {
                        key: "count",
                        label: "العدد",
                        data: [
                            result.attendanceCounts.PRESENT,
                            result.attendanceCounts.ABSENT,
                            result.attendanceCounts.LATE,
                            result.attendanceCounts.EXCUSED,
                        ],
                    },
                ],
            }),
        ],
        table: null,
        detail: result.detail,
    };
};
exports.studentDetailReportService = studentDetailReportService;
const teacherDetailReportService = async (teacherId, query) => {
    const { selection, academicYear } = await prepare("teachers", query);
    const result = await (0, reports_detail_1.fetchTeacherDetail)(teacherId, academicYear?.id);
    if (!result)
        return null;
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "teachers", query, selection, academicYear }),
        summary: (0, reports_contract_1.summaryOf)([
            (0, reports_contract_1.metric)("teacherEntitlement", result.entitlement),
            (0, reports_contract_1.metric)("teacherPaid", result.paid),
            (0, reports_contract_1.metric)("teacherOutstanding", result.entitlement - result.paid),
        ]),
        charts: [],
        table: null,
        detail: result.detail,
    };
};
exports.teacherDetailReportService = teacherDetailReportService;
const settlementDetailReportService = async (settlementId, query) => {
    const { selection, academicYear } = await prepare("settlements", query);
    const result = await (0, reports_detail_1.fetchSettlementDetail)(settlementId);
    if (!result)
        return null;
    return {
        meta: (0, reports_meta_1.buildMeta)({ report: "settlements", query, selection, academicYear }),
        summary: (0, reports_contract_1.summaryOf)([
            (0, reports_contract_1.metric)("teacherEntitlement", result.teacherAmount),
        ]),
        charts: [],
        table: null,
        detail: result.detail,
    };
};
exports.settlementDetailReportService = settlementDetailReportService;
//# sourceMappingURL=reports.service.academic.js.map