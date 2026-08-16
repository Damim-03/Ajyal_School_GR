import { Router } from "express";
import {
  listPaymentsController,
  getPaymentController,
  createPaymentController,
  cancelPaymentController,
} from "./payment.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createPaymentSchema,
  cancelPaymentSchema,
  paymentIdSchema,
  paymentQuerySchema,
} from "./payment.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("payment.view"),
  validateQuery(paymentQuerySchema),
  asyncHandler(listPaymentsController),
);

router.get(
  "/:id",
  requirePermission("payment.view"),
  validateParams(paymentIdSchema),
  asyncHandler(getPaymentController),
);

router.post(
  "/",
  requirePermission("payment.create"),
  validate(createPaymentSchema),
  asyncHandler(createPaymentController),
);

// --------------------------------------------------
// POST /api/payments/:id/cancel
//
// لا تعديل ولا حذف: الدفعة سجل مالي.
// الإلغاء يعكس أثرها على الفواتير ويُلغي إيصالها،
// وتبقى كل الصفوف موجودة للتدقيق.
// --------------------------------------------------

router.post(
  "/:id/cancel",
  requirePermission("payment.cancel"),
  validateParams(paymentIdSchema),
  validate(cancelPaymentSchema),
  asyncHandler(cancelPaymentController),
);

export default router;
