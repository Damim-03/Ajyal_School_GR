import { Router } from "express";
import {
  listTeacherPaymentsController,
  getTeacherPaymentController,
  payTeacherController,
  cancelTeacherPaymentController,
} from "./teacher-payment.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  payTeacherSchema,
  teacherPaymentQuerySchema,
  teacherPaymentIdSchema,
  cancelTeacherPaymentSchema,
} from "./teacher-payment.schema";

const router = Router();

router.use(authMiddleware);

/*
 * دفعُ الأستاذ مالٌ يخرج — فصلاحياتُه مستقلّة عن التخليص.
 * مَن يحسب ليس بالضرورة مَن يسلّم.
 */

router.get(
  "/",
  requirePermission("teacher-payment.view"),
  validateQuery(teacherPaymentQuerySchema),
  asyncHandler(listTeacherPaymentsController),
);

router.get(
  "/:id",
  requirePermission("teacher-payment.view"),
  validateParams(teacherPaymentIdSchema),
  asyncHandler(getTeacherPaymentController),
);

router.post(
  "/",
  requirePermission("teacher-payment.create"),
  validate(payTeacherSchema),
  asyncHandler(payTeacherController),
);

/* لا حذف — الدفعة تُلغى بسببٍ مكتوب، وتعود تخليصاتُها «مؤكَّدة» */
router.patch(
  "/:id/cancel",
  requirePermission("teacher-payment.cancel"),
  validateParams(teacherPaymentIdSchema),
  validate(cancelTeacherPaymentSchema),
  asyncHandler(cancelTeacherPaymentController),
);

export default router;
