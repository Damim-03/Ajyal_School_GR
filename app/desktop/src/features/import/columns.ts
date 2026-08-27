import { normalizeArabic } from "../../lib/search";

/**
 * **تعريفُ أعمدة ملفّ Excel — مصدرٌ واحد يشتقّ منه كلُّ شيء.**
 *
 * منه تُقرأ العناوين، وبه يُتحقَّق من كلّ خانة، وعنه يُولَّد النموذجُ
 * الفارغ الذي يُنزّله المستخدم. وواحدٌ لأنّ ثلاثةً تفترق: يُضاف عمودٌ
 * إلى النموذج ولا يعرفه التحقّق، فيدخل بلا فحص.
 *
 * والقيود منسوخةٌ عن `student.schema.ts` و`teacher.schema.ts` في
 * الخادم. **وهي حارسٌ مبكّر لا بديل**: الخادمُ يفحص كلَّ سطرٍ من
 * جديد، وفائدةُ الفحص هنا أن يرى المستخدمُ أربعمئة خطأٍ دفعةً واحدة
 * قبل أن يُكتب في القاعدة شيء، لا أن يكتشفها سطراً سطراً.
 */

export type FieldKind =
  | { kind: "text"; min?: number; max: number }
  | { kind: "phone" }
  | { kind: "date"; past?: boolean }
  | { kind: "gender" }
  | { kind: "bool" }
  | { kind: "number"; min: number; max: number; exclusiveMin?: boolean }
  | { kind: "email" }
  /** الطور والمستوى — يُطابقان بالاسم ثمّ يُحلّان إلى `levelId` */
  | { kind: "lookup"; of: "stage" | "level" };

export interface ColumnSpec {
  /** العنوان كما يُكتب في الصفّ الأوّل من الورقة */
  readonly header: string;
  /** اسم الحقل الذي يُرسل إلى الخادم — أو مفتاحٌ داخليّ للبحث */
  readonly key: string;
  readonly required: boolean;
  readonly field: FieldKind;
  /** عناوينُ يقبلها المستورِد أيضاً — تكتُّبُ الناس مختلف */
  readonly aliases?: readonly string[];
  /** يُعرض في النموذج الفارغ تحت العنوان */
  readonly hint?: string;
}

/* الهاتف نصٌّ لا رقم — والقيد نفسُه في الخادم */
const PHONE: FieldKind = { kind: "phone" };

export const STUDENT_COLUMNS: readonly ColumnSpec[] = [
  {
    header: "اللقب",
    key: "lastName",
    required: true,
    field: { kind: "text", min: 2, max: 50 },
    aliases: ["النسب", "اسم العائلة"],
  },
  {
    header: "الاسم",
    key: "firstName",
    required: true,
    field: { kind: "text", min: 2, max: 50 },
    aliases: ["الإسم", "الاسم الشخصي", "الاسم الأول"],
  },
  {
    header: "الجنس",
    key: "gender",
    required: true,
    field: { kind: "gender" },
    hint: "ذكر أو أنثى",
  },
  {
    header: "هاتف الولي",
    key: "parentPhone",
    required: true,
    field: PHONE,
    aliases: ["هاتف الوليّ", "هاتف ولي الأمر", "هاتف الأب"],
    hint: "صيّغ العمود نصّاً",
  },
  {
    header: "تاريخ الميلاد",
    key: "birthDate",
    required: false,
    field: { kind: "date", past: true },
    hint: "YYYY-MM-DD",
  },
  {
    header: "مكان الميلاد",
    key: "birthPlace",
    required: false,
    field: { kind: "text", max: 120 },
    aliases: ["مسقط الرأس"],
  },
  {
    header: "الطور",
    key: "__stage",
    required: false,
    field: { kind: "lookup", of: "stage" },
    aliases: ["الطور التعليمي", "المرحلة"],
    hint: "مطابقٌ لما في البنية الدراسية",
  },
  {
    header: "المستوى",
    key: "__level",
    required: false,
    field: { kind: "lookup", of: "level" },
    aliases: ["المستوى الدراسي", "السنة الدراسية للطالب"],
    hint: "مطابقٌ لما في البنية الدراسية",
  },
  {
    header: "هاتف الطالب",
    key: "phone",
    required: false,
    field: PHONE,
    aliases: ["الهاتف"],
  },
  {
    header: "هاتف الطوارئ",
    key: "emergencyPhone",
    required: false,
    field: PHONE,
  },
  {
    header: "العنوان",
    key: "address",
    required: false,
    field: { kind: "text", max: 200 },
  },
  {
    header: "المدرسة الأصلية",
    key: "schoolName",
    required: false,
    field: { kind: "text", max: 100 },
    aliases: ["المؤسسة الأصلية", "المدرسة"],
  },
  {
    header: "تاريخ التسجيل",
    key: "registrationDate",
    required: false,
    field: { kind: "date" },
    hint: "فارغُه = اليوم",
  },
  {
    header: "حقوق التسجيل مدفوعة",
    key: "registrationFeePaid",
    required: false,
    field: { kind: "bool" },
    hint: "نعم أو لا",
  },
  {
    header: "مبلغ حقوق التسجيل",
    key: "registrationFeeAmount",
    required: false,
    field: { kind: "number", min: 0, max: 9_999_999 },
  },
  {
    header: "تاريخ دفع الحقوق",
    key: "registrationFeePaidAt",
    required: false,
    field: { kind: "date" },
    hint: "YYYY-MM-DD",
  },
  {
    header: "ملاحظة",
    key: "note",
    required: false,
    field: { kind: "text", max: 1000 },
    aliases: ["ملاحظات"],
  },
  {
    header: "نشط",
    key: "isActive",
    required: false,
    field: { kind: "bool" },
    hint: "فارغُه = نعم",
  },
];

export const TEACHER_COLUMNS: readonly ColumnSpec[] = [
  {
    header: "اللقب",
    key: "lastName",
    required: true,
    field: { kind: "text", min: 2, max: 50 },
    aliases: ["النسب", "اسم العائلة"],
  },
  {
    header: "الاسم",
    key: "firstName",
    required: true,
    field: { kind: "text", min: 2, max: 50 },
    aliases: ["الإسم", "الاسم الشخصي"],
  },
  {
    header: "الجنس",
    key: "gender",
    required: true,
    field: { kind: "gender" },
    hint: "ذكر أو أنثى",
  },
  {
    header: "تاريخ التوظيف",
    key: "hireDate",
    required: true,
    field: { kind: "date", past: true },
    aliases: ["تاريخ التعيين", "تاريخ الالتحاق"],
    hint: "YYYY-MM-DD — في الماضي",
  },
  {
    header: "البريد الإلكتروني",
    key: "email",
    required: false,
    field: { kind: "email" },
    aliases: ["الإيميل", "البريد"],
    hint: "فريدٌ — واتركه فارغاً لمن لا بريد له",
  },
  { header: "الهاتف", key: "phone", required: false, field: PHONE },
  {
    header: "تاريخ الميلاد",
    key: "birthDate",
    required: false,
    field: { kind: "date", past: true },
    hint: "YYYY-MM-DD",
  },
  {
    header: "العنوان",
    key: "address",
    required: false,
    field: { kind: "text", max: 200 },
  },
  {
    header: "المؤهل",
    key: "qualification",
    required: false,
    field: { kind: "text", max: 100 },
    aliases: ["المؤهّل", "الشهادة"],
  },
  {
    header: "التخصص",
    key: "specialization",
    required: false,
    field: { kind: "text", max: 100 },
    aliases: ["التخصّص", "المادة"],
  },
  {
    header: "الأجر",
    key: "salary",
    required: false,
    field: { kind: "number", min: 0, max: 9_999_999, exclusiveMin: true },
    aliases: ["الراتب"],
    hint: "أكبر من صفر — أو فارغ",
  },
  {
    header: "نشط",
    key: "isActive",
    required: false,
    field: { kind: "bool" },
    hint: "فارغُه = نعم",
  },
];

export type SheetKind = "students" | "teachers";

export const COLUMNS: Readonly<Record<SheetKind, readonly ColumnSpec[]>> = {
  students: STUDENT_COLUMNS,
  teachers: TEACHER_COLUMNS,
};

/** أسماءُ الورقتين كما تُنشأ في النموذج — وتُقبل مرادفاتُها عند القراءة */
export const SHEET_NAMES: Readonly<Record<SheetKind, string>> = {
  students: "الطلبة",
  teachers: "الأساتذة",
};

const SHEET_ALIASES: Readonly<Record<SheetKind, readonly string[]>> = {
  students: ["الطلبة", "الطلاب", "التلاميذ", "students"],
  teachers: ["الأساتذة", "الاساتذة", "المعلمون", "teachers"],
};

/**
 * مطابقةُ عنوانٍ كتبه المستخدم بعمودٍ معروف.
 *
 * تُوحَّد الهمزاتُ والتاء المربوطة عبر `normalizeArabic` — نفسِها
 * التي يبحث بها الجدول — فـ«الإسم» و«الاسم» و«المؤهّل» و«المؤهل»
 * سواء. ورفضُ عنوانٍ لفارقٍ في همزة عطبٌ في المستورِد لا في الملفّ.
 */
export const matchColumn = (
  header: string,
  columns: readonly ColumnSpec[],
): ColumnSpec | null => {
  const wanted = normalizeArabic(header);

  if (!wanted) return null;

  return (
    columns.find(
      (column) =>
        normalizeArabic(column.header) === wanted ||
        column.aliases?.some((alias) => normalizeArabic(alias) === wanted),
    ) ?? null
  );
};

/** مطابقةُ اسم ورقةٍ بنوعها */
export const matchSheet = (name: string): SheetKind | null => {
  const wanted = normalizeArabic(name);

  for (const [kind, aliases] of Object.entries(SHEET_ALIASES) as [
    SheetKind,
    readonly string[],
  ][]) {
    if (aliases.some((alias) => normalizeArabic(alias) === wanted)) return kind;
  }

  return null;
};
