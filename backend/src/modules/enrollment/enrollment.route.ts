import { Router } from "express";
import {
  listEnrollmentsController,
  getEnrollmentController,
  createEnrollmentController,
  updateEnrollmentController,
  transferEnrollmentController,
  cancelPendingTransferController,
  deleteEnrollmentController,
} from "./enrollment.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createEnrollmentSchema,
  updateEnrollmentSchema,
  transferEnrollmentSchema,
  enrollmentIdSchema,
  enrollmentQuerySchema,
} from "./enrollment.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("enrollment.view"),
  validateQuery(enrollmentQuerySchema),
  asyncHandler(listEnrollmentsController),
);

router.get(
  "/:id",
  requirePermission("enrollment.view"),
  validateParams(enrollmentIdSchema),
  asyncHandler(getEnrollmentController),
);

// --------------------------------------------------
// POST /api/enrollments
// تسجيل الطالب في عدة مواد دفعة واحدة (ذرّي)
// --------------------------------------------------

router.post(
  "/",
  requirePermission("enrollment.create"),
  validate(createEnrollmentSchema),
  asyncHandler(createEnrollmentController),
);

router.patch(
  "/:id",
  requirePermission("enrollment.update"),
  validateParams(enrollmentIdSchema),
  validate(updateEnrollmentSchema),
  asyncHandler(updateEnrollmentController),
);

/*
 * النقل تعديلٌ لا إنشاء: صلاحية enrollment.update تكفيه، فمن يملك
 * تعطيل إسنادٍ وإعادة إسناده يملك أثرَ النقل نفسه بخطوتين.
 */
router.patch(
  "/:id/transfer",
  requirePermission("enrollment.update"),
  validateParams(enrollmentIdSchema),
  validate(transferEnrollmentSchema),
  asyncHandler(transferEnrollmentController),
);

/*
 * إلغاءُ نقلٍ مؤجَّل — قرارٌ يُراجَع قبل أن يسري.
 *
 * وبدونه يصير التأجيلُ فخّاً: قرارٌ كُتب اليوم ويُنفَّذ من نفسه بعد
 * أسابيع، ولا سبيل إلى الرجوع فيه إلّا بنقلٍ مضادٍّ بعد وقوعه —
 * وذاك يترك في السجلّ نقلتين لم تقع إحداهما.
 */
router.patch(
  "/:id/transfer/cancel",
  requirePermission("enrollment.update"),
  validateParams(enrollmentIdSchema),
  asyncHandler(cancelPendingTransferController),
);

router.delete(
  "/:id",
  requirePermission("enrollment.delete"),
  validateParams(enrollmentIdSchema),
  asyncHandler(deleteEnrollmentController),
);

export default router;
