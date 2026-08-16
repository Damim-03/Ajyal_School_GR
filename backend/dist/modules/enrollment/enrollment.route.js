"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const enrollment_controller_1 = require("./enrollment.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const enrollment_schema_1 = require("./enrollment.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("enrollment.view"), (0, validate_middleware_1.validateQuery)(enrollment_schema_1.enrollmentQuerySchema), (0, async_handler_middleware_1.asyncHandler)(enrollment_controller_1.listEnrollmentsController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("enrollment.view"), (0, validate_middleware_1.validateParams)(enrollment_schema_1.enrollmentIdSchema), (0, async_handler_middleware_1.asyncHandler)(enrollment_controller_1.getEnrollmentController));
// --------------------------------------------------
// POST /api/enrollments
// تسجيل الطالب في عدة مواد دفعة واحدة (ذرّي)
// --------------------------------------------------
router.post("/", (0, permission_middleware_1.requirePermission)("enrollment.create"), (0, validate_middleware_1.validate)(enrollment_schema_1.createEnrollmentSchema), (0, async_handler_middleware_1.asyncHandler)(enrollment_controller_1.createEnrollmentController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("enrollment.update"), (0, validate_middleware_1.validateParams)(enrollment_schema_1.enrollmentIdSchema), (0, validate_middleware_1.validate)(enrollment_schema_1.updateEnrollmentSchema), (0, async_handler_middleware_1.asyncHandler)(enrollment_controller_1.updateEnrollmentController));
/*
 * النقل تعديلٌ لا إنشاء: صلاحية enrollment.update تكفيه، فمن يملك
 * تعطيل إسنادٍ وإعادة إسناده يملك أثرَ النقل نفسه بخطوتين.
 */
router.patch("/:id/transfer", (0, permission_middleware_1.requirePermission)("enrollment.update"), (0, validate_middleware_1.validateParams)(enrollment_schema_1.enrollmentIdSchema), (0, validate_middleware_1.validate)(enrollment_schema_1.transferEnrollmentSchema), (0, async_handler_middleware_1.asyncHandler)(enrollment_controller_1.transferEnrollmentController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("enrollment.delete"), (0, validate_middleware_1.validateParams)(enrollment_schema_1.enrollmentIdSchema), (0, async_handler_middleware_1.asyncHandler)(enrollment_controller_1.deleteEnrollmentController));
exports.default = router;
//# sourceMappingURL=enrollment.route.js.map