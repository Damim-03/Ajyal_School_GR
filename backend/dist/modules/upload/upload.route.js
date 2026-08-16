"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const api_response_1 = require("../../core/config/api-response");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
/**
 * رفع الصور.
 *
 * يُخزَّن الملف على القرص ويُعاد **مساره** ليُحفظ في العمود المناسب
 * (صورة الطالب الآن، وشعار المدرسة لاحقاً). ولا تُخزَّن الملفات في
 * قاعدة البيانات: صورةٌ واحدة بحجم ميغابايتين تكفي لإفساد كل نسخة
 * احتياطية وكل استعلام يجلب الصفّ كاملاً.
 */
const uploadDir = node_path_1.default.join(__dirname, "..", "..", "..", "uploads");
if (!node_fs_1.default.existsSync(uploadDir)) {
    node_fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        /*
         * الاسم يُولَّد ولا يُشتقّ من اسم الملف الأصلي: اسمٌ قادم من
         * المستخدم قد يحمل مساراً (`../..`) أو محارف لا يقبلها نظام
         * الملفّات. نأخذ الامتداد وحده بعد التحقق منه.
         */
        const ext = node_path_1.default.extname(file.originalname).toLowerCase();
        const safeExt = ALLOWED.has(ext) ? ext : ".png";
        const unique = node_crypto_1.default.randomBytes(8).toString("hex");
        cb(null, `${Date.now()}-${unique}${safeExt}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = node_path_1.default.extname(file.originalname).toLowerCase();
        if (file.mimetype.startsWith("image/") && ALLOWED.has(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error("يُسمح بالصور فقط (jpg, png, webp) وبحجم أقصاه 3 ميغابايت"));
        }
    },
});
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// POST /api/uploads — multipart، الحقل: file
router.post("/", upload.single("file"), (0, async_handler_middleware_1.asyncHandler)(async (req, res) => {
    if (!req.file) {
        throw new app_errors_1.BadRequestException("لم يُرفَق أي ملف", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    return api_response_1.ApiResponse.created(res, { path: `/uploads/${req.file.filename}` }, "تم رفع الملف");
}));
exports.default = router;
//# sourceMappingURL=upload.route.js.map