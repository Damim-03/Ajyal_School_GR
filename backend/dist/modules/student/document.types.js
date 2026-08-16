"use strict";
/**
 * كتالوج وثائق ملف الطالب.
 *
 * **هذا الملف هو تعريف «الملف مكتمل»**: الملف مكتمل حين توجد كلّ
 * الوثائق المعلَّمة `required`. فأيّ تعديل هنا يغيّر معنى الاكتمال في
 * كل الشاشات والتقارير — لا في مكانٍ واحد.
 *
 * وُضعت الأنواع في الشيفرة لا في قاعدة البيانات عمداً في هذه المرحلة:
 * القائمة تكاد لا تتغيّر، وجعلُها قابلة للتحرير من الواجهة يحتاج شاشة
 * إدارة أنواع كاملة. إن احتجتَها لاحقاً فالنقل إلى جدول Setting
 * لا يمسّ سوى هذا الملف.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.completenessOf = exports.isKnownType = exports.REQUIRED_KEYS = exports.DOCUMENT_KEYS = exports.DOCUMENT_TYPES = void 0;
exports.DOCUMENT_TYPES = [
    {
        key: "birth_certificate",
        label: "شهادة الميلاد",
        required: true,
        hint: "نسخة رقم 12 أو 12 مكرّر",
    },
    {
        key: "school_certificate",
        label: "شهادة مدرسية",
        required: true,
        hint: "من المؤسسة الأصلية",
    },
    {
        key: "photo",
        label: "صورة شمسية",
        required: true,
    },
    {
        key: "parent_id",
        label: "بطاقة تعريف ولي الأمر",
        required: false,
    },
    {
        key: "medical_certificate",
        label: "شهادة طبية",
        required: false,
    },
    {
        key: "previous_results",
        label: "كشف النقاط السابق",
        required: false,
    },
];
exports.DOCUMENT_KEYS = exports.DOCUMENT_TYPES.map((d) => d.key);
exports.REQUIRED_KEYS = exports.DOCUMENT_TYPES.filter((d) => d.required).map((d) => d.key);
const isKnownType = (key) => exports.DOCUMENT_KEYS.includes(key);
exports.isKnownType = isKnownType;
/** حالة اكتمال ملفٍّ انطلاقاً من الأنواع الموجودة */
const completenessOf = (presentTypes) => {
    const present = new Set(presentTypes);
    const missing = exports.REQUIRED_KEYS.filter((key) => !present.has(key));
    return {
        required: exports.REQUIRED_KEYS.length,
        presentRequired: exports.REQUIRED_KEYS.length - missing.length,
        missing,
        isComplete: missing.length === 0,
    };
};
exports.completenessOf = completenessOf;
//# sourceMappingURL=document.types.js.map