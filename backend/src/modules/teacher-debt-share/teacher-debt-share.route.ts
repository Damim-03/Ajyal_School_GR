import { Router } from "express";
import {
  listDebtSharesController,
  cancelDebtShareController,
} from "./teacher-debt-share.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  debtShareQuerySchema,
  debtShareIdSchema,
  cancelDebtShareSchema,
} from "./teacher-debt-share.schema";

const router = Router();

router.use(authMiddleware);

/*
 * الحصة تُنشئها واقعةُ التحصيل نفسها — لا مسارَ لإنشائها يدوياً:
 * مالٌ يُقبض من طالبٍ هو ما يُنشئها، فلا تُختلق بلا قبض.
 */

router.get(
  "/",
  requirePermission("teacher-payment.view"),
  validateQuery(debtShareQuerySchema),
  asyncHandler(listDebtSharesController),
);

router.patch(
  "/:id/cancel",
  requirePermission("teacher-payment.cancel"),
  validateParams(debtShareIdSchema),
  validate(cancelDebtShareSchema),
  asyncHandler(cancelDebtShareController),
);

export default router;
