"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const maintenance_controller_1 = require("./maintenance.controller");
const maintenance_schema_1 = require("./maintenance.schema");
/*
 * النسخةُ تُقرأ في الذاكرة لا تُكتب على القرص.
 *
 * ملفُّ الاستعادة يُفكّ فوراً ثمّ يُرمى، فكتابتُه في `uploads` تترك
 * أرشيفاً بحجم القاعدة كلِّها في مجلَّدٍ يُخدَم للعموم. والحدُّ 512
 * ميغا — أوسعُ من مؤسسةٍ بسنواتٍ من الوثائق الممسوحة.
 */
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 512 * 1024 * 1024 },
});
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("maintenance.view"), (0, async_handler_middleware_1.asyncHandler)(maintenance_controller_1.overviewController));
router.post("/backup", (0, permission_middleware_1.requirePermission)("maintenance.backup"), (0, async_handler_middleware_1.asyncHandler)(maintenance_controller_1.backupController));
router.get("/backups", (0, permission_middleware_1.requirePermission)("maintenance.view"), (0, async_handler_middleware_1.asyncHandler)(maintenance_controller_1.listBackupsController));
router.get("/backups/:name/download", (0, permission_middleware_1.requirePermission)("maintenance.backup"), (0, async_handler_middleware_1.asyncHandler)(maintenance_controller_1.downloadBackupController));
router.delete("/backups/:name", (0, permission_middleware_1.requirePermission)("maintenance.backup"), (0, async_handler_middleware_1.asyncHandler)(maintenance_controller_1.deleteBackupController));
router.post("/restore", (0, permission_middleware_1.requirePermission)("maintenance.restore"), upload.single("file"), (0, async_handler_middleware_1.asyncHandler)(maintenance_controller_1.restoreController));
// --------------------------------------------------
// POST /api/maintenance/reset
//
// آخرُ ما يُنادى في هذا البرنامج وأخطرُه. وحرسُه ثلاثة: صلاحيةٌ
// مستقلّة لا تُورَث مع `settings.update`، وكلمةٌ تُكتب بيد المستخدم
// يتحقّق منها المخطَّط، ونافذةٌ تعرض عددَ الصفوف قبل التأكيد.
// --------------------------------------------------
router.post("/reset", (0, permission_middleware_1.requirePermission)("maintenance.reset"), (0, validate_middleware_1.validate)(maintenance_schema_1.resetSchema), (0, async_handler_middleware_1.asyncHandler)(maintenance_controller_1.resetController));
exports.default = router;
//# sourceMappingURL=maintenance.route.js.map