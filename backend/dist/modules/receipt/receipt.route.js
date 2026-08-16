"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const receipt_controller_1 = require("./receipt.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const receipt_schema_1 = require("./receipt.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("receipt.view"), (0, validate_middleware_1.validateQuery)(receipt_schema_1.receiptQuerySchema), (0, async_handler_middleware_1.asyncHandler)(receipt_controller_1.listReceiptsController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("receipt.view"), (0, validate_middleware_1.validateParams)(receipt_schema_1.receiptIdSchema), (0, async_handler_middleware_1.asyncHandler)(receipt_controller_1.getReceiptController));
// --------------------------------------------------
// الطباعة الأولى وإعادة الطباعة مساران منفصلان
// لأن لكل منهما صلاحيته: receipt.print / receipt.reprint
// --------------------------------------------------
router.post("/:id/print", (0, permission_middleware_1.requirePermission)("receipt.print"), (0, validate_middleware_1.validateParams)(receipt_schema_1.receiptIdSchema), (0, async_handler_middleware_1.asyncHandler)(receipt_controller_1.printReceiptController));
router.post("/:id/reprint", (0, permission_middleware_1.requirePermission)("receipt.reprint"), (0, validate_middleware_1.validateParams)(receipt_schema_1.receiptIdSchema), (0, async_handler_middleware_1.asyncHandler)(receipt_controller_1.reprintReceiptController));
router.post("/:id/cancel", (0, permission_middleware_1.requirePermission)("receipt.cancel"), (0, validate_middleware_1.validateParams)(receipt_schema_1.receiptIdSchema), (0, validate_middleware_1.validate)(receipt_schema_1.cancelReceiptSchema), (0, async_handler_middleware_1.asyncHandler)(receipt_controller_1.cancelReceiptController));
exports.default = router;
//# sourceMappingURL=receipt.route.js.map