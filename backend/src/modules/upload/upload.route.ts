import { Router, Request, Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

import { authMiddleware } from "../../core/middleware/auth.middleware";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { ApiResponse } from "../../core/config/api-response";
import { BadRequestException } from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";

/**
 * رفع الصور.
 *
 * يُخزَّن الملف على القرص ويُعاد **مساره** ليُحفظ في العمود المناسب
 * (صورة الطالب الآن، وشعار المدرسة لاحقاً). ولا تُخزَّن الملفات في
 * قاعدة البيانات: صورةٌ واحدة بحجم ميغابايتين تكفي لإفساد كل نسخة
 * احتياطية وكل استعلام يجلب الصفّ كاملاً.
 */

const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),

  filename: (_req, file, cb) => {
    /*
     * الاسم يُولَّد ولا يُشتقّ من اسم الملف الأصلي: اسمٌ قادم من
     * المستخدم قد يحمل مساراً (`../..`) أو محارف لا يقبلها نظام
     * الملفّات. نأخذ الامتداد وحده بعد التحقق منه.
     */
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED.has(ext) ? ext : ".png";
    const unique = crypto.randomBytes(8).toString("hex");

    cb(null, `${Date.now()}-${unique}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (file.mimetype.startsWith("image/") && ALLOWED.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error("يُسمح بالصور فقط (jpg, png, webp) وبحجم أقصاه 3 ميغابايت"));
    }
  },
});

const router = Router();

router.use(authMiddleware);

// POST /api/uploads — multipart، الحقل: file
router.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new BadRequestException(
        "لم يُرفَق أي ملف",
        ErrorCodeEnum.VALIDATION_ERROR,
      );
    }

    return ApiResponse.created(
      res,
      { path: `/uploads/${req.file.filename}` },
      "تم رفع الملف",
    );
  }),
);

export default router;
