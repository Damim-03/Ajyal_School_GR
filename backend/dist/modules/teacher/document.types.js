"use strict";
/**
 * كتالوج وثائق ملفّ الأستاذ.
 *
 * وهو غيرُ كتالوج الطالب في أمرٍ جوهري: **أنواعُه مفتوحة**.
 *
 * وثائقُ الطالب واحدةٌ في كل مؤسسة — شهادةُ ميلادٍ وشهادةٌ مدرسية
 * وصورة — فأُغلقت في الشيفرة وصار «الملف مكتمل» جملةً واحدة. أمّا ملفّ
 * التوظيف فيتبدّل بتبدّل الجهة التي تطلبه: مؤسّسةٌ تشترط صحيفةَ
 * السوابق، وأخرى تكتفي بالشهادة والبطاقة، وثالثةٌ تطلب وثيقةً لم تخطر
 * لمن كتب هذا الملف. فمن أغلق القائمة هنا أجبر الإدارةَ على وضع وثيقةٍ
 * في خانةٍ ليست لها — و«شهادة طبية» تحمل صورةَ رخصةِ السياقة أسوأ من
 * لا خانةَ أصلاً.
 *
 * فالمكتوبُ هنا **اقتراحٌ لا حصر**: خاناتٌ جاهزة تُغني عن الكتابة في
 * الغالب، ومعها بابٌ مفتوح لنوعٍ تسمّيه الإدارة بنفسها مفتاحُه
 * `custom_…` وتسميتُه محفوظةٌ في صفّه.
 *
 * ولا `required` هنا ولا حسابَ اكتمال: الإلزامُ يقرّره من يوظّف لا من
 * يبرمج، وشارةُ «ملفٌّ ناقص» على أستاذٍ سلّم ما طُلب منه إنذارٌ كاذب.
 * فالعرضُ يقول «سُلّم كذا» ولا يقول «ينقصه كذا».
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isKnownTeacherType = exports.isCustomType = exports.CUSTOM_KEY_PATTERN = exports.TEACHER_DOCUMENT_KEYS = exports.TEACHER_DOCUMENT_TYPES = void 0;
exports.TEACHER_DOCUMENT_TYPES = [
    {
        key: "photo",
        label: "صورة شمسية",
        hint: "الورقة المسلَّمة — وصورةُ الملفّ تُضاف في شقّ المعلومات",
    },
    {
        key: "id_card",
        label: "بطاقة التعريف الوطنية",
    },
    {
        key: "diploma",
        label: "الشهادة العلمية",
        hint: "نسخة مصادق عليها",
    },
    {
        key: "birth_certificate",
        label: "شهادة الميلاد",
        hint: "نسخة رقم 12",
    },
    {
        key: "residence",
        label: "شهادة الإقامة",
    },
    {
        key: "criminal_record",
        label: "صحيفة السوابق العدلية",
    },
    {
        key: "medical_certificate",
        label: "شهادة طبية",
    },
    {
        key: "cv",
        label: "السيرة الذاتية",
    },
    {
        key: "contract",
        label: "عقد العمل",
        hint: "نسخة موقّعة",
    },
];
exports.TEACHER_DOCUMENT_KEYS = exports.TEACHER_DOCUMENT_TYPES.map((d) => d.key);
/** نوعٌ أضافته الإدارة — مفتاحُه من عندنا لا من عندها، وتسميتُه من عندها */
exports.CUSTOM_KEY_PATTERN = /^custom_[a-z0-9]{4,40}$/;
const isCustomType = (key) => exports.CUSTOM_KEY_PATTERN.test(key);
exports.isCustomType = isCustomType;
const isKnownTeacherType = (key) => exports.TEACHER_DOCUMENT_KEYS.includes(key) || (0, exports.isCustomType)(key);
exports.isKnownTeacherType = isKnownTeacherType;
//# sourceMappingURL=document.types.js.map