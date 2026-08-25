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

import { Router } from "express";

import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import { setupLimiter } from "../../core/middleware/rate-limit.middleware";
import { validate } from "../../core/middleware/validate.middleware";
import { imageUpload } from "../upload/upload.route";
import {
  academicYearController,
  administratorController,
  backController,
  completeController,
  devicesController,
  dismissOnboardingController,
  displayController,
  institutionController,
  institutionProgressController,
  languageController,
  logoController,
  networkController,
  performanceController,
  privacyController,
  probeController,
  recoveryController,
  regionController,
  resetController,
  statusController,
  termsController,
  updateController,
  verifyController,
} from "./first-boot.controller";
import {
  academicYearSchema,
  administratorSchema,
  backSchema,
  devicesSchema,
  displaySchema,
  institutionSchema,
  languageSchema,
  networkSchema,
  performanceSchema,
  privacySchema,
  recoverySchema,
  regionSchema,
  resetFirstBootSchema,
  termsSchema,
  updateSchema,
} from "./first-boot.schema";

// --------------------------------------------------
// حالةُ التهيئة — يُنادى عند كل إقلاعٍ للتطبيق (§25)
// --------------------------------------------------

const firstBoot = Router();

firstBoot.use(setupLimiter);

firstBoot.get("/status", asyncHandler(statusController));
firstBoot.get("/probe", asyncHandler(probeController));

// --------------------------------------------------
// الخطوات — بالترتيب الذي تُعرض به
// --------------------------------------------------

const step = (
  path: string,
  schema: Parameters<typeof validate>[0],
  handler: Parameters<typeof asyncHandler>[0],
) => firstBoot.post(path, validate(schema), asyncHandler(handler));

step("/language", languageSchema, languageController);
step("/region", regionSchema, regionController);
step("/network", networkSchema, networkController);
step("/display", displaySchema, displayController);
step("/performance", performanceSchema, performanceController);
step("/terms", termsSchema, termsController);
step("/update", updateSchema, updateController);
step("/devices", devicesSchema, devicesController);
step("/administrator", administratorSchema, administratorController);
step("/institution", institutionSchema, institutionController);
step("/academic-year", academicYearSchema, academicYearController);
step("/privacy", privacySchema, privacyController);
step("/recovery", recoverySchema, recoveryController);

// --------------------------------------------------
// شعارُ المؤسسة — ملفٌّ لا حقلُ نموذج، فلا يمرّ بـ`validate`
// --------------------------------------------------

firstBoot.post(
  "/logo",
  imageUpload.single("file"),
  asyncHandler(logoController),
);

// --------------------------------------------------
// التنقّل والإتمام
// --------------------------------------------------

step("/back", backSchema, backController);

firstBoot.post("/verify", asyncHandler(verifyController));
firstBoot.post("/complete", asyncHandler(completeController));

// --------------------------------------------------
// إعادةُ التهيئة — الوحيدةُ المحميّة هنا
//
// وصلاحيتُها `maintenance.reset` لا `settings.update`: هذه تفتح
// شاشاتِ التركيب من جديد، وهي أقربُ إلى إعادة التهيئة منها إلى تعديل
// إعداد. ومَن يملك تعديلَ اسم المدرسة لا يملك بالضرورة إعادةَ فتح
// بابِ إنشاءِ مديرٍ جديد.
// --------------------------------------------------

firstBoot.post(
  "/reset",
  authMiddleware,
  requirePermission("maintenance.reset"),
  validate(resetFirstBootSchema),
  asyncHandler(resetController),
);

const systemRoute: Router = Router();

systemRoute.use("/first-boot", firstBoot);

// --------------------------------------------------
// تقدّمُ بناء المؤسسة — بعد الدخول، فيحتاج مصادقة (§65)
// --------------------------------------------------

systemRoute.get(
  "/institution-progress",
  authMiddleware,
  asyncHandler(institutionProgressController),
);

systemRoute.post(
  "/institution-progress/dismiss",
  authMiddleware,
  asyncHandler(dismissOnboardingController),
);

export default systemRoute;
