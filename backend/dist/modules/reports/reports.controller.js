"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teachersReportController = exports.attendanceReportsController = exports.studentsReportController = exports.financialReportsController = exports.overviewReportController = void 0;
const api_response_1 = require("../../core/config/api-response");
const reports_service_1 = require("./reports.service");
// --------------------------------------------------
// المتحكّمات
//
// رقيقةٌ عمداً: تقرأ الاستعلامَ المتحقَّق منه وتسلّمه للخدمة. ولا
// منطقَ فيها — §1 يجعل الحسابَ كلَّه في الخدمة، والمتحكّمُ داخلٌ في
// ذلك كالواجهة.
//
// ومصنعٌ واحد لأنّ التوقيع واحد: كلُّ تقريرٍ يأخذ نفس الاستعلام
// ويُرجع نفس المظروف (§57). وكتابةُ خمسِ دوالٍّ متطابقة كانت ستدعو
// إلى اختلافٍ بينها عند أوّل تعديل.
// --------------------------------------------------
const reportController = (service, label) => async (req, res) => {
    const report = await service(req.query);
    return api_response_1.ApiResponse.success(res, report, `${label} report retrieved`);
};
exports.overviewReportController = reportController(reports_service_1.overviewReportService, "Overview");
exports.financialReportsController = reportController(reports_service_1.financialReportService, "Financial");
exports.studentsReportController = reportController(reports_service_1.studentsReportService, "Students");
exports.attendanceReportsController = reportController(reports_service_1.attendanceReportService, "Attendance");
exports.teachersReportController = reportController(reports_service_1.teachersReportService, "Teachers");
//# sourceMappingURL=reports.controller.js.map