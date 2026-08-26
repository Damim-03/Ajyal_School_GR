"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.profilesLimiter = exports.setupLimiter = exports.loginLimiter = exports.generalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_config_1 = require("../config/http.config");
const error_code_enum_1 = require("../enums/error-code.enum");
// --------------------------------------------------
// Rate limiting
//
// الرد يُرسل JSON بنفس شكل باقي الأخطاء
// ({ message, errorCode })، وإلا فشل الفرونت في
// تحليله وأظهر خطأً غامضاً بدل رسالة مفهومة.
// --------------------------------------------------
const jsonHandler = (message, errorCode) => (_req, res) => res.status(http_config_1.HTTPSTATUS.TOO_MANY_REQUESTS).json({ message, errorCode });
// --------------------------------------------------
// الحدّ العام
//
// تطبيق سطح المكتب يُصدر عشرات الطلبات لكل شاشة،
// وكل أجهزة الشبكة المحلية تتشارك IP واحداً خلف NAT،
// فالحدّ المنخفض يحجب مستخدمين شرعيين.
// --------------------------------------------------
exports.generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonHandler("Too many requests, please try again later", error_code_enum_1.ErrorCodeEnum.ACCESS_FORBIDDEN),
});
// --------------------------------------------------
// حدّ تسجيل الدخول
//
// هذا هو الغرض الحقيقي من التحديد: إبطاء تخمين
// كلمات المرور. المحاولات الناجحة لا تُحتسب، فمن
// يدخل بشكل سليم لا يُحجب أبداً.
// --------------------------------------------------
exports.loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonHandler("Too many login attempts, please try again in 15 minutes", error_code_enum_1.ErrorCodeEnum.AUTH_TOO_MANY_ATTEMPTS),
});
/**
 * بطاقاتُ شاشة اختيار المستخدم — مسارٌ عامّ يُقرأ مرّةً عند الإقلاع.
 *
 * ولا يُستعمل `loginLimiter` هنا: فيه `skipSuccessfulRequests` لأنّ
 * المقصودَ هناك عدُّ المحاولات الفاشلة. وهذا الطلبُ ينجح دائماً، فلو
 * أُلحق به لما عُدّ له طلبٌ واحد وبقي الحدُّ زينةً لا أثرَ لها.
 *
 * والسقفُ سخيٌّ عمداً: الشاشةُ تُفتح وتُغلق في التجريب، وقاعةٌ فيها
 * عدّةُ أجهزةٍ خلف بوّابةٍ واحدة تشترك في العنوان.
 */
/**
 * مساراتُ التهيئة الأولى — **مفتوحةٌ بلا مصادقة، وهذا هو سببُ الحدّ**.
 *
 * ولا مفرّ من فتحها: لا حسابَ في القاعدة قبل أن تُنشئه شاشةُ المدير،
 * فاشتراطُ توكنٍ يجعلها بابَاً لا يُفتح إلّا من داخله. والنافذةُ
 * تُغلق من نفسها: متى صارت الحالةُ `COMPLETED` رُدَّت كلُّ خطوةٍ
 * بـ409 مهما تكرّرت (§38).
 *
 * فيبقى خطرُ من يقصف الباب في الدقائق التي تسبق الإتمام — وهذا حدُّه.
 * والسقفُ يسع تهيئةً كاملةً بأخطائها وإعاداتها ولا يسع أكثر.
 */
exports.setupLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonHandler("Too many setup requests, please try again shortly", error_code_enum_1.ErrorCodeEnum.ACCESS_FORBIDDEN),
});
exports.profilesLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonHandler("Too many requests, please try again shortly", error_code_enum_1.ErrorCodeEnum.AUTH_TOO_MANY_ATTEMPTS),
});
//# sourceMappingURL=rate-limit.middleware.js.map