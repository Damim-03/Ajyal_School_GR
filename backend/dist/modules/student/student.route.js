"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const student_controller_1 = require("./student.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const api_response_1 = require("../../core/config/api-response");
const document_types_1 = require("./document.types");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const student_schema_1 = require("./student.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("student.view"), (0, validate_middleware_1.validateQuery)(student_schema_1.studentQuerySchema), (0, async_handler_middleware_1.asyncHandler)(student_controller_1.listStudentsController));
// --------------------------------------------------
// GET /api/students/:id/enrollments
// يسبق /:id في التعريف ليس ضرورياً (المسار أطول وأدق)،
// لكن الصلاحية مختلفة: بيانات تسجيل لا بيانات طالب.
// --------------------------------------------------
router.get("/:id/enrollments", (0, permission_middleware_1.requirePermission)("enrollment.view"), (0, validate_middleware_1.validateParams)(student_schema_1.studentIdSchema), (0, validate_middleware_1.validateQuery)(student_schema_1.studentEnrollmentQuerySchema), (0, async_handler_middleware_1.asyncHandler)(student_controller_1.getStudentEnrollmentsController));
// --------------------------------------------------
// GET /api/students/:id/statement
//
// كشفُ حساب الطالب: سطرٌ لكلّ (مادة × كشف شهر) بحضوره وحقّه وإيصاله.
// الصلاحية `student.view` — الورقة تُقرأ في شبّاك الاستقبال حيث يسأل
// الوليّ، لا في المالية وحدها.
// --------------------------------------------------
router.get("/:id/statement", (0, permission_middleware_1.requirePermission)("student.view"), (0, validate_middleware_1.validateParams)(student_schema_1.studentIdSchema), (0, validate_middleware_1.validateQuery)(student_schema_1.studentStatementQuerySchema), (0, async_handler_middleware_1.asyncHandler)(student_controller_1.getStudentStatementController));
/*
 * كتالوج أنواع الوثائق — قبل /:id لأنّ "document-types" ليس معرّفاً.
 *
 * تقرؤه الواجهة لتبني خانات الرفع وشارات الاكتمال، فلا تُكرَّر قائمة
 * الأنواع في مكانين يفترقان عند أوّل تعديل.
 */
router.get("/document-types", (0, permission_middleware_1.requirePermission)("student.view"), (0, async_handler_middleware_1.asyncHandler)(async (_req, res) => {
    return api_response_1.ApiResponse.success(res, { types: document_types_1.DOCUMENT_TYPES, requiredKeys: document_types_1.REQUIRED_KEYS }, "Document types retrieved");
}));
// --------------------------------------------------
// وثائق ملف الطالب — تسبق /:id لأنّ مسارها أطول وأدقّ
//
// بصلاحيات الطالب نفسها: الوثائق جزء من ملفّه لا مورد مستقلّ،
// ومَن يعدّل بياناته يرفع وثائقه.
// --------------------------------------------------
router.get("/:id/documents", (0, permission_middleware_1.requirePermission)("student.view"), (0, validate_middleware_1.validateParams)(student_schema_1.studentIdSchema), (0, async_handler_middleware_1.asyncHandler)(student_controller_1.getDocumentsController));
router.put("/:id/documents/:type", (0, permission_middleware_1.requirePermission)("student.update"), (0, validate_middleware_1.validateParams)(student_schema_1.documentTypeParamSchema), (0, validate_middleware_1.validate)(student_schema_1.putDocumentSchema), (0, async_handler_middleware_1.asyncHandler)(student_controller_1.putDocumentController));
router.delete("/:id/documents/:type", (0, permission_middleware_1.requirePermission)("student.update"), (0, validate_middleware_1.validateParams)(student_schema_1.documentTypeParamSchema), (0, async_handler_middleware_1.asyncHandler)(student_controller_1.deleteDocumentController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("student.view"), (0, validate_middleware_1.validateParams)(student_schema_1.studentIdSchema), (0, async_handler_middleware_1.asyncHandler)(student_controller_1.getStudentController));
router.post("/", (0, permission_middleware_1.requirePermission)("student.create"), (0, validate_middleware_1.validate)(student_schema_1.createStudentSchema), (0, async_handler_middleware_1.asyncHandler)(student_controller_1.createStudentController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("student.update"), (0, validate_middleware_1.validateParams)(student_schema_1.studentIdSchema), (0, validate_middleware_1.validate)(student_schema_1.updateStudentSchema), (0, async_handler_middleware_1.asyncHandler)(student_controller_1.updateStudentController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("student.delete"), (0, validate_middleware_1.validateParams)(student_schema_1.studentIdSchema), (0, async_handler_middleware_1.asyncHandler)(student_controller_1.deleteStudentController));
exports.default = router;
//# sourceMappingURL=student.route.js.map