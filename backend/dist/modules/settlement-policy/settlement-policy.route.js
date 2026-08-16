"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settlement_policy_controller_1 = require("./settlement-policy.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const settlement_policy_schema_1 = require("./settlement-policy.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("settlement-policy.view"), (0, validate_middleware_1.validateQuery)(settlement_policy_schema_1.settlementPolicyQuerySchema), (0, async_handler_middleware_1.asyncHandler)(settlement_policy_controller_1.listSettlementPoliciesController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("settlement-policy.view"), (0, validate_middleware_1.validateParams)(settlement_policy_schema_1.settlementPolicyIdSchema), (0, async_handler_middleware_1.asyncHandler)(settlement_policy_controller_1.getSettlementPolicyController));
router.post("/", (0, permission_middleware_1.requirePermission)("settlement-policy.create"), (0, validate_middleware_1.validate)(settlement_policy_schema_1.createSettlementPolicySchema), (0, async_handler_middleware_1.asyncHandler)(settlement_policy_controller_1.createSettlementPolicyController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("settlement-policy.update"), (0, validate_middleware_1.validateParams)(settlement_policy_schema_1.settlementPolicyIdSchema), (0, validate_middleware_1.validate)(settlement_policy_schema_1.updateSettlementPolicySchema), (0, async_handler_middleware_1.asyncHandler)(settlement_policy_controller_1.updateSettlementPolicyController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("settlement-policy.delete"), (0, validate_middleware_1.validateParams)(settlement_policy_schema_1.settlementPolicyIdSchema), (0, async_handler_middleware_1.asyncHandler)(settlement_policy_controller_1.deleteSettlementPolicyController));
exports.default = router;
//# sourceMappingURL=settlement-policy.route.js.map