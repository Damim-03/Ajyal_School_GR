"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const api_response_1 = require("../../core/config/api-response");
const app_errors_1 = require("../../core/errors/app.errors");
const reports_filters_1 = require("./reports.filters");
const reports_permissions_1 = require("./reports.permissions");
const client_1 = require("../../core/prisma/client");
const reports_registry_1 = require("./reports.registry");
const reports_export_1 = require("./reports.export");
const reports_service_1 = require("./reports.service");
const reports_service_finance_1 = require("./reports.service.finance");
const reports_service_academic_1 = require("./reports.service.academic");
// ======================================================
// مسارات التقارير — §56
//
// وحدةٌ مستقلّة عن `modules/report` القائمة ولا تمسّها: تلك تخدم
// شاشاتٍ تعمل اليوم، وهذه تُبنى إلى جانبها ثمّ تحلّ محلَّها متى
// اكتملت — استبدالٌ على مراحل لا قطعٌ مفاجئ.
//
// وكلُّ مسارٍ يُسجَّل بمفتاح تقريره، ومنه تُشتقّ ثلاثةُ أشياء:
// الصلاحية (§54)، والفلاتر المدعومة (§4)، والتحقّق من المدخلات.
// فمن يضيف تقريراً لا ينسى حارساً ولا يختاره ارتجالاً.
// ======================================================
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// ======================================================
// مركزُ التصدير والتصدير — §42 §63
//
// يُسجَّلان **قبل** كلّ شيء لأنّ `/exports` و `/:report/export`
// لو جاءا بعد `/students/:studentId` لالتقطهما ذاك كمعرّفَي
// طالب — فيردّ 404 على مسارٍ موجود.
// ======================================================
/**
 * قائمةُ التقارير المتاحة لهذا المستخدم — §63.
 *
 * تُصفّى بصلاحياته لا تُعرض كاملة: قائمةٌ تحوي «سجلّ التدقيق»
 * لمن لا يراه تكشف وجودَه وتدعوه إلى محاولةٍ تُرفض. والتصفيةُ
 * هنا لا في الواجهة (§67).
 *
 * ولا يُدرَج «التصديرات الأخيرة» الذي تطلبه §63: تسجيلُها يحتاج
 * جدولاً في القاعدة، و§1 يمنع إنشاء نموذجٍ للتقارير. فالمسألةُ
 * قرارٌ لم يُتَّخذ بعد، وإغفالُها أصدقُ من قائمةٍ فارغة تُوهم
 * بميزةٍ لا تعمل.
 */
router.get("/exports", (0, permission_middleware_1.requirePermission)("report.view"), (0, async_handler_middleware_1.asyncHandler)(async (req, res) => {
    const roleId = req.user?.roleId;
    const granted = roleId
        ? new Set((await client_1.prisma.rolePermission.findMany({
            where: { roleId },
            select: { permission: { select: { name: true } } },
        })).map((row) => row.permission.name))
        : new Set();
    const available = reports_registry_1.REPORT_REGISTRY.filter((report) => granted.has((0, reports_permissions_1.permissionForReport)(report.key))).map((report) => ({
        key: report.key,
        title: report.title,
        description: report.description,
        group: report.group,
        groupTitle: reports_registry_1.GROUP_TITLE[report.group],
        hasTable: report.hasTable,
        path: `/reports/v2/${report.key}`,
        exportPath: `/reports/v2/${report.key}/export`,
        formats: ["csv", "xlsx"],
    }));
    return api_response_1.ApiResponse.success(res, {
        reports: available,
        formats: [
            { key: "csv", label: "CSV", contentType: reports_export_1.CONTENT_TYPE.csv },
            { key: "xlsx", label: "Excel", contentType: reports_export_1.CONTENT_TYPE.xlsx },
        ],
        /*
         * §42 يطلب PDF والطباعة أيضاً — وهما من الواجهة لا من
         * الخادم. والسببُ مذكورٌ في `reports.export.ts`: PDFKit
         * لا يشكّل العربية. فيُبلَّغ العميلُ صراحةً بدل أن يجد
         * صيغةً ناقصة بلا تفسير.
         */
        clientRendered: ["pdf", "print"],
        note: "PDF والطباعة تُولَّدان في التطبيق لأنّ تشكيل العربية يحتاج محرّك عرض.",
    }, "Export center retrieved");
}));
/**
 * تصديرُ أيِّ تقرير — مسارٌ واحد لكلّها.
 *
 * والصلاحيةُ **مزدوجة**: صلاحيةُ قراءة التقرير نفسه، وفوقها
 * `report.export` (§54). فمن يرى الأرقام على الشاشة لا يُخرجها
 * بالضرورة في ملفٍّ يُنقل — والفصلُ بينهما مقصودٌ في المواصفة.
 */
router.get("/:report/export", (0, validate_middleware_1.validateQuery)(reports_filters_1.exportQuerySchema), (0, async_handler_middleware_1.asyncHandler)(async (req, res) => {
    const key = req.params.report;
    const registered = reports_registry_1.REGISTRY_BY_KEY.get(key);
    if (!registered) {
        throw new app_errors_1.NotFoundException(`Unknown report: ${key}`);
    }
    /*
     * الحارسان يُطبَّقان يدوياً هنا لا كوسيطَين في التعريف.
     *
     * لأنّ الصلاحيةَ الأولى تعتمد على `:report` الذي لا يُعرف إلا
     * وقت الطلب — و`requirePermission` تُبنى بقيمةٍ ثابتة. فيُنادى
     * الوسيطان تباعاً بعد استخراج المفتاح.
     */
    await new Promise((resolve, reject) => (0, permission_middleware_1.requirePermission)((0, reports_permissions_1.permissionForReport)(key))(req, res, (error) => error ? reject(error) : resolve()));
    if (res.headersSent)
        return;
    await new Promise((resolve, reject) => (0, permission_middleware_1.requirePermission)(reports_permissions_1.EXPORT_PERMISSION)(req, res, (error) => error ? reject(error) : resolve()));
    if (res.headersSent)
        return;
    const query = req.query;
    const report = await registered.service(query);
    const format = query.format ?? "xlsx";
    const buffer = (0, reports_export_1.serialize)(report, format, {
        columns: query.columns
            ? String(query.columns)
                .split(",")
                .map((column) => column.trim())
                .filter(Boolean)
            : undefined,
    });
    res.setHeader("Content-Type", reports_export_1.CONTENT_TYPE[format]);
    res.setHeader("Content-Disposition", `attachment; filename="${(0, reports_export_1.exportFilename)(report, format)}"`);
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
}));
const register = (path, key, service) => router.get(path, (0, permission_middleware_1.requirePermission)((0, reports_permissions_1.permissionForReport)(key)), (0, validate_middleware_1.validateQuery)(reports_filters_1.reportQuerySchema), (0, async_handler_middleware_1.asyncHandler)(async (req, res) => {
    const report = await service(req.query);
    return api_response_1.ApiResponse.success(res, report, `${key} report retrieved`);
}));
// --------------------------------------------------
// نظرة العموم والأكاديمي
// --------------------------------------------------
register("/overview", "overview", reports_service_1.overviewReportService);
register("/students", "students", reports_service_1.studentsReportService);
register("/attendance", "attendance", reports_service_1.attendanceReportService);
// --------------------------------------------------
// المالية — جانب الطالب
// --------------------------------------------------
register("/financial", "financial", reports_service_1.financialReportService);
register("/invoices", "invoices", reports_service_finance_1.invoicesReportService);
register("/payments", "payments", reports_service_finance_1.paymentsReportService);
register("/receipts", "receipts", reports_service_finance_1.receiptsReportService);
/* الأخصُّ قبل الأعمّ: `/debt-collections` قبل `/debts` */
register("/debt-collections", "debt-collections", reports_service_finance_1.debtCollectionsReportService);
register("/debts", "debts", reports_service_finance_1.debtsReportService);
// --------------------------------------------------
// المالية — جانب الأستاذ
// --------------------------------------------------
register("/teachers", "teachers", reports_service_1.teachersReportService);
register("/settlements", "settlements", reports_service_finance_1.settlementsReportService);
register("/teacher-payments", "teacher-payments", reports_service_finance_1.teacherPaymentsReportService);
register("/allocations", "allocations", reports_service_finance_1.allocationsReportService);
// --------------------------------------------------
// الأكاديمي — §11 إلى §17
// --------------------------------------------------
register("/academic", "academic", reports_service_academic_1.academicReportService);
register("/stages", "stages", reports_service_academic_1.stagesReportService);
register("/levels", "levels", reports_service_academic_1.levelsReportService);
register("/subjects", "subjects", reports_service_academic_1.subjectsReportService);
register("/groups", "groups", reports_service_academic_1.groupsReportService);
register("/assignments", "assignments", reports_service_academic_1.assignmentsReportService);
register("/sessions", "sessions", reports_service_academic_1.sessionsReportService);
// --------------------------------------------------
// المراجعة — §37 §38 §39
// --------------------------------------------------
register("/audit", "audit", reports_service_finance_1.auditReportService);
register("/cancellations", "cancellations", reports_service_finance_1.cancellationsReportService);
register("/data-quality", "data-quality", reports_service_finance_1.dataQualityReportService);
// --------------------------------------------------
// التفصيل — §9 §28 §30
//
// تُسجَّل **بعد** مساراتها الجامعة: `/students` قبل
// `/students/:studentId`. ولولا الترتيب لالتقط المسارُ المعلَّم
// كلمةَ `students` نفسها في بعض المطابقات.
//
// وصلاحيةُ التفصيل هي صلاحيةُ الجامع: من يرى قائمةَ الأساتذة
// ومستحقّاتِهم يرى تفصيلَ واحدٍ منهم. والعكسُ ثغرة.
// --------------------------------------------------
const registerDetail = (path, key, param, service) => router.get(path, (0, permission_middleware_1.requirePermission)((0, reports_permissions_1.permissionForReport)(key)), (0, validate_middleware_1.validateQuery)(reports_filters_1.reportQuerySchema), (0, async_handler_middleware_1.asyncHandler)(async (req, res) => {
    const report = await service(req.params[param], req.query);
    /*
     * الكيانُ غيرُ الموجود يردّ 404 لا 200 بجسمٍ فارغ.
     *
     * و200 بمظروفٍ خالٍ كان سيجعل الواجهةَ ترسم شاشةً بيضاء بلا
     * تفسير، ويخلط «طالبٌ لا وجود له» بـ«طالبٌ بلا نشاط».
     *
     * والرميُ لا الردُّ المباشر: `errorHandler` في التطبيق يوحّد
     * شكلَ الخطأ لكلّ المسارات، وصياغةُ 404 هنا بيدٍ كانت
     * ستُنتج شكلاً يخالف بقيةَ النظام.
     */
    if (!report) {
        throw new app_errors_1.NotFoundException(`${key} not found`);
    }
    return api_response_1.ApiResponse.success(res, report, `${key} detail retrieved`);
}));
registerDetail("/students/:studentId", "students", "studentId", reports_service_academic_1.studentDetailReportService);
registerDetail("/teachers/:teacherId", "teachers", "teacherId", reports_service_academic_1.teacherDetailReportService);
registerDetail("/settlements/:settlementId", "settlements", "settlementId", reports_service_academic_1.settlementDetailReportService);
exports.default = router;
//# sourceMappingURL=reports.route.js.map