import { Router } from "express";
import {
  listReceiptsController,
  getReceiptController,
  printReceiptController,
  reprintReceiptController,
  cancelReceiptController,
} from "./receipt.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  receiptIdSchema,
  receiptQuerySchema,
  cancelReceiptSchema,
} from "./receipt.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("receipt.view"),
  validateQuery(receiptQuerySchema),
  asyncHandler(listReceiptsController),
);

router.get(
  "/:id",
  requirePermission("receipt.view"),
  validateParams(receiptIdSchema),
  asyncHandler(getReceiptController),
);

// --------------------------------------------------
// الطباعة الأولى وإعادة الطباعة مساران منفصلان
// لأن لكل منهما صلاحيته: receipt.print / receipt.reprint
// --------------------------------------------------

router.post(
  "/:id/print",
  requirePermission("receipt.print"),
  validateParams(receiptIdSchema),
  asyncHandler(printReceiptController),
);

router.post(
  "/:id/reprint",
  requirePermission("receipt.reprint"),
  validateParams(receiptIdSchema),
  asyncHandler(reprintReceiptController),
);

router.post(
  "/:id/cancel",
  requirePermission("receipt.cancel"),
  validateParams(receiptIdSchema),
  validate(cancelReceiptSchema),
  asyncHandler(cancelReceiptController),
);

export default router;
