import { Router } from "express";
import {
  listInvoicesController,
  getInvoiceController,
  createInvoiceController,
  generateInvoicesController,
  updateInvoiceController,
  cancelInvoiceController,
} from "./invoice.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createInvoiceSchema,
  generateInvoicesSchema,
  updateInvoiceSchema,
  invoiceIdSchema,
  invoiceQuerySchema,
  cancelInvoiceSchema,
} from "./invoice.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("invoice.view"),
  validateQuery(invoiceQuerySchema),
  asyncHandler(listInvoicesController),
);

// --------------------------------------------------
// POST /api/invoices/generate
// يسبق /:id لأن "generate" ليس معرّفاً
// --------------------------------------------------

router.post(
  "/generate",
  requirePermission("invoice.create"),
  validate(generateInvoicesSchema),
  asyncHandler(generateInvoicesController),
);

router.get(
  "/:id",
  requirePermission("invoice.view"),
  validateParams(invoiceIdSchema),
  asyncHandler(getInvoiceController),
);

router.post(
  "/",
  requirePermission("invoice.create"),
  validate(createInvoiceSchema),
  asyncHandler(createInvoiceController),
);

router.patch(
  "/:id",
  requirePermission("invoice.update"),
  validateParams(invoiceIdSchema),
  validate(updateInvoiceSchema),
  asyncHandler(updateInvoiceController),
);

// --------------------------------------------------
// POST /api/invoices/:id/cancel
// لا يوجد حذف — الفاتورة سجل مالي يُلغى ولا يُمحى
// --------------------------------------------------

router.post(
  "/:id/cancel",
  requirePermission("invoice.cancel"),
  validateParams(invoiceIdSchema),
  validate(cancelInvoiceSchema),
  asyncHandler(cancelInvoiceController),
);

export default router;
