"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const teacher_payment_controller_1 = require("./teacher-payment.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const teacher_payment_schema_1 = require("./teacher-payment.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
/*
 * دفعُ الأستاذ مالٌ يخرج — فصلاحياتُه مستقلّة عن التخليص.
 * مَن يحسب ليس بالضرورة مَن يسلّم.
 */
router.get("/", (0, permission_middleware_1.requirePermission)("teacher-payment.view"), (0, validate_middleware_1.validateQuery)(teacher_payment_schema_1.teacherPaymentQuerySchema), (0, async_handler_middleware_1.asyncHandler)(teacher_payment_controller_1.listTeacherPaymentsController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("teacher-payment.view"), (0, validate_middleware_1.validateParams)(teacher_payment_schema_1.teacherPaymentIdSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_payment_controller_1.getTeacherPaymentController));
router.post("/", (0, permission_middleware_1.requirePermission)("teacher-payment.create"), (0, validate_middleware_1.validate)(teacher_payment_schema_1.payTeacherSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_payment_controller_1.payTeacherController));
/* لا حذف — الدفعة تُلغى بسببٍ مكتوب، وتعود تخليصاتُها «مؤكَّدة» */
router.patch("/:id/cancel", (0, permission_middleware_1.requirePermission)("teacher-payment.cancel"), (0, validate_middleware_1.validateParams)(teacher_payment_schema_1.teacherPaymentIdSchema), (0, validate_middleware_1.validate)(teacher_payment_schema_1.cancelTeacherPaymentSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_payment_controller_1.cancelTeacherPaymentController));
exports.default = router;
//# sourceMappingURL=teacher-payment.route.js.map