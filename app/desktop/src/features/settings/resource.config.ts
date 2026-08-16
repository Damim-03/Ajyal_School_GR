import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  BookOpen,
  CalendarDays,
  Clock,
  DoorOpen,
  Layers,
  Percent,
  School,
  UserCog,
} from "lucide-react";

import { PATHS } from "../../routes/paths";

/**
 * تهيئة الموارد المدفوعة بالبيانات.
 *
 * عشر شاشات تفعل الشيء نفسه: جدول + نموذج + حذف محميّ. فبدل عشر نسخ
 * تفترق عند أوّل تعديل، تصف كلُّ شاشةٍ **حقولها وأعمدتها** هنا ويتكفّل
 * `ResourceScreen` بالباقي.
 *
 * وهي ثلاثة أقسام بحسب القسم الذي تنتمي إليه:
 *   `RESOURCES`         → البنية الدراسية (/academic)
 *   `FINANCE_RESOURCES` → المالية (/finance)
 *   `ADMIN_RESOURCES`   → الإعدادات (/settings)
 *
 * الملفّ باقٍ تحت features/settings لأنّ `ResourceScreen` هناك —
 * والمسارات وحدها هي التي انتقلت، لا الشيفرة.
 *
 * الحقول المشتقّة (مثل sortOrder التلقائي) لا تُذكر: الخادم يحسبها،
 * وذكرها هنا يعني حقلاً فارغاً يربك المستخدم.
 */

export type FieldKind =
  | "text"
  | "number"
  /** مبلغٌ بعملته — رقمان بعد الفاصلة، ومعاينةٌ تحته تقول ما سيُحفظ */
  | "money"
  | "date"
  | "time"
  | "color"
  | "select"
  | "reference"
  | "switch"
  | "textarea"
  /** حروفٌ مخفيّة — والفارغ عند التعديل يعني «لا تغيّرها» */
  | "password";

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  hint?: string;
  /**
   * للقوائم الثابتة.
   *
   * و`desc` شرحُ الخيار المختار — يُعرض تحت القائمة بعد الاختيار.
   * الاسم وحده لا يكفي في القوائم التي تُغيّر معنى الحساب: «الحاضرون»
   * و«الذين دفعوا» كلمتان قصيرتان، والفرقُ بينهما مَن يتحمّل تأخّر
   * الطالب — المؤسسةُ أم الأستاذ.
   */
  options?: { value: string; label: string; desc?: string }[];
  /** يأخذ عرض النموذج كلَّه بدل نصفه */
  wide?: boolean;
  /** للمراجع — مسار الجلب */
  refPath?: string;
  /**
   * تسمية خيار المرجع حين لا يكون `name`.
   *
   * الأشخاص لا اسمَ واحداً لهم في الخادم: `firstName` و`lastName`
   * حقلان، فقائمةٌ تقرأ `name` وحده تعرض خياراتٍ فارغة لا يُختار منها.
   * مساراتٌ تُركَّب بمسافة — ["lastName", "firstName"] كترتيب الكشوف.
   */
  refLabel?: string[];
  /**
   * نصّ الخيار الفارغ في قائمة مرجعية — حين يكون للفراغ معنًى يُسمّى.
   * «— اختر —» افتراضاً.
   */
  emptyOption?: string;
  /** لا يظهر في نموذج التعديل (مفتاح لا يُغيَّر) */
  createOnly?: boolean;
  /**
   * يظهر الحقل بشرط — حين يكون لبعض الحقول معنًى في اختيارٍ دون آخر.
   *
   * سياسةُ التخليص أربعُ طرقٍ لكلٍّ حقولُها، وعرضُها مجتمعةً يجعل
   * ثلاثةَ أرباع النموذج حقولاً لا أثر لها في الحساب — ولا شيء يقول
   * ذلك للمستخدم. والقيمة المخزَّنة لا تُمحى بالإخفاء، فالعودة إلى
   * الطريقة تُعيدها كما كانت.
   */
  showIf?: (form: Record<string, unknown>) => boolean;
  min?: number;
  max?: number;
}

/**
 * شرح الحساب داخل النموذج.
 *
 * سببُه أنّ الأرقام في هذا النظام مشتقّةٌ لا مُدخَلة: من رأى «140.625»
 * في الكشف لا يجد في النظام حقلاً يحملها، لأنها حاصلُ ثلاثةِ حقولٍ في
 * ثلاث شاشات. فالسياسة — وهي مصدر القاعدة — تشرح ما ستفعله **قبل**
 * الحفظ، بالقيم المكتوبة في النموذج نفسه لا بمثالٍ عام.
 */
export interface ExplainSpec {
  /** سطرٌ واحد يقول ما تفعله هذه السياسة بلغة الإدارة لا بلغة المعادلة */
  intro: string;
  /** الحقول التي تدخل الحساب في هذا الاختيار */
  uses?: string[];
  /** المعادلة سطراً سطراً — تُعرض بخطٍّ أحادي */
  formula?: string[];
  /**
   * حسابٌ كامل بأرقامٍ محسوسة.
   *
   * المعادلة بالرموز لا تُقنع من لم يرَ الرقم يخرج: «الحقّ الشهري ÷
   * الحصص المعتمدة» عبارةٌ صحيحة، و«1500 ÷ 8 = 187.50» فهمٌ. والمثال
   * يُعلَّم أنّه مثال كي لا يُظنّ قيمةً مضبوطة في النظام.
   */
  example?: { label: string; lines: string[] };
  /** ما يُقرأ قبل الحفظ: أثرُ الاختيار، ومن يتحمّل ماذا */
  notes?: string[];
}

export interface ColumnSpec {
  key: string;
  label: string;
  /** مسار متداخل مثل level.name */
  path?: string;
  /**
   * `person` يقرأ كائناً فيه firstName/lastName ويكتبه «اللقب الاسم».
   *
   * و`avatar` لا يقرأ `key` أصلاً بل **الصفَّ نفسه**: الصورة إن وُجدت
   * وإلّا ظلٌّ بحسب `gender` — فعمودٌ واحدٌ يحتاج ثلاثة حقول، ومسارٌ
   * واحد لا يحملها.
   */
  kind?:
    | "text"
    | "date"
    | "time"
    | "money"
    | "badge"
    | "bool"
    | "count"
    | "person"
    | "avatar";
  align?: "start" | "center" | "end";
  /**
   * ما يُكتب مكان الفراغ حين يكون للفراغ معنى.
   *
   * «—» يقول «لا قيمة»، وأحياناً يكون الفراغُ قيمةً: فترةٌ بلا أستاذ
   * ليست ناقصةً بل عامّةٌ للمؤسسة كلها.
   */
  emptyLabel?: string;
}

export interface ResourceSpec {
  key: string;
  path: string;
  api: string;
  label: string;
  singular: string;
  desc: string;
  icon: LucideIcon;
  tone: string;
  permission: string;
  columns: ColumnSpec[];
  fields: FieldSpec[];
  /** فلاتر مرجعية اختيارية فوق الجدول */
  filters?: { key: string; label: string; refPath: string; refLabel?: string[] }[];
  /** شرح ما ستفعله القيم المكتوبة — يُعرض أسفل حقول النموذج */
  explain?: (form: Record<string, unknown>) => ExplainSpec | null;
}

const ACTIVE_FIELD: FieldSpec = {
  key: "isActive",
  label: "مفعّل",
  kind: "switch",
};

/** البنية الدراسية — تحت /academic لا /settings */
export const RESOURCES: ResourceSpec[] = [
  {
    key: "academic-years",
    path: PATHS.academicYears,
    api: "/settings/academic-years",
    label: "السنوات الدراسية",
    singular: "سنة دراسية",
    desc: "السنة الجارية وفتراتها — كل شيء يُنسب إليها.",
    icon: CalendarDays,
    tone: "#7dd3fc",
    permission: "academic-year",
    columns: [
      { key: "name", label: "الاسم" },
      { key: "startDate", label: "البداية", kind: "date" },
      { key: "endDate", label: "النهاية", kind: "date" },
      { key: "isCurrent", label: "الجارية", kind: "bool", align: "center" },
      { key: "isActive", label: "الحالة", kind: "badge", align: "center" },
    ],
    fields: [
      { key: "name", label: "الاسم", kind: "text", required: true, hint: "مثال: 2026-2027" },
      { key: "startDate", label: "تاريخ البداية", kind: "date", required: true },
      { key: "endDate", label: "تاريخ النهاية", kind: "date", required: true },
      {
        key: "isCurrent",
        label: "هي السنة الجارية",
        kind: "switch",
        hint: "تعيينها يُلغي العلم عن باقي السنوات تلقائياً",
      },
      ACTIVE_FIELD,
    ],
  },
  {
    key: "education-stages",
    path: PATHS.academicStages,
    api: "/settings/education-stages",
    label: "الأطوار",
    singular: "طور",
    desc: "ابتدائي · متوسط · ثانوي — جذر البنية الدراسية.",
    icon: Layers,
    tone: "#a5b4fc",
    permission: "education-stage",
    columns: [
      { key: "name", label: "الاسم" },
      { key: "type", label: "النوع", kind: "badge" },
      { key: "sortOrder", label: "الترتيب", align: "center" },
      { key: "_count.levels", label: "المستويات", path: "_count.levels", kind: "count", align: "center" },
      { key: "isActive", label: "الحالة", kind: "badge", align: "center" },
    ],
    fields: [
      { key: "name", label: "الاسم", kind: "text", required: true },
      {
        key: "type",
        label: "النوع",
        kind: "select",
        required: true,
        options: [
          { value: "PRIMARY", label: "ابتدائي" },
          { value: "MIDDLE", label: "متوسط" },
          { value: "SECONDARY", label: "ثانوي" },
        ],
      },
      { key: "sortOrder", label: "الترتيب", kind: "number", min: 0, hint: "يُحسب تلقائياً إن تُرك فارغاً" },
      ACTIVE_FIELD,
    ],
  },
  {
    key: "levels",
    path: PATHS.academicLevels,
    api: "/settings/levels",
    label: "المستويات",
    singular: "مستوى",
    desc: "أولى متوسط، ثانية متوسط… داخل كل طور.",
    icon: School,
    tone: "#5eead4",
    permission: "level",
    filters: [{ key: "educationStageId", label: "الطور", refPath: "/settings/education-stages" }],
    columns: [
      { key: "name", label: "الاسم" },
      { key: "educationStage.name", label: "الطور", path: "educationStage.name" },
      { key: "sortOrder", label: "الترتيب", align: "center" },
      { key: "_count.studyGroups", label: "الأفواج", path: "_count.studyGroups", kind: "count", align: "center" },
      { key: "isActive", label: "الحالة", kind: "badge", align: "center" },
    ],
    fields: [
      {
        key: "educationStageId",
        label: "الطور",
        kind: "reference",
        required: true,
        refPath: "/settings/education-stages",
      },
      { key: "name", label: "الاسم", kind: "text", required: true },
      { key: "sortOrder", label: "الترتيب", kind: "number", min: 0, hint: "يُحسب تلقائياً إن تُرك فارغاً" },
      ACTIVE_FIELD,
    ],
  },
  {
    key: "study-groups",
    path: PATHS.academicGroups,
    api: "/settings/study-groups",
    label: "الأفواج",
    singular: "فوج",
    desc: "أفواج كل مستوى ونوعها وطاقتها القصوى.",
    icon: School,
    tone: "#c4b5fd",
    permission: "study-group",
    filters: [{ key: "levelId", label: "المستوى", refPath: "/settings/levels" }],
    columns: [
      { key: "name", label: "الاسم" },
      { key: "level.name", label: "المستوى", path: "level.name" },
      { key: "type", label: "النوع", kind: "badge" },
      { key: "maxStudents", label: "الطاقة", align: "center" },
      { key: "isActive", label: "الحالة", kind: "badge", align: "center" },
    ],
    fields: [
      { key: "levelId", label: "المستوى", kind: "reference", required: true, refPath: "/settings/levels" },
      { key: "name", label: "الاسم", kind: "text", required: true },
      {
        key: "type",
        label: "النوع",
        kind: "select",
        options: [
          { value: "NORMAL", label: "عادي" },
          { value: "ELITE", label: "نخبة" },
          { value: "INTENSIVE", label: "مكثّف" },
          { value: "EVENING", label: "مسائي" },
        ],
      },
      { key: "maxStudents", label: "الطاقة القصوى", kind: "number", min: 1, max: 500, hint: "يُرفض التسجيل عند بلوغها" },
      ACTIVE_FIELD,
    ],
  },
  {
    key: "subjects",
    path: PATHS.academicSubjects,
    api: "/settings/subjects",
    label: "المواد",
    singular: "مادة",
    desc: "المواد المدرَّسة ورموزها وألوانها.",
    icon: BookOpen,
    tone: "#fcd34d",
    permission: "subject",
    columns: [
      { key: "name", label: "الاسم" },
      { key: "code", label: "الرمز" },
      { key: "isActive", label: "الحالة", kind: "badge", align: "center" },
    ],
    fields: [
      { key: "name", label: "الاسم", kind: "text", required: true },
      { key: "code", label: "الرمز", kind: "text", hint: "اختياري وفريد" },
      { key: "color", label: "اللون", kind: "color" },
      { key: "description", label: "الوصف", kind: "textarea" },
      ACTIVE_FIELD,
    ],
  },
  {
    key: "classrooms",
    path: PATHS.academicClassrooms,
    api: "/settings/classrooms",
    label: "القاعات",
    singular: "قاعة",
    desc: "قاعات الدراسة وسعتها وطوابقها.",
    icon: DoorOpen,
    tone: "#f9a8d4",
    permission: "classroom",
    columns: [
      { key: "name", label: "الاسم" },
      { key: "code", label: "الرمز" },
      { key: "capacity", label: "السعة", align: "center" },
      { key: "floor", label: "الطابق", align: "center" },
      { key: "isActive", label: "الحالة", kind: "badge", align: "center" },
    ],
    fields: [
      { key: "name", label: "الاسم", kind: "text", required: true },
      { key: "code", label: "الرمز", kind: "text", hint: "اختياري وفريد" },
      { key: "capacity", label: "السعة", kind: "number", min: 1, max: 500 },
      { key: "floor", label: "الطابق", kind: "number", min: -5, max: 50 },
      { key: "description", label: "الوصف", kind: "textarea" },
      ACTIVE_FIELD,
    ],
  },
  {
    key: "lesson-slots",
    path: PATHS.academicSlots,
    api: "/settings/lesson-slots",
    label: "حصص التوقيت",
    singular: "حصة",
    desc: "أوقات الحصص لكل سنة — لكلّ أستاذٍ أوقاتُه، وتتداخل بلا مانع فيدرّس اثنان في 08:00.",
    icon: Clock,
    tone: "#93c5fd",
    permission: "lesson-slot",
    filters: [
      { key: "academicYearId", label: "السنة الدراسية", refPath: "/settings/academic-years" },
      {
        key: "teacherId",
        label: "الأستاذ",
        refPath: "/teachers",
        refLabel: ["lastName", "firstName"],
      },
    ],
    columns: [
      { key: "order", label: "#", align: "center" },
      { key: "name", label: "الاسم" },
      { key: "teacher", label: "الأستاذ", path: "teacher", kind: "person", emptyLabel: "عامّة" },
      { key: "academicYear.name", label: "السنة الدراسية", path: "academicYear.name" },
      { key: "startTime", label: "من", kind: "time", align: "center" },
      { key: "endTime", label: "إلى", kind: "time", align: "center" },
      { key: "isActive", label: "الحالة", kind: "badge", align: "center" },
    ],
    fields: [
      {
        key: "academicYearId",
        label: "السنة الدراسية",
        kind: "reference",
        required: true,
        refPath: "/settings/academic-years",
        createOnly: true,
        hint: "عدد الحصص سياسةُ سنةٍ بعينها ولا تُنقل إلى غيرها",
      },
      { key: "name", label: "الاسم", kind: "text", required: true, hint: "مثال: الحصة الأولى" },
      /*
        الأستاذ تحت الاسم مباشرةً — لا في آخر النموذج.

        الاسم وحده لا يميّز: «الحصة الأولى» تتكرّر عند كل أستاذ بوقتٍ
        مختلف، فمن يقرأ الاسم يسأل «حصةُ من؟» قبل الوقت. والسؤال يُجاب
        حيث يُطرح.
      */
      {
        key: "teacherId",
        label: "الأستاذ",
        kind: "reference",
        refPath: "/teachers",
        refLabel: ["lastName", "firstName"],
        emptyOption: "عامّة — بلا أستاذ",
        hint: "اتركه فارغاً لفترةٍ عامّة تصلح لكل الأساتذة. والفترات تتداخل بلا مانع — التعارض يُفحص في الجدول الأسبوعي حيث لكل درسٍ يومُه",
      },
      { key: "startTime", label: "من", kind: "time", required: true },
      { key: "endTime", label: "إلى", kind: "time", required: true },
      { key: "order", label: "الترتيب", kind: "number", min: 0, hint: "يُحسب تلقائياً إن تُرك فارغاً — وهو ترتيبٌ داخل أوقات صاحب الفترة" },
      ACTIVE_FIELD,
    ],
  },
];

const GROUP_TYPE_OPTIONS = [
  { value: "NORMAL", label: "عادي" },
  { value: "ELITE", label: "نخبة" },
  { value: "INTENSIVE", label: "مكثّف" },
  { value: "EVENING", label: "مسائي" },
];

/**
 * موارد **المالية** — لا الإعدادات.
 *
 * حقوق الاشتراك كانت بين القاعات وأوقات الحصص، وهذا خلطٌ بين وصف
 * البنية الدراسية ووصف المال. فمن يفتح الإعدادات يريد أفواجاً
 * ومستويات، ومن يفتح المالية يريد أسعاراً ونسباً.
 *
 * والمسار وحده تغيّر: نفس الـ API ونفس البيانات ونفس الصلاحيات.
 */
// --------------------------------------------------
// شرح سياسة التخليص
//
// السياسة مصدرُ القاعدة، فهي أولى الشاشات بأن تشرح نفسها: من كتب فيها
// «75» ثم رأى «140.625» في الكشف يحتاج أن يعرف أين ذهبت السبعون وكيف
// دخلت الخمس. والشرح بالقيم المكتوبة الآن لا بمثالٍ عام — والقيم التي
// تأتي من خارج السياسة تُسمّى باسمها ومكانها لا برقمٍ مفترض.
// --------------------------------------------------

const shown = (form: Record<string, unknown>, key: string, suffix = ""): string => {
  const raw = form[key];

  return raw === null || raw === undefined || raw === ""
    ? "…"
    : `${String(raw)}${suffix}`;
};

const COUNT_BASIS_NOTE: Record<string, string> = {
  ENROLLED:
    "أساس العدّ «المسجَّلون»: يدخل الحسابَ كلُّ مسجَّلٍ نشط ولو كان مخلَّفاً — فتتحمّل المؤسسةُ تأخّر الطالب لا الأستاذ.",
  PAID: "أساس العدّ «الذين دفعوا»: حضور المخلَّف لا يدخل الحساب حتى يسدِّد — فيتحمّل الأستاذُ تأخّر الطالب.",
  PRESENT: "أساس العدّ «الحاضرون»: يُحتسب من حضر فعلاً بصرف النظر عن حالته المالية.",
};

const explainSettlementPolicy = (
  form: Record<string, unknown>,
): ExplainSpec | null => {
  const method = String(form.method ?? "");

  /* قبل اختيار الطريقة: تعريفٌ بالأربع كي يُختار عن علم لا بالتجربة */
  if (!method) {
    return {
      intro:
        "السياسة هي القاعدة التي يحسب بها النظامُ مستحقَّ الأستاذ. اختر طريقة الحساب أوّلاً — وعندها يظهر هنا شرحُ المعادلة وحسابٌ كامل بأرقام.",
      notes: [
        "نسبة من حقوق الطلبة: عدد الطلبة المحتسبين × الحقّ الشهري × النسبة. لا يتبع الحضور.",
        "مبلغ ثابت لكل طالب: مبلغٌ تكتبه أنت × عدد الطلبة المحتسبين.",
        "مبلغ ثابت لكل حصة: مبلغٌ تكتبه أنت × عدد الحصص المنجزة. لا علاقة له بالطلبة.",
        "نصيب من كل حضور فعلي: يقسم الحقّ الشهري على الحصص المعتمدة ويضرب في حضور الطلبة المحتسبين — وهي طريقة ورقة المؤسسة.",
      ],
    };
  }

  const pct = shown(form, "teacherPercentage", "%");
  const basis = String(form.countBasis ?? "ENROLLED");

  const rounding = `التقريب ${
    { ROUND: "لأقرب قيمة", ROUND_UP: "إلى الأعلى", ROUND_DOWN: "إلى الأدنى" }[
      String(form.roundingMode ?? "ROUND")
    ] ?? "لأقرب قيمة"
  } بـ${shown(form, "roundingPrecision")} منزلة — ويُحمَّل فرقُ التقريب على السطر الأخير فيطابق مجموعُ العمود الخانةَ السفلى.`;

  /** مصادرُ الأرقام التي لا تُكتب في هذه الشاشة */
  const SOURCES =
    "«الحقّ الشهري» يأتي من المالية ← حقوق الاشتراك حسب نطاق الفوج، و«الحصص المعتمدة» لقطةٌ محفوظة في الكشف نفسه، و«المحتسبون» يحدّدهم أساسُ العدّ. لا يُكتب أيٌّ منها هنا.";

  switch (method) {
    case "PERCENTAGE":
      return {
        intro:
          "تأخذ المؤسسةُ حقوقَ الطلبة المحتسبين كاملةً، ويأخذ الأستاذ منها نسبةً مئوية. لا يتغيّر المبلغ بعدد الحصص التي حضرها الطالب.",
        uses: ["نسبة الأستاذ", "أساس عدّ الطلبة"],
        formula: [
          "الأساس   = عدد الطلبة المحتسبين × الحقّ الشهري",
          `المستحقّ = الأساس × ${pct}`,
        ],
        example: {
          label: "مثالٌ للتوضيح — 9 محتسبين وحقٌّ شهري 1500 ونسبة 75%",
          lines: ["الأساس   = 9 × 1500 = 13,500.00", "المستحقّ = 13,500 × 75% = 10,125.00"],
        },
        notes: [
          "الطالب المحتسب يُحسب حقُّه كاملاً ولو حضر حصةً واحدة من ثمانٍ.",
          COUNT_BASIS_NOTE[basis]!,
          SOURCES,
          rounding,
        ],
      };

    case "PER_STUDENT":
      return {
        intro:
          "مبلغٌ ثابت يُدفع للأستاذ عن كل طالب محتسب، لا علاقة له بالحقّ الشهري ولا بعدد الحصص.",
        uses: ["المبلغ لكل طالب", "أساس عدّ الطلبة"],
        formula: [
          `المستحقّ = ${shown(form, "amountPerStudent")} × عدد الطلبة المحتسبين`,
        ],
        example: {
          label: "مثالٌ للتوضيح — 500.00 لكل طالب و12 محتسباً",
          lines: ["المستحقّ = 500.00 × 12 = 6,000.00"],
        },
        notes: [
          "لا يتبع الحضور ولا عدد الحصص — فوجٌ دُرِّست له حصّتان كفوجٍ دُرِّست له عشر.",
          COUNT_BASIS_NOTE[basis]!,
          rounding,
        ],
      };

    case "PER_SESSION":
      return {
        intro:
          "مبلغٌ ثابت عن كل حصةٍ أُنجزت، مهما كان عدد الطلبة فيها. أشبهُ بأجرِ ساعةٍ منه بنسبةٍ من الحقوق.",
        uses: ["المبلغ لكل حصة"],
        formula: [
          `المستحقّ = ${shown(form, "amountPerSession")} × عدد الحصص المنجزة`,
        ],
        example: {
          label: "مثالٌ للتوضيح — 1200.00 للحصة و8 حصص منجزة",
          lines: ["المستحقّ = 1200.00 × 8 = 9,600.00"],
        },
        notes: [
          "حصةٌ حضرها ثلاثةٌ كحصةٍ حضرها ثلاثون — المبلغ واحد.",
          "وأساسُ العدّ لا يُقرأ في هذه الطريقة أصلاً، ولذلك لا يظهر حقلُه.",
          "والحصة لا تُحتسب حتى تصير «منجزة»، أي حتى يُدوَّن حضور كل مسجَّل فيها.",
          rounding,
        ],
      };

    case "PER_ATTENDED_SHARE":
      return {
        intro:
          "يُقسَم الحقّ الشهري على الحصص المعتمدة فتخرج قيمةُ الحصة الواحدة للمؤسسة، ويأخذ الأستاذ منها نسبتَه عن كل حضورٍ فعليّ. فمن غاب لم يُحتسب له، ومن حضر احتُسب. وهي طريقة ورقة المؤسسة.",
        uses: ["نسبة الأستاذ", "أساس عدّ الطلبة"],
        formula: [
          "قيمة الحصة للمؤسسة = الحقّ الشهري ÷ الحصص المعتمدة",
          `قيمة الوحدة        = قيمة الحصة للمؤسسة × ${pct}`,
          "المستحقّ           = قيمة الوحدة × مجموع حضور المحتسبين",
        ],
        example: {
          label:
            "مثالٌ للتوضيح — حقٌّ شهري 1500 و8 حصص معتمدة ونسبة 75%، وسبعةٌ حضروا 8 حصص واثنان حضرا 3",
          lines: [
            "قيمة الحصة للمؤسسة = 1500 ÷ 8 = 187.50",
            "قيمة الوحدة        = 187.50 × 75% = 140.625",
            "مجموع الحضور       = (7 × 8) + (2 × 3) = 62",
            "المستحقّ           = 140.625 × 62 = 8,718.75",
          ],
        },
        notes: [
          "قيمة الوحدة تُحفظ بأربع منازل ولا تُقرَّب إلّا بعد ضربها في الحضور — فتقريبُها إلى 140.63 كان يزيد المستحقّ نصفَ دينار.",
          COUNT_BASIS_NOTE[basis]!,
          SOURCES,
          rounding,
        ],
      };

    default:
      return null;
  }
};

export const FINANCE_RESOURCES: ResourceSpec[] = [
  {
    key: "tuition-fees",
    path: PATHS.financeFees,
    api: "/settings/tuition-fees",
    label: "حقوق الاشتراك",
    singular: "حقّ اشتراك",
    desc: "سعر كل مادة في سنةٍ دراسية — لفوج أو مستوى أو طور أو نوعية.",
    icon: BadgeDollarSign,
    tone: "#86efac",
    permission: "tuition-fee",
    filters: [
      {
        key: "academicYearId",
        label: "السنة الدراسية",
        refPath: "/settings/academic-years",
      },
      { key: "subjectId", label: "المادة", refPath: "/settings/subjects" },
      { key: "studyGroupId", label: "الفوج", refPath: "/settings/study-groups" },
      { key: "levelId", label: "المستوى", refPath: "/settings/levels" },
    ],
    columns: [
      { key: "academicYear.name", label: "السنة", path: "academicYear.name" },
      { key: "subject.name", label: "المادة", path: "subject.name" },
      { key: "scope", label: "النطاق" },
      { key: "specificity", label: "الأولوية", align: "center" },
      { key: "amount", label: "المبلغ", kind: "money" },
      { key: "isActive", label: "الحالة", kind: "badge", align: "center" },
    ],
    fields: [
      {
        key: "academicYearId",
        label: "السنة الدراسية",
        kind: "reference",
        required: true,
        refPath: "/settings/academic-years",
        hint: "السعر يخصّ سنةً بعينها — والسنة الجديدة تُسعَّر من جديد",
      },
      {
        key: "subjectId",
        label: "المادة",
        kind: "reference",
        required: true,
        refPath: "/settings/subjects",
      },
      {
        key: "studyGroupId",
        label: "الفوج",
        kind: "reference",
        refPath: "/settings/study-groups",
        hint: "الأخصّ — يتقدّم على المستوى والطور",
      },
      {
        key: "levelId",
        label: "المستوى",
        kind: "reference",
        refPath: "/settings/levels",
        hint: "يسعّر كل أفواج المستوى ما لم يُخصَّص فوج",
      },
      {
        key: "educationStageId",
        label: "الطور",
        kind: "reference",
        refPath: "/settings/education-stages",
        hint: "الأعمّ — يسعّر كل أفواج الطور",
      },
      {
        key: "groupType",
        label: "نوعية الفوج",
        kind: "select",
        options: GROUP_TYPE_OPTIONS,
        hint: "تُضيَّق بها المستويات والأطوار — مثلاً «مكثّف» في ثانية ثانوي",
      },
      {
        key: "amount",
        label: "المبلغ الشهري",
        kind: "money",
        required: true,
        min: 1,
        hint: "سعرٌ واحد لكل نطاق في السنة — والنطاقات المختلفة تتعايش",
      },
      ACTIVE_FIELD,
    ],
  },
  {
    key: "settlement-policies",
    path: PATHS.financePolicies,
    api: "/settlement-policies",
    label: "سياسات التخليص",
    singular: "سياسة تخليص",
    desc: "كيف يُحسب مستحقّ الأستاذ — النسبة أو المبلغ، وعلى أيّ أساس.",
    icon: Percent,
    tone: "#fbbf24",
    permission: "settlement-policy",
    filters: [
      {
        key: "academicYearId",
        label: "السنة الدراسية",
        refPath: "/settings/academic-years",
      },
      { key: "teacherId", label: "الأستاذ", refPath: "/teachers" },
    ],
    columns: [
      { key: "name", label: "الاسم" },
      { key: "method", label: "الطريقة", kind: "badge" },
      { key: "scope", label: "النطاق" },
      { key: "specificity", label: "الأولوية", align: "center" },
      { key: "effectiveFrom", label: "من", kind: "date" },
      { key: "isActive", label: "الحالة", kind: "badge", align: "center" },
    ],
    fields: [
      {
        key: "name",
        label: "الاسم",
        kind: "text",
        required: true,
        wide: true,
        hint: "اسمٌ يُميّزها في القائمة — مثال: نسبة المؤسسة 75%",
      },
      {
        key: "academicYearId",
        label: "السنة الدراسية",
        kind: "reference",
        required: true,
        refPath: "/settings/academic-years",
      },
      {
        key: "method",
        label: "طريقة الحساب",
        kind: "select",
        required: true,
        options: [
          {
            value: "PERCENTAGE",
            label: "نسبة من حقوق الطلبة",
            desc: "عدد المحتسبين × الحقّ الشهري × النسبة — لا يتبع الحضور.",
          },
          {
            value: "PER_STUDENT",
            label: "مبلغ ثابت لكل طالب",
            desc: "مبلغٌ تكتبه × عدد المحتسبين — لا يتبع الحضور ولا الحصص.",
          },
          {
            value: "PER_SESSION",
            label: "مبلغ ثابت لكل حصة",
            desc: "مبلغٌ تكتبه × عدد الحصص المنجزة — لا علاقة له بالطلبة.",
          },
          {
            value: "PER_ATTENDED_SHARE",
            label: "نصيب من كل حضور فعلي",
            desc: "الحقّ الشهري ÷ الحصص المعتمدة × النسبة × الحضور — طريقة ورقة المؤسسة.",
          },
        ],
      },
      {
        key: "teacherPercentage",
        label: "نسبة الأستاذ ٪",
        kind: "number",
        min: 0,
        max: 100,
        required: true,
        showIf: (f) =>
          f.method === "PERCENTAGE" || f.method === "PER_ATTENDED_SHARE",
      },
      {
        key: "amountPerStudent",
        label: "المبلغ لكل طالب",
        kind: "money",
        min: 1,
        required: true,
        showIf: (f) => f.method === "PER_STUDENT",
      },
      {
        key: "amountPerSession",
        label: "المبلغ لكل حصة",
        kind: "money",
        min: 1,
        required: true,
        showIf: (f) => f.method === "PER_SESSION",
      },
      {
        key: "countBasis",
        label: "أساس عدّ الطلبة",
        kind: "select",
        options: [
          {
            value: "ENROLLED",
            label: "المسجَّلون في الفوج",
            desc: "يدخل الحسابَ كلُّ مسجَّلٍ نشط ولو كان مخلَّفاً — فتتحمّل المؤسسةُ تأخّر الطالب.",
          },
          {
            value: "PAID",
            label: "الذين دفعوا فعلاً",
            desc: "من سُدِّدت فاتورتُه وحده — فيتحمّل الأستاذُ تأخّر الطالب حتى يسدِّد.",
          },
          {
            value: "PRESENT",
            label: "الحاضرون",
            desc: "من حضر فعلاً بصرف النظر عن حالته المالية.",
          },
        ],
        // «مبلغ ثابت لكل حصة» لا يقرأ عدد الطلبة أصلاً
        showIf: (f) => f.method !== "PER_SESSION",
        hint: "لا يحكم من يظهر في كشف الحضور — الكشف يعرض كلَّ مسجَّل. يحكم من يدخل الحساب وحده.",
      },
      {
        key: "roundingMode",
        label: "التقريب",
        kind: "select",
        options: [
          { value: "ROUND", label: "لأقرب قيمة", desc: "النصف فأكثر يُرفع — التقريب المعتاد." },
          { value: "ROUND_UP", label: "إلى الأعلى", desc: "أيُّ كسرٍ يُرفع: 140.01 تصير 141." },
          { value: "ROUND_DOWN", label: "إلى الأدنى", desc: "الكسر يُهمل: 140.99 تصير 140." },
        ],
      },
      {
        key: "roundingPrecision",
        label: "المنازل العشرية",
        kind: "number",
        min: 0,
        max: 4,
        hint: "منزلتان للدينار والسنتيم — والصفر يجعل المبالغ صحيحة بلا كسور",
      },
      {
        key: "subjectId",
        label: "خاصّة بمادة",
        kind: "reference",
        refPath: "/settings/subjects",
        hint: "اتركه فارغاً لتشمل كل المواد",
      },
      {
        key: "studyGroupId",
        label: "خاصّة بفوج",
        kind: "reference",
        refPath: "/settings/study-groups",
        /*
         * المستوى قبل الاسم — لأنّ أسماء الأفواج تتكرّر بين المستويات.
         * «الفوج 1» في أولى متوسط و«الفوج 1» في أولى ثانوي و«فوج الاول»
         * في المستوى نفسه: ثلاثةُ خياراتٍ لا يُفرَّق بينها في القائمة،
         * واختيارُ الخطأ منها يجعل السياسة لا تنطبق على شيء بلا رسالة.
         */
        refLabel: ["level.name", "name"],
        hint: "اتركه فارغاً لتشمل كل الأفواج",
      },
      {
        key: "teacherId",
        label: "خاصّة بأستاذ",
        kind: "reference",
        refPath: "/teachers",
        hint: "الأخصّ — يتقدّم على الفوج والمادة",
      },
      {
        key: "effectiveFrom",
        label: "ساري من",
        kind: "date",
        required: true,
        hint: "يجب أن يسبق تاريخ أوّل حصةٍ في الكشف — وإلّا لم تُطبَّق السياسة عليه",
      },
      { key: "effectiveTo", label: "ساري إلى", kind: "date" },
      ACTIVE_FIELD,
    ],
    explain: explainSettlementPolicy,
  },
];

/**
 * موارد **الإدارة** — الحسابات لا البنية الدراسية ولا المال.
 *
 * محلُّها الإعدادات لا بطاقةٌ على الرئيسية: إنشاء الحسابات تهيئةٌ
 * تُفعل مرّةً عند التنصيب ثم نادراً، لا عملٌ يومي يستحقّ واجهةً في
 * الصف الأول.
 */
export const ADMIN_RESOURCES: ResourceSpec[] = [
  {
    key: "users",
    path: PATHS.settingsUsers,
    api: "/users",
    label: "المستخدمون",
    singular: "مستخدم",
    desc: "حسابات العاملين ودورُ كلٍّ منهم.",
    icon: UserCog,
    tone: "#fda4af",
    permission: "user",
    filters: [{ key: "roleId", label: "الدور", refPath: "/roles" }],
    columns: [
      { key: "avatar", label: "", kind: "avatar" },
      { key: "username", label: "اسم المستخدم" },
      { key: "firstName", label: "الاسم" },
      { key: "lastName", label: "اللقب" },
      { key: "role.name", label: "الدور", path: "role.name", kind: "badge" },
      { key: "phone", label: "الهاتف" },
      { key: "isActive", label: "الحالة", kind: "badge", align: "center" },
    ],
    fields: [
      {
        key: "username",
        label: "اسم المستخدم",
        kind: "text",
        required: true,
        createOnly: true,
        hint: "حروف لاتينية وأرقام ونقطة وشرطة — لا يُغيَّر بعد الإنشاء",
      },
      {
        key: "password",
        label: "كلمة المرور",
        kind: "password",
        required: true,
        hint: "ثمانية محارف فأكثر — اتركها فارغة عند التعديل لإبقائها",
      },
      { key: "firstName", label: "الاسم", kind: "text", required: true },
      { key: "lastName", label: "اللقب", kind: "text", required: true },
      {
        key: "gender",
        label: "الجنس",
        kind: "select",
        required: true,
        options: [
          { value: "MALE", label: "ذكر" },
          { value: "FEMALE", label: "أنثى" },
        ],
        hint: "منه يُرسم الأفاتار الافتراضي حين لا صورة للحساب",
      },
      {
        key: "roleId",
        label: "الدور",
        kind: "reference",
        required: true,
        refPath: "/roles",
        hint: "الصلاحيات تأتي من الدور — تُضبط في شاشة الأدوار",
      },
      { key: "email", label: "البريد", kind: "text" },
      { key: "phone", label: "الهاتف", kind: "text" },
      ACTIVE_FIELD,
    ],
  },
];

export const ALL_RESOURCES = [
  ...RESOURCES,
  ...FINANCE_RESOURCES,
  ...ADMIN_RESOURCES,
];

/**
 * المحور الذي يعود إليه زرّ الرجوع.
 *
 * كان `ResourceScreen` يعود إلى الإعدادات دائماً — وهو ما كان صحيحاً
 * يوم كانت كل الموارد تحتها. ثمّ انتقلت سبعةٌ إلى البنية الدراسية
 * واثنتان إلى المالية، فصار تسعةٌ من عشرة تُخرج المستخدم إلى محورٍ لم
 * يأتِ منه.
 *
 * والاشتقاق من المسار لا حقلٌ يُكتب: المورد الذي يُنقل غداً إلى محورٍ
 * آخر يتبعه زرُّه بلا تعديل، فلا يعود التناقض ممكناً أصلاً.
 */
export const hubOf = (spec: ResourceSpec): string => {
  if (spec.path.startsWith(PATHS.academic)) return PATHS.academic;
  if (spec.path.startsWith(PATHS.finance)) return PATHS.finance;

  return PATHS.settings;
};

export const resourceByKey = (key: string) =>
  ALL_RESOURCES.find((r) => r.key === key) ?? null;
