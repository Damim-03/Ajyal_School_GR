"use strict";
/**
 * حارسُ التهيئة — الحمايةُ التي لا تُخدع بتغيير عنوانٍ في الشريط.
 *
 * الواجهةُ تمنع الوصولَ إلى الشاشات قبل اكتمال التهيئة، وذلك كافٍ
 * للمستخدم وغيرُ كافٍ للنظام: مَن يعرف عنوانَ الخادم يستطيع نداءه
 * بلا واجهةٍ أصلاً. فما يحتاج نظاماً مهيَّأً يُرفض هنا لا هناك (§62).
 *
 * **والمسموحُ ثلاثةٌ فقط في زمن التهيئة:**
 *   • `/system/*` — التهيئةُ نفسُها؛ منعُها منعٌ لكلّ شيء.
 *   • `/auth/*` — تُتيح للمدير الذي أُنشئ للتوّ أن يتحقّق من دخوله،
 *     ولا تكشف شيئاً: قاعدةٌ بلا مستخدمين تردّ «بيانات خاطئة».
 *   • `/settings/school` قراءةً — الشاشاتُ تعرض اسمَ المؤسسة وشعارَها،
 *     وهي بياناتُ علامةٍ لا بياناتٌ حسّاسة (كما في `school.route.ts`).
 *
 * والقراءةُ العامّةُ (GET) لما سواها **ممنوعةٌ أيضاً**: قاعدةٌ نصفُ
 * مهيَّأةٍ تردّ قوائمَ فارغةً تبدو بياناتٍ حقيقية، فتظنّ أداةٌ خارجيةٌ
 * أنّ المؤسسة بلا طلبة.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireInitialized = exports.invalidateInitializedCache = void 0;
const http_config_1 = require("../config/http.config");
const error_code_enum_1 = require("../enums/error-code.enum");
const first_boot_service_1 = require("../../modules/system/first-boot.service");
/** بادئاتٌ تعمل قبل الإتمام — تُطابَق على المسار داخل `/api` */
const OPEN_PREFIXES = ["/system", "/auth"];
const isOpen = (req) => {
    if (OPEN_PREFIXES.some((prefix) => req.path.startsWith(prefix)))
        return true;
    return req.method === "GET" && req.path.startsWith("/settings/school");
};
/**
 * والحالةُ تُقرأ من القاعدة في كلّ طلبٍ حتى تكتمل، ثمّ **لا تُقرأ
 * أبداً**.
 *
 * إذ الانتقالُ يقع مرّةً واحدةً في عمر التركيب ولا يرجع (إلّا بإعادة
 * تهيئةٍ تُعيد تشغيل الخادم أو تُنادى من نافذةٍ تعرف ما تفعل). فبعد
 * أوّل `true` يُرفع الحارسُ من الطريق بلا استعلامٍ لكلّ طلب — والبديلُ
 * استعلامٌ على `Setting` قبل كلِّ نداءٍ في التطبيق إلى الأبد.
 */
let initialized = false;
/** تُنادى من إعادة التهيئة لتُبطل الذاكرة فوراً لا بعد إقلاعٍ جديد */
const invalidateInitializedCache = () => {
    initialized = false;
};
exports.invalidateInitializedCache = invalidateInitializedCache;
const requireInitialized = async (req, res, next) => {
    if (initialized || isOpen(req))
        return next();
    try {
        initialized = await (0, first_boot_service_1.isInitialized)();
    }
    catch {
        /*
         * تعذّرت قراءةُ الحالة — والقاعدةُ هي المشتبَه به الأوّل. والمنعُ
         * هنا أسلمُ من السماح: نظامٌ لا يُعرف هل هو مهيَّأ لا تُكتب فيه
         * فواتير.
         */
        return res.status(http_config_1.HTTPSTATUS.SERVICE_UNAVAILABLE).json({
            message: "System state unavailable",
            errorCode: error_code_enum_1.ErrorCodeEnum.SETUP_INCOMPLETE,
        });
    }
    if (initialized)
        return next();
    return res.status(http_config_1.HTTPSTATUS.FORBIDDEN).json({
        message: "System setup is not complete",
        errorCode: error_code_enum_1.ErrorCodeEnum.SETUP_INCOMPLETE,
    });
};
exports.requireInitialized = requireInitialized;
//# sourceMappingURL=initialized.middleware.js.map