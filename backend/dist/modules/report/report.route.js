"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const report_controller_1 = require("./report.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const report_schema_1 = require("./report.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// --------------------------------------------------
// كلها للقراءة فقط — تجميعات على البيانات القائمة
//
// ملاحظة: صلاحية report.export موجودة بلا مسار،
// فتصدير PDF غير مُنفَّذ بعد (pdfkit مثبَّت وجاهز).
// --------------------------------------------------
router.get("/dashboard", (0, permission_middleware_1.requirePermission)("report.view"), (0, async_handler_middleware_1.asyncHandler)(report_controller_1.dashboardReportController));
router.get("/financial", (0, permission_middleware_1.requirePermission)("report.view"), (0, validate_middleware_1.validateQuery)(report_schema_1.financialReportQuerySchema), (0, async_handler_middleware_1.asyncHandler)(report_controller_1.financialReportController));
router.get("/outstanding", (0, permission_middleware_1.requirePermission)("report.view"), (0, validate_middleware_1.validateQuery)(report_schema_1.outstandingReportQuerySchema), (0, async_handler_middleware_1.asyncHandler)(report_controller_1.outstandingReportController));
router.get("/attendance", (0, permission_middleware_1.requirePermission)("report.view"), (0, validate_middleware_1.validateQuery)(report_schema_1.attendanceReportQuerySchema), (0, async_handler_middleware_1.asyncHandler)(report_controller_1.attendanceReportController));
// --------------------------------------------------
// الكشوف الورقية — كل واحد منها يقابل ورقةً تُطبع
// --------------------------------------------------
router.get("/daily-attendance", (0, permission_middleware_1.requirePermission)("report.view"), (0, validate_middleware_1.validateQuery)(report_schema_1.dailyAttendanceReportQuerySchema), (0, async_handler_middleware_1.asyncHandler)(report_controller_1.dailyAttendanceReportController));
router.get("/monthly-fees", (0, permission_middleware_1.requirePermission)("report.view"), (0, validate_middleware_1.validateQuery)(report_schema_1.monthlyFeesReportQuerySchema), (0, async_handler_middleware_1.asyncHandler)(report_controller_1.monthlyFeesReportController));
router.get("/session-clearance", (0, permission_middleware_1.requirePermission)("report.view"), (0, validate_middleware_1.validateQuery)(report_schema_1.sessionClearanceReportQuerySchema), (0, async_handler_middleware_1.asyncHandler)(report_controller_1.sessionClearanceReportController));
router.get("/expected-sessions", (0, permission_middleware_1.requirePermission)("report.view"), (0, validate_middleware_1.validateQuery)(report_schema_1.expectedSessionsReportQuerySchema), (0, async_handler_middleware_1.asyncHandler)(report_controller_1.expectedSessionsReportController));
exports.default = router;
//# sourceMappingURL=report.route.js.map