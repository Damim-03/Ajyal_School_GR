import { Router } from "express";
import {
  listSheetsController,
  getSheetController,
  createSheetController,
  updateSheetController,
  deleteSheetController,
} from "./attendance-sheet.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createSheetSchema,
  updateSheetSchema,
  sheetIdSchema,
  sheetQuerySchema,
} from "./attendance-sheet.schema";

const router = Router();

router.use(authMiddleware);

/*
 * الكشف ورقةُ حضورٍ لا حصة — فصلاحياته صلاحيات الحضور.
 * إنشاء كشفٍ فارغ لا يُسجّل حضوراً، لكنه يُنشئ الوعاء الذي يُسجَّل فيه.
 */

router.get(
  "/",
  requirePermission("attendance.view"),
  validateQuery(sheetQuerySchema),
  asyncHandler(listSheetsController),
);

router.get(
  "/:id",
  requirePermission("attendance.view"),
  validateParams(sheetIdSchema),
  asyncHandler(getSheetController),
);

router.post(
  "/",
  requirePermission("attendance.create"),
  validate(createSheetSchema),
  asyncHandler(createSheetController),
);

router.patch(
  "/:id",
  requirePermission("attendance.update"),
  validateParams(sheetIdSchema),
  validate(updateSheetSchema),
  asyncHandler(updateSheetController),
);

// الحصص تبقى — تُفكّ نسبتُها إلى الكشف فقط
router.delete(
  "/:id",
  requirePermission("attendance.delete"),
  validateParams(sheetIdSchema),
  asyncHandler(deleteSheetController),
);

export default router;
