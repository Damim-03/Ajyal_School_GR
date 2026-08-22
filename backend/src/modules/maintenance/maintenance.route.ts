import { Router } from "express";
import multer from "multer";

import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { validate } from "../../core/middleware/validate.middleware";
import {
  backupController,
  deleteBackupController,
  downloadBackupController,
  listBackupsController,
  overviewController,
  resetController,
  restoreController,
} from "./maintenance.controller";
import { resetSchema } from "./maintenance.schema";

/*
 * النسخةُ تُقرأ في الذاكرة لا تُكتب على القرص.
 *
 * ملفُّ الاستعادة يُفكّ فوراً ثمّ يُرمى، فكتابتُه في `uploads` تترك
 * أرشيفاً بحجم القاعدة كلِّها في مجلَّدٍ يُخدَم للعموم. والحدُّ 512
 * ميغا — أوسعُ من مؤسسةٍ بسنواتٍ من الوثائق الممسوحة.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024 * 1024 },
});

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("maintenance.view"),
  asyncHandler(overviewController),
);

router.post(
  "/backup",
  requirePermission("maintenance.backup"),
  asyncHandler(backupController),
);

router.get(
  "/backups",
  requirePermission("maintenance.view"),
  asyncHandler(listBackupsController),
);

router.get(
  "/backups/:name/download",
  requirePermission("maintenance.backup"),
  asyncHandler(downloadBackupController),
);

router.delete(
  "/backups/:name",
  requirePermission("maintenance.backup"),
  asyncHandler(deleteBackupController),
);

router.post(
  "/restore",
  requirePermission("maintenance.restore"),
  upload.single("file"),
  asyncHandler(restoreController),
);

// --------------------------------------------------
// POST /api/maintenance/reset
//
// آخرُ ما يُنادى في هذا البرنامج وأخطرُه. وحرسُه ثلاثة: صلاحيةٌ
// مستقلّة لا تُورَث مع `settings.update`، وكلمةٌ تُكتب بيد المستخدم
// يتحقّق منها المخطَّط، ونافذةٌ تعرض عددَ الصفوف قبل التأكيد.
// --------------------------------------------------

router.post(
  "/reset",
  requirePermission("maintenance.reset"),
  validate(resetSchema),
  asyncHandler(resetController),
);

export default router;
