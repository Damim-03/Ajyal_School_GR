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

export interface TeacherDocumentType {
  key: string;
  label: string;
  hint?: string;
}

export const TEACHER_DOCUMENT_TYPES: TeacherDocumentType[] = [
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

export const TEACHER_DOCUMENT_KEYS = TEACHER_DOCUMENT_TYPES.map((d) => d.key);

/** نوعٌ أضافته الإدارة — مفتاحُه من عندنا لا من عندها، وتسميتُه من عندها */
export const CUSTOM_KEY_PATTERN = /^custom_[a-z0-9]{4,40}$/;

export const isCustomType = (key: string) => CUSTOM_KEY_PATTERN.test(key);

export const isKnownTeacherType = (key: string) =>
  TEACHER_DOCUMENT_KEYS.includes(key) || isCustomType(key);
