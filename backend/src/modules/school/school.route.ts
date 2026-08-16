import { Router } from "express";
import {
  getSchoolController,
  updateSchoolController,
  resetSchoolController,
} from "./school.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import { validate } from "../../core/middleware/validate.middleware";
import { updateSchoolSchema, resetSchoolSchema } from "./school.schema";

const router = Router();

router.use(authMiddleware);

/*
 * القراءة بالمصادقة وحدها — بلا صلاحية.
 *
 * هويّة المدرسة ليست بياناتٍ حسّاسة بل **علامة التطبيق نفسه**: تصبغ
 * الترويسة وشاشة الإقلاع وتُطبع على كل إيصال. واشتراط `settings.view`
 * يعني أنّ الأمانة — ولا تملكها — تفتح تطبيقاً بلا اسم ولا لون.
 * كشفه الفحص: القراءة كانت تُردّ بـ 403 لدور SECRETARY.
 *
 * الكتابة وحدها هي ما يحتاج صلاحية.
 */
router.get("/", asyncHandler(getSchoolController));

router.patch(
  "/",
  requirePermission("settings.update"),
  validate(updateSchoolSchema),
  asyncHandler(updateSchoolController),
);

router.post(
  "/reset",
  requirePermission("settings.update"),
  validate(resetSchoolSchema),
  asyncHandler(resetSchoolController),
);

export default router;
