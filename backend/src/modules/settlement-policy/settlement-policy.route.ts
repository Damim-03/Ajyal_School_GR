import { Router } from "express";
import {
  listSettlementPoliciesController,
  getSettlementPolicyController,
  createSettlementPolicyController,
  updateSettlementPolicyController,
  deleteSettlementPolicyController,
} from "./settlement-policy.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createSettlementPolicySchema,
  updateSettlementPolicySchema,
  settlementPolicyIdSchema,
  settlementPolicyQuerySchema,
} from "./settlement-policy.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("settlement-policy.view"),
  validateQuery(settlementPolicyQuerySchema),
  asyncHandler(listSettlementPoliciesController),
);

router.get(
  "/:id",
  requirePermission("settlement-policy.view"),
  validateParams(settlementPolicyIdSchema),
  asyncHandler(getSettlementPolicyController),
);

router.post(
  "/",
  requirePermission("settlement-policy.create"),
  validate(createSettlementPolicySchema),
  asyncHandler(createSettlementPolicyController),
);

router.patch(
  "/:id",
  requirePermission("settlement-policy.update"),
  validateParams(settlementPolicyIdSchema),
  validate(updateSettlementPolicySchema),
  asyncHandler(updateSettlementPolicyController),
);

router.delete(
  "/:id",
  requirePermission("settlement-policy.delete"),
  validateParams(settlementPolicyIdSchema),
  asyncHandler(deleteSettlementPolicyController),
);

export default router;
