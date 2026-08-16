"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_1 = require("./payment.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const payment_schema_1 = require("./payment.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("payment.view"), (0, validate_middleware_1.validateQuery)(payment_schema_1.paymentQuerySchema), (0, async_handler_middleware_1.asyncHandler)(payment_controller_1.listPaymentsController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("payment.view"), (0, validate_middleware_1.validateParams)(payment_schema_1.paymentIdSchema), (0, async_handler_middleware_1.asyncHandler)(payment_controller_1.getPaymentController));
router.post("/", (0, permission_middleware_1.requirePermission)("payment.create"), (0, validate_middleware_1.validate)(payment_schema_1.createPaymentSchema), (0, async_handler_middleware_1.asyncHandler)(payment_controller_1.createPaymentController));
// --------------------------------------------------
// POST /api/payments/:id/cancel
//
// لا تعديل ولا حذف: الدفعة سجل مالي.
// الإلغاء يعكس أثرها على الفواتير ويُلغي إيصالها،
// وتبقى كل الصفوف موجودة للتدقيق.
// --------------------------------------------------
router.post("/:id/cancel", (0, permission_middleware_1.requirePermission)("payment.cancel"), (0, validate_middleware_1.validateParams)(payment_schema_1.paymentIdSchema), (0, validate_middleware_1.validate)(payment_schema_1.cancelPaymentSchema), (0, async_handler_middleware_1.asyncHandler)(payment_controller_1.cancelPaymentController));
exports.default = router;
//# sourceMappingURL=payment.route.js.map