"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const teacher_controller_1 = require("./teacher.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const api_response_1 = require("../../core/config/api-response");
const document_types_1 = require("./document.types");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const teacher_schema_1 = require("./teacher.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("teacher.view"), (0, validate_middleware_1.validateQuery)(teacher_schema_1.teacherQuerySchema), (0, async_handler_middleware_1.asyncHandler)(teacher_controller_1.listTeachersController));
// --------------------------------------------------
// GET /api/teachers/:id/statement
//
// كشفُ حساب الأستاذ: كشوفُه في السنة بمستحقّها وما قُبض منه، ومعها
// متأخّراتُه. ويسبق `/:id` لأنّ المسار أطول — ولو تأخّر لالتقطه.
// --------------------------------------------------
router.get("/:id/statement", (0, permission_middleware_1.requirePermission)("teacher.view"), (0, validate_middleware_1.validateParams)(teacher_schema_1.teacherIdSchema), (0, validate_middleware_1.validateQuery)(teacher_schema_1.teacherStatementQuerySchema), (0, async_handler_middleware_1.asyncHandler)(teacher_controller_1.getTeacherStatementController));
/*
 * كتالوج أنواع وثائق الأستاذ — قبل /:id لأنّ "document-types" ليس معرّفاً.
 *
 * والمعروضُ في الواجهة هذا الكتالوجُ وما أضافته الإدارة معاً، فالخانات
 * الافتراضية تُقرأ من هنا ولا تُكرَّر في الواجهة.
 */
router.get("/document-types", (0, permission_middleware_1.requirePermission)("teacher.view"), (0, async_handler_middleware_1.asyncHandler)(async (_req, res) => {
    return api_response_1.ApiResponse.success(res, { types: document_types_1.TEACHER_DOCUMENT_TYPES }, "Document types retrieved");
}));
// --------------------------------------------------
// وثائق ملفّ الأستاذ — بصلاحيات الأستاذ نفسِها
//
// الوثائق جزءٌ من ملفّه لا مورد مستقلّ: من يعدّل بياناته يرفع وثائقه.
// وتسبق `/:id` لأنّ مسارها أطول وأدقّ.
// --------------------------------------------------
router.get("/:id/documents", (0, permission_middleware_1.requirePermission)("teacher.view"), (0, validate_middleware_1.validateParams)(teacher_schema_1.teacherIdSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_controller_1.getTeacherDocumentsController));
router.put("/:id/documents/:type", (0, permission_middleware_1.requirePermission)("teacher.update"), (0, validate_middleware_1.validateParams)(teacher_schema_1.teacherDocumentParamSchema), (0, validate_middleware_1.validate)(teacher_schema_1.putTeacherDocumentSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_controller_1.putTeacherDocumentController));
router.delete("/:id/documents/:type", (0, permission_middleware_1.requirePermission)("teacher.update"), (0, validate_middleware_1.validateParams)(teacher_schema_1.teacherDocumentParamSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_controller_1.deleteTeacherDocumentController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("teacher.view"), (0, validate_middleware_1.validateParams)(teacher_schema_1.teacherIdSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_controller_1.getTeacherController));
router.post("/", (0, permission_middleware_1.requirePermission)("teacher.create"), (0, validate_middleware_1.validate)(teacher_schema_1.createTeacherSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_controller_1.createTeacherController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("teacher.update"), (0, validate_middleware_1.validateParams)(teacher_schema_1.teacherIdSchema), (0, validate_middleware_1.validate)(teacher_schema_1.updateTeacherSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_controller_1.updateTeacherController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("teacher.delete"), (0, validate_middleware_1.validateParams)(teacher_schema_1.teacherIdSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_controller_1.deleteTeacherController));
exports.default = router;
//# sourceMappingURL=teacher.route.js.map