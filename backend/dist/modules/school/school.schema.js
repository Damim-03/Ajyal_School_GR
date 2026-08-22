"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetSchoolSchema = exports.updateSchoolSchema = exports.SCHOOL_KEYS = exports.SCHOOL_DEFAULTS = void 0;
const zod_1 = require("zod");
/**
 * هوية المدرسة — المفاتيح المعروفة وقيمها الافتراضية.
 *
 * **مصدر واحد**: الافتراضيات والتحقق والإرجاع كلّها تُشتقّ من هذا
 * الجدول. إضافة حقل جديد سطرٌ واحد هنا — لا migration ولا تعديل
 * في الخدمة ولا في المتحكّم.
 *
 * القيم كلّها نصوص (كما في جدول Setting)، والفارغ يعني «غير مضبوط»
 * فتظهر الواجهة قيمتها الافتراضية.
 */
exports.SCHOOL_DEFAULTS = {
    "school.name_ar": "مركز أجيال التعليمي",
    "school.name_en": "Ajyal Learning Center",
    /** يظهر في ترويسة الرئيسية وشاشة الإقلاع — قصير عمداً */
    "school.short_name": "أجيال",
    "school.short_suffix": "GR",
    "school.tagline": "نظام إدارة المركز",
    "school.address": "",
    "school.phone": "",
    "school.email": "",
    /** لون الهوية — يصبغ الإقلاع والدخول وشعار الترويسة */
    "school.brand_color": "#7dd3fc",
    /** مسار الشعار المرفوع — يظهر في الترويسة وفوق كل مطبوعة */
    "school.logo_path": "",
    /**
     * عرض الشعار المطبوع بالمليمتر.
     *
     * بالمليمتر لا بالبكسل: الرقم يُضبط لورقٍ عرضه 72 أو 80 مم، والبكسل
     * وحدة شاشة لا تقول شيئاً عن الورق. `school.logo_size` القديم (بكسل)
     * تُقرأ منه الواجهة قيمةً محوَّلة مرّة واحدة ثمّ يُهمل.
     */
    "school.logo_width_mm": "18",
    /**
     * تباين الشعار وسطوعه بالمئة — للطباعة لا للشاشة.
     *
     * الطابعة الحرارية ثنائية اللون: الرمادي المتدرّج يخرج بقعاً. رفع
     * التباين يقرّب الشعار من أبيض وأسود صافٍ، والسطوع يزيح العتبة
     * التي يصير عندها الرمادي أسود.
     */
    "school.logo_contrast": "100",
    "school.logo_clarity": "100",
    /**
     * حقوقُ التسجيل — مبلغٌ يُقبض مرّةً عند التحاق الطالب، غيرُ الحقّ الشهري.
     *
     * وفارغُه يعني «لا مبلغَ مقرَّر»: يُكتب هنا مرّةً فيُملأ وحده في نافذة
     * التسجيل ويبقى قابلاً للتغيير فيها لكلّ حالة. وصفرٌ افتراضيٌّ كان
     * سيُثبَّت في الوصول بلا قصد.
     */
    "school.registration_fee": "",
    /** يُطبع أسفل الإيصالات والفواتير */
    "school.receipt_note": "",
    "school.receipt_thanks": "شكراً لثقتكم",
    "school.currency": "دج",
};
exports.SCHOOL_KEYS = Object.keys(exports.SCHOOL_DEFAULTS);
// --------------------------------------------------
// Update — دفعة من المفاتيح
//
// تُقبل المفاتيح المعروفة وحدها: مفتاح مجهول يعني خطأً مطبعياً
// سيُخزَّن بصمت ولا يُقرأ أبداً.
// --------------------------------------------------
/**
 * مفاتيح رقمية تُخزَّن نصّاً — مداها محدود عمداً.
 *
 * شعار بارتفاع 400 بكسل لا يُقصّ في المعاينة بل عند الطباعة، والحدّ
 * هنا يمنع ذلك قبل وقوعه لا بعده.
 */
const NUMERIC_RANGES = {
    "school.logo_width_mm": [8, 40],
    "school.logo_contrast": [50, 400],
    "school.logo_clarity": [50, 200],
};
const fieldSchema = (key) => {
    if (key === "school.brand_color") {
        return zod_1.z
            .string()
            .trim()
            .regex(/^#[0-9A-Fa-f]{6}$/, "اللون يجب أن يكون بصيغة #RRGGBB");
    }
    const range = NUMERIC_RANGES[key];
    if (range) {
        const [min, max] = range;
        return zod_1.z
            .string()
            .trim()
            .regex(/^\d{1,4}$/, "القيمة يجب أن تكون رقماً")
            .refine((value) => Number(value) >= min && Number(value) <= max, {
            error: `القيمة يجب أن تكون بين ${min} و ${max}`,
        });
    }
    return zod_1.z.string().trim().max(500, "القيمة طويلة جداً");
};
exports.updateSchoolSchema = zod_1.z
    .object(Object.fromEntries(exports.SCHOOL_KEYS.map((key) => [key, fieldSchema(key)])))
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "أرسل حقلاً واحداً على الأقل",
})
    .refine((body) => body["school.name_ar"] === undefined ||
    body["school.name_ar"].length >= 2, { error: "اسم المدرسة مطلوب", path: ["school.name_ar"] });
// --------------------------------------------------
// Reset — إعادة مفاتيح إلى قيمها الافتراضية
// --------------------------------------------------
exports.resetSchoolSchema = zod_1.z.object({
    keys: zod_1.z
        .array(zod_1.z.enum(exports.SCHOOL_KEYS))
        .min(1, "اختر مفتاحاً واحداً على الأقل"),
});
//# sourceMappingURL=school.schema.js.map