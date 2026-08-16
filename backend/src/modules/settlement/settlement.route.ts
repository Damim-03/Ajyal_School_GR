import { Router } from "express";
import {
  listSettlementsController,
  getSettlementController,
  computeSettlementController,
  confirmSettlementController,
  paySettlementController,
  cancelSettlementController,
  settlementEstimateController,
  dailyClearanceController,
} from "./settlement.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  computeSettlementSchema,
  confirmSettlementSchema,
  cancelSettlementSchema,
  settlementIdSchema,
  settlementQuerySchema,
  estimateQuerySchema,
  dailyClearanceQuerySchema,
} from "./settlement.schema";

const router = Router();

router.use(authMiddleware);

// --------------------------------------------------
// الكشفان قبل /:id — وإلا التقط المسارُ المتغيّر كلمة "estimate"
// --------------------------------------------------

/** §16 — الكشف التقديري: يُحسب ولا يُحفظ */
router.get(
  "/estimate",
  requirePermission("settlement.view"),
  validateQuery(estimateQuerySchema),
  asyncHandler(settlementEstimateController),
);

/** §17 — كشف التخليص اليومي المالي */
router.get(
  "/daily-clearance",
  requirePermission("settlement.view"),
  validateQuery(dailyClearanceQuerySchema),
  asyncHandler(dailyClearanceController),
);

router.get(
  "/",
  requirePermission("settlement.view"),
  validateQuery(settlementQuerySchema),
  asyncHandler(listSettlementsController),
);

router.get(
  "/:id",
  requirePermission("settlement.view"),
  validateParams(settlementIdSchema),
  asyncHandler(getSettlementController),
);

router.post(
  "/compute",
  requirePermission("settlement.create"),
  validate(computeSettlementSchema),
  asyncHandler(computeSettlementController),
);

router.patch(
  "/:id/confirm",
  requirePermission("settlement.confirm"),
  validateParams(settlementIdSchema),
  validate(confirmSettlementSchema),
  asyncHandler(confirmSettlementController),
);

router.patch(
  "/:id/pay",
  requirePermission("settlement.confirm"),
  validateParams(settlementIdSchema),
  asyncHandler(paySettlementController),
);

router.patch(
  "/:id/cancel",
  requirePermission("settlement.cancel"),
  validateParams(settlementIdSchema),
  validate(cancelSettlementSchema),
  asyncHandler(cancelSettlementController),
);

export default router;
