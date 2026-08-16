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

export interface DocumentType {
  key: string;
  label: string;
  /** يدخل في حساب الاكتمال */
  required: boolean;
  hint?: string;
}

export const DOCUMENT_TYPES: DocumentType[] = [
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

export const DOCUMENT_KEYS = DOCUMENT_TYPES.map((d) => d.key);

export const REQUIRED_KEYS = DOCUMENT_TYPES.filter((d) => d.required).map(
  (d) => d.key,
);

export const isKnownType = (key: string) => DOCUMENT_KEYS.includes(key);

/** حالة اكتمال ملفٍّ انطلاقاً من الأنواع الموجودة */
export const completenessOf = (presentTypes: string[]) => {
  const present = new Set(presentTypes);
  const missing = REQUIRED_KEYS.filter((key) => !present.has(key));

  return {
    required: REQUIRED_KEYS.length,
    presentRequired: REQUIRED_KEYS.length - missing.length,
    missing,
    isComplete: missing.length === 0,
  };
};
