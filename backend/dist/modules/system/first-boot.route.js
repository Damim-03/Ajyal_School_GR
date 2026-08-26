"use strict";
/**
 * مساراتُ النظام.
 *
 * ونقطةُ نهايةٍ لكلّ خطوة لا واحدةٌ ضخمةٌ تأخذ كلَّ شيء (§39): كلُّ
 * خطوةٍ لها مخطَّطُها وحرسُها وأثرُها في القاعدة، وجمعُها في مسارٍ
 * واحدٍ كان سيعني `switch` على حقلٍ نصّيّ داخل متحكّمٍ واحد — وهو
 * الشكلُ الذي تُكتب به الأخطاء.
 *
 * **والمساراتُ مفتوحةٌ بلا مصادقةٍ عمداً** — ولا سبيل غيرَه: أوّلُ
 * مستخدمٍ في القاعدة تُنشئه الخطوةُ العاشرة. وثلاثةٌ تحرسها:
 *   1. `setupLimiter` — سقفُ طلباتٍ يسع تهيئةً ولا يسع قصفاً.
 *   2. آلةُ الحالات — لا خطوةَ تُقبل قبل موضعها.
 *   3. الإتمام يُغلق البابَ نهائياً — كلُّ نداءٍ بعده يُردّ بـ409.
 *
 * وما يُستثنى من ذلك: `reset` — فهي تُنادى في نظامٍ **مهيَّأ**، أي أنّ
 * المصادقة ممكنةٌ حينها ومطلوبة (§59).
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const rate_limit_middleware_1 = require("../../core/middleware/rate-limit.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const upload_route_1 = require("../upload/upload.route");
const first_boot_controller_1 = require("./first-boot.controller");
const first_boot_schema_1 = require("./first-boot.schema");
// --------------------------------------------------
// حالةُ التهيئة — يُنادى عند كل إقلاعٍ للتطبيق (§25)
// --------------------------------------------------
const firstBoot = (0, express_1.Router)();
firstBoot.use(rate_limit_middleware_1.setupLimiter);
firstBoot.get("/status", (0, async_handler_middleware_1.asyncHandler)(first_boot_controller_1.statusController));
firstBoot.get("/probe", (0, async_handler_middleware_1.asyncHandler)(first_boot_controller_1.probeController));
// --------------------------------------------------
// الخطوات — بالترتيب الذي تُعرض به
// --------------------------------------------------
const step = (path, schema, handler) => firstBoot.post(path, (0, validate_middleware_1.validate)(schema), (0, async_handler_middleware_1.asyncHandler)(handler));
step("/language", first_boot_schema_1.languageSchema, first_boot_controller_1.languageController);
step("/region", first_boot_schema_1.regionSchema, first_boot_controller_1.regionController);
step("/network", first_boot_schema_1.networkSchema, first_boot_controller_1.networkController);
step("/display", first_boot_schema_1.displaySchema, first_boot_controller_1.displayController);
step("/performance", first_boot_schema_1.performanceSchema, first_boot_controller_1.performanceController);
step("/terms", first_boot_schema_1.termsSchema, first_boot_controller_1.termsController);
step("/update", first_boot_schema_1.updateSchema, first_boot_controller_1.updateController);
step("/devices", first_boot_schema_1.devicesSchema, first_boot_controller_1.devicesController);
step("/administrator", first_boot_schema_1.administratorSchema, first_boot_controller_1.administratorController);
step("/institution", first_boot_schema_1.institutionSchema, first_boot_controller_1.institutionController);
step("/academic-year", first_boot_schema_1.academicYearSchema, first_boot_controller_1.academicYearController);
step("/privacy", first_boot_schema_1.privacySchema, first_boot_controller_1.privacyController);
step("/recovery", first_boot_schema_1.recoverySchema, first_boot_controller_1.recoveryController);
// --------------------------------------------------
// شعارُ المؤسسة — ملفٌّ لا حقلُ نموذج، فلا يمرّ بـ`validate`
// --------------------------------------------------
firstBoot.post("/logo", upload_route_1.imageUpload.single("file"), (0, async_handler_middleware_1.asyncHandler)(first_boot_controller_1.logoController));
// --------------------------------------------------
// التنقّل والإتمام
// --------------------------------------------------
step("/back", first_boot_schema_1.backSchema, first_boot_controller_1.backController);
firstBoot.post("/verify", (0, async_handler_middleware_1.asyncHandler)(first_boot_controller_1.verifyController));
firstBoot.post("/complete", (0, async_handler_middleware_1.asyncHandler)(first_boot_controller_1.completeController));
// --------------------------------------------------
// إعادةُ التهيئة — الوحيدةُ المحميّة هنا
//
// وصلاحيتُها `maintenance.reset` لا `settings.update`: هذه تفتح
// شاشاتِ التركيب من جديد، وهي أقربُ إلى إعادة التهيئة منها إلى تعديل
// إعداد. ومَن يملك تعديلَ اسم المدرسة لا يملك بالضرورة إعادةَ فتح
// بابِ إنشاءِ مديرٍ جديد.
// --------------------------------------------------
firstBoot.post("/reset", auth_middleware_1.authMiddleware, (0, permission_middleware_1.requirePermission)("maintenance.reset"), (0, validate_middleware_1.validate)(first_boot_schema_1.resetFirstBootSchema), (0, async_handler_middleware_1.asyncHandler)(first_boot_controller_1.resetController));
const systemRoute = (0, express_1.Router)();
systemRoute.use("/first-boot", firstBoot);
// --------------------------------------------------
// تقدّمُ بناء المؤسسة — بعد الدخول، فيحتاج مصادقة (§65)
// --------------------------------------------------
systemRoute.get("/institution-progress", auth_middleware_1.authMiddleware, (0, async_handler_middleware_1.asyncHandler)(first_boot_controller_1.institutionProgressController));
systemRoute.post("/institution-progress/dismiss", auth_middleware_1.authMiddleware, (0, async_handler_middleware_1.asyncHandler)(first_boot_controller_1.dismissOnboardingController));
exports.default = systemRoute;
//# sourceMappingURL=first-boot.route.js.map