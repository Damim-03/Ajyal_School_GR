"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const invoice_controller_1 = require("./invoice.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const invoice_schema_1 = require("./invoice.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("invoice.view"), (0, validate_middleware_1.validateQuery)(invoice_schema_1.invoiceQuerySchema), (0, async_handler_middleware_1.asyncHandler)(invoice_controller_1.listInvoicesController));
// --------------------------------------------------
// POST /api/invoices/generate
// يسبق /:id لأن "generate" ليس معرّفاً
// --------------------------------------------------
router.post("/generate", (0, permission_middleware_1.requirePermission)("invoice.create"), (0, validate_middleware_1.validate)(invoice_schema_1.generateInvoicesSchema), (0, async_handler_middleware_1.asyncHandler)(invoice_controller_1.generateInvoicesController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("invoice.view"), (0, validate_middleware_1.validateParams)(invoice_schema_1.invoiceIdSchema), (0, async_handler_middleware_1.asyncHandler)(invoice_controller_1.getInvoiceController));
router.post("/", (0, permission_middleware_1.requirePermission)("invoice.create"), (0, validate_middleware_1.validate)(invoice_schema_1.createInvoiceSchema), (0, async_handler_middleware_1.asyncHandler)(invoice_controller_1.createInvoiceController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("invoice.update"), (0, validate_middleware_1.validateParams)(invoice_schema_1.invoiceIdSchema), (0, validate_middleware_1.validate)(invoice_schema_1.updateInvoiceSchema), (0, async_handler_middleware_1.asyncHandler)(invoice_controller_1.updateInvoiceController));
// --------------------------------------------------
// POST /api/invoices/:id/cancel
// لا يوجد حذف — الفاتورة سجل مالي يُلغى ولا يُمحى
// --------------------------------------------------
router.post("/:id/cancel", (0, permission_middleware_1.requirePermission)("invoice.cancel"), (0, validate_middleware_1.validateParams)(invoice_schema_1.invoiceIdSchema), (0, validate_middleware_1.validate)(invoice_schema_1.cancelInvoiceSchema), (0, async_handler_middleware_1.asyncHandler)(invoice_controller_1.cancelInvoiceController));
exports.default = router;
//# sourceMappingURL=invoice.route.js.map