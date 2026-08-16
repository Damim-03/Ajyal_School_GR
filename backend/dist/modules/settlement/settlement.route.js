"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settlement_controller_1 = require("./settlement.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const settlement_schema_1 = require("./settlement.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// --------------------------------------------------
// الكشفان قبل /:id — وإلا التقط المسارُ المتغيّر كلمة "estimate"
// --------------------------------------------------
/** §16 — الكشف التقديري: يُحسب ولا يُحفظ */
router.get("/estimate", (0, permission_middleware_1.requirePermission)("settlement.view"), (0, validate_middleware_1.validateQuery)(settlement_schema_1.estimateQuerySchema), (0, async_handler_middleware_1.asyncHandler)(settlement_controller_1.settlementEstimateController));
/** §17 — كشف التخليص اليومي المالي */
router.get("/daily-clearance", (0, permission_middleware_1.requirePermission)("settlement.view"), (0, validate_middleware_1.validateQuery)(settlement_schema_1.dailyClearanceQuerySchema), (0, async_handler_middleware_1.asyncHandler)(settlement_controller_1.dailyClearanceController));
router.get("/", (0, permission_middleware_1.requirePermission)("settlement.view"), (0, validate_middleware_1.validateQuery)(settlement_schema_1.settlementQuerySchema), (0, async_handler_middleware_1.asyncHandler)(settlement_controller_1.listSettlementsController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("settlement.view"), (0, validate_middleware_1.validateParams)(settlement_schema_1.settlementIdSchema), (0, async_handler_middleware_1.asyncHandler)(settlement_controller_1.getSettlementController));
router.post("/compute", (0, permission_middleware_1.requirePermission)("settlement.create"), (0, validate_middleware_1.validate)(settlement_schema_1.computeSettlementSchema), (0, async_handler_middleware_1.asyncHandler)(settlement_controller_1.computeSettlementController));
router.patch("/:id/confirm", (0, permission_middleware_1.requirePermission)("settlement.confirm"), (0, validate_middleware_1.validateParams)(settlement_schema_1.settlementIdSchema), (0, validate_middleware_1.validate)(settlement_schema_1.confirmSettlementSchema), (0, async_handler_middleware_1.asyncHandler)(settlement_controller_1.confirmSettlementController));
router.patch("/:id/pay", (0, permission_middleware_1.requirePermission)("settlement.confirm"), (0, validate_middleware_1.validateParams)(settlement_schema_1.settlementIdSchema), (0, async_handler_middleware_1.asyncHandler)(settlement_controller_1.paySettlementController));
router.patch("/:id/cancel", (0, permission_middleware_1.requirePermission)("settlement.cancel"), (0, validate_middleware_1.validateParams)(settlement_schema_1.settlementIdSchema), (0, validate_middleware_1.validate)(settlement_schema_1.cancelSettlementSchema), (0, async_handler_middleware_1.asyncHandler)(settlement_controller_1.cancelSettlementController));
exports.default = router;
//# sourceMappingURL=settlement.route.js.map