"use strict";
/**
 * مخطّطاتُ التهيئة — التحقّقُ الذي يحمي، لا الذي يُجمّل.
 *
 * الواجهةُ تتحقّق أيضاً، وذلك للتجربة: أن يرى المستخدمُ خطأه قبل أن
 * يضغط. وهذا الملفُّ هو الحارس (§40): طلبٌ يصل من خارج الواجهة —
 * سكربتٌ أو أداةُ اختبار — يُقاس بالمقياس نفسِه.
 *
 * والرسائلُ بالعربية لأنّها تُسجَّل وتُقرأ من المطوّر؛ وما يُعرض
 * للمستخدم تترجمه الواجهةُ من مفتاح الحقل لا من هذا النصّ (§41).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetFirstBootSchema = exports.backSchema = exports.recoverySchema = exports.RECOVERY_REQUIRED = exports.privacySchema = exports.academicYearSchema = exports.institutionSchema = exports.administratorSchema = exports.devicesSchema = exports.updateSchema = exports.termsSchema = exports.performanceSchema = exports.displaySchema = exports.networkSchema = exports.regionSchema = exports.languageSchema = void 0;
const zod_1 = require("zod");
const first_boot_keys_1 = require("./first-boot.keys");
const first_boot_state_1 = require("./first-boot.state");
// --------------------------------------------------
// 02 — اللغة
// --------------------------------------------------
exports.languageSchema = zod_1.z.object({
    language: zod_1.z.enum(first_boot_keys_1.LANGUAGES),
});
// --------------------------------------------------
// 03 — المنطقة والوقت
// --------------------------------------------------
exports.regionSchema = zod_1.z.object({
    country: zod_1.z.string().trim().min(2, "الدولة مطلوبة").max(64),
    /*
     * المنطقةُ الزمنية تُقاس بأنّ البيئةَ تعرفها لا بقائمةٍ مكتوبة:
     * قوائمُ IANA تتغيّر مع تحديثات النظام، وقائمةٌ ثابتةٌ في الشيفرة
     * تعني رفضَ منطقةٍ صحيحةٍ بعد سنتين. و`Intl` هو المرجع الحيّ.
     */
    timezone: zod_1.z
        .string()
        .trim()
        .min(1, "المنطقة الزمنية مطلوبة")
        .max(64)
        .refine(isKnownTimezone, "منطقةٌ زمنيةٌ غير معروفة"),
    dateFormat: zod_1.z.enum(first_boot_keys_1.DATE_FORMATS),
});
function isKnownTimezone(value) {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
    }
    catch {
        return false;
    }
}
// --------------------------------------------------
// 04 — الشبكة
//
// والعنوانُ لا يُحفظ في القاعدة: هو **طريقُ هذا الجهاز إليها**،
// وحفظُه فيها دَورٌ مغلق (‏لتقرأه يجب أن تصل، ولتصل يجب أن تقرأه).
// فيبقى في الجهاز، والقاعدةُ تسجّل النمطَ وحده.
// --------------------------------------------------
exports.networkSchema = zod_1.z.object({
    mode: zod_1.z.enum(first_boot_keys_1.NETWORK_MODES),
});
// --------------------------------------------------
// 05 — العرض
// --------------------------------------------------
exports.displaySchema = zod_1.z.object({
    uiScale: zod_1.z.enum(first_boot_keys_1.UI_SCALES),
    density: zod_1.z.enum(first_boot_keys_1.DENSITIES),
    windowMode: zod_1.z.enum(first_boot_keys_1.WINDOW_MODES),
});
// --------------------------------------------------
// 06 — الأداء
// --------------------------------------------------
exports.performanceSchema = zod_1.z.object({
    profile: zod_1.z.enum(first_boot_keys_1.PERFORMANCE_PROFILES),
});
// --------------------------------------------------
// 07 — الشروط
//
// `accepted: true` حرفياً لا `boolean`: الرفضُ ليس قيمةً تُحفظ،
// فالخطوةُ لا تُتمّ إلّا بالموافقة (§14). و`version` تأتي من الواجهة
// ويقارنها الخادمُ بنسخته — نصٌّ قديمٌ وُوفق عليه في جهازٍ لم يُحدَّث
// لا يُحسب موافقةً على النصّ الحالي.
// --------------------------------------------------
exports.termsSchema = zod_1.z.object({
    accepted: zod_1.z.literal(true),
    version: zod_1.z.string().trim().min(1).max(16),
});
// --------------------------------------------------
// 08 — التحديث
//
// لا تُصدّق الواجهةَ في «حدث التحديث»: كلُّ ما يُحفظ هنا **وقائع
// مقروءة** — أيّ نسخةٍ تعمل الآن ومتى فُحصت. والقناةُ تصف الآلية
// المتاحة فعلاً في هذا التركيب (§36).
// --------------------------------------------------
exports.updateSchema = zod_1.z.object({
    appVersion: zod_1.z.string().trim().min(1, "نسخة التطبيق مطلوبة").max(32),
    channel: zod_1.z.enum(["NONE", "MANUAL", "TAURI"]),
});
// --------------------------------------------------
// 09 — الأجهزة
//
// الملخّصُ يُحفظ نصّاً JSON. ولا صفوفَ لها: الأجهزةُ تُكتشف عند كل
// إقلاع، والمحفوظُ سِجلٌّ لما وُجد يومَ التركيب لا مرجعٌ يُعتمد عليه.
// --------------------------------------------------
const deviceEntry = zod_1.z.object({
    kind: zod_1.z.enum([
        "KEYBOARD",
        "POINTER",
        "DOCUMENT_PRINTER",
        "RECEIPT_PRINTER",
        "SCANNER",
        "BARCODE_SCANNER",
    ]),
    name: zod_1.z.string().trim().max(120).default(""),
    /**
     * `REQUIRED` ⇔ لا يقوم التطبيق بدونه. ولوحةُ المفاتيح وحدَها كذلك
     * — وما عداها اختياريٌّ لا يوقف التهيئة (§37).
     */
    requirement: zod_1.z.enum(["REQUIRED", "OPTIONAL"]),
    detected: zod_1.z.boolean(),
    /** هل جُرّب فعلاً (طبعةُ اختبارٍ أو ضغطةُ مفتاح)؟ */
    verified: zod_1.z.boolean().default(false),
});
exports.devicesSchema = zod_1.z.object({
    devices: zod_1.z.array(deviceEntry).max(32),
});
// --------------------------------------------------
// 10 — المدير
//
// سياسةُ كلمة المرور هنا **وفي الواجهة** — والنسخُ مقصود: الواجهةُ
// تُرشد أثناء الكتابة، والخادمُ يرفض. ولو اكتُفي بالأولى لكان تجاوزُها
// طلباً واحداً بـcurl.
// --------------------------------------------------
const PASSWORD_RULES = [
    { test: /[A-Z]/, message: "يجب أن تحتوي حرفاً كبيراً" },
    { test: /[a-z]/, message: "يجب أن تحتوي حرفاً صغيراً" },
    { test: /[0-9]/, message: "يجب أن تحتوي رقماً" },
    { test: /[^A-Za-z0-9]/, message: "يجب أن تحتوي رمزاً خاصاً" },
];
const passwordField = PASSWORD_RULES.reduce((schema, rule) => schema.regex(rule.test, rule.message), zod_1.z
    .string()
    .min(10, "كلمة المرور 10 محارف على الأقل")
    .max(128, "كلمة المرور طويلة جداً"));
exports.administratorSchema = zod_1.z
    .object({
    firstName: zod_1.z.string().trim().min(2, "الاسم مطلوب").max(50),
    lastName: zod_1.z.string().trim().min(2, "اللقب مطلوب").max(50),
    /*
     * اسمُ الدخول محدودُ المحارف: يُكتب في شاشةٍ بلا لوحةِ مفاتيحَ
     * عربيةٍ أحياناً، ومسافةٌ في طرفه تُنتج حساباً لا يُدخل إليه أبداً
     * ولا يظهر سببُه.
     */
    username: zod_1.z
        .string()
        .trim()
        .min(3, "اسم الدخول 3 محارف على الأقل")
        .max(32)
        .regex(/^[a-zA-Z0-9._-]+$/, "اسم الدخول: حروف لاتينية وأرقام و . _ - فقط"),
    email: zod_1.z.email({ error: "بريدٌ غير صالح" }).max(120).optional().or(zod_1.z.literal("")),
    password: passwordField,
    confirmPassword: zod_1.z.string(),
})
    .refine((body) => body.password === body.confirmPassword, {
    error: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
});
// --------------------------------------------------
// 11 — هوية المؤسسة
//
// الحقولُ الأساسيةُ وحدها (§18): لا مواد ولا أساتذة ولا أسعار.
// وتُكتب في مفاتيح `school.*` نفسِها التي تقرؤها الترويسةُ والإيصالات
// — لا في مفاتيحَ موازية تُنسخ لاحقاً.
// --------------------------------------------------
exports.institutionSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, "اسم المؤسسة مطلوب").max(120),
    shortName: zod_1.z.string().trim().max(32).optional().or(zod_1.z.literal("")),
    nameEn: zod_1.z.string().trim().max(120).optional().or(zod_1.z.literal("")),
    phone: zod_1.z.string().trim().max(32).optional().or(zod_1.z.literal("")),
    email: zod_1.z.email({ error: "بريدٌ غير صالح" }).max(120).optional().or(zod_1.z.literal("")),
    address: zod_1.z.string().trim().max(200).optional().or(zod_1.z.literal("")),
    /** مسارُ شعارٍ سبق رفعُه عبر `/api/uploads` — لا الملفُّ نفسُه */
    logoPath: zod_1.z.string().trim().max(255).optional().or(zod_1.z.literal("")),
});
// --------------------------------------------------
// 12 — السنة الدراسية
// --------------------------------------------------
exports.academicYearSchema = zod_1.z
    .object({
    name: zod_1.z
        .string()
        .trim()
        .min(4, "اسم السنة 4 محارف على الأقل")
        .max(50),
    startDate: zod_1.z.coerce.date({ error: "تاريخ البداية مطلوب" }),
    endDate: zod_1.z.coerce.date({ error: "تاريخ النهاية مطلوب" }),
    sessionsPerMonth: zod_1.z.coerce.number().int().min(1).max(31).default(8),
})
    .refine((body) => body.endDate > body.startDate, {
    error: "تاريخ النهاية يجب أن يكون بعد البداية",
    path: ["endDate"],
});
// --------------------------------------------------
// 13 — الخصوصية
//
// خيارٌ واحد لأنّ الحقيقيَّ واحد (§19/§29). لا تحليلاتٍ ولا تقاريرَ
// أعطالٍ تُرسل: NexSchool لا يفتح اتصالاً خارج شبكة المؤسسة، فعرضُ
// مفتاحٍ لإطفاء ما لا يعمل كذبٌ مهذَّب.
// --------------------------------------------------
exports.privacySchema = zod_1.z.object({
    /** تسجيلُ الأعطال **محلياً** — يُقرأ من الجهاز نفسه عند العطب */
    diagnostics: zod_1.z.boolean(),
});
// --------------------------------------------------
// 14 — هاتف الاسترجاع
//
// **اختياريٌّ بقرارٍ صريح** لا بإهمال (§20): لا يوجد في هذا التركيب
// إرسالُ رسائلَ ولا استرجاعُ كلمةِ مرورٍ آليّ — فاشتراطُه كان سيمنع
// المضيَّ لأجل رقمٍ لا يستعمله شيء. وهو يُحفظ لأنّه **جهةُ اتصال
// المؤسسة** حين يحتاج أحدٌ صاحبَ التركيب.
// --------------------------------------------------
exports.RECOVERY_REQUIRED = false;
exports.recoverySchema = zod_1.z.object({
    phone: zod_1.z
        .string()
        .trim()
        .max(24)
        .refine((value) => value === "" || /^\+?[0-9\s-]{6,24}$/.test(value), "رقمُ هاتفٍ غير صالح"),
});
// --------------------------------------------------
// الرجوع
// --------------------------------------------------
exports.backSchema = zod_1.z.object({
    from: zod_1.z.enum(first_boot_state_1.FIRST_BOOT_STEPS),
});
// --------------------------------------------------
// إعادةُ التهيئة — محميّةٌ بالمصادقة والصلاحية (§59)
// --------------------------------------------------
exports.resetFirstBootSchema = zod_1.z.object({
    /** كلمةٌ تُكتب بيد المستخدم — الحرسُ الثالث بعد المصادقة والصلاحية */
    confirm: zod_1.z.literal("RESET"),
});
//# sourceMappingURL=first-boot.schema.js.map