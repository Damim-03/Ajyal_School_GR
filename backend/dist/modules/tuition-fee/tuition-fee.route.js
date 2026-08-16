"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tuition_fee_controller_1 = require("./tuition-fee.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const tuition_fee_schema_1 = require("./tuition-fee.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("tuition-fee.view"), (0, validate_middleware_1.validateQuery)(tuition_fee_schema_1.tuitionFeeQuerySchema), (0, async_handler_middleware_1.asyncHandler)(tuition_fee_controller_1.listTuitionFeesController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("tuition-fee.view"), (0, validate_middleware_1.validateParams)(tuition_fee_schema_1.tuitionFeeIdSchema), (0, async_handler_middleware_1.asyncHandler)(tuition_fee_controller_1.getTuitionFeeController));
router.post("/", (0, permission_middleware_1.requirePermission)("tuition-fee.create"), (0, validate_middleware_1.validate)(tuition_fee_schema_1.createTuitionFeeSchema), (0, async_handler_middleware_1.asyncHandler)(tuition_fee_controller_1.createTuitionFeeController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("tuition-fee.update"), (0, validate_middleware_1.validateParams)(tuition_fee_schema_1.tuitionFeeIdSchema), (0, validate_middleware_1.validate)(tuition_fee_schema_1.updateTuitionFeeSchema), (0, async_handler_middleware_1.asyncHandler)(tuition_fee_controller_1.updateTuitionFeeController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("tuition-fee.delete"), (0, validate_middleware_1.validateParams)(tuition_fee_schema_1.tuitionFeeIdSchema), (0, async_handler_middleware_1.asyncHandler)(tuition_fee_controller_1.deleteTuitionFeeController));
exports.default = router;
//# sourceMappingURL=tuition-fee.route.js.map