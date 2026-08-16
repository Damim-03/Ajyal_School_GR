import type { LucideIcon } from "lucide-react";
import {
  GraduationCap,
  Users,
  UserPlus,
  BookOpen,
  CalendarDays,
  CalendarClock,
  ClipboardCheck,
  Receipt,
  Wallet,
  Printer,
  FileBarChart,
  Settings2,
  Layers,
  School,
  BookMarked,
  UserCog,
  ListChecks,
  ArrowRightLeft,
  Shield,
  Building,
  Clock,
  BadgeDollarSign,
  DoorOpen,
  Building2,
  Percent,
} from "lucide-react";

import { PATHS } from "../../routes/paths";

/**
 * سجلّ الأقسام — **مصدر الهويّة الوحيد**.
 *
 * هويّة القسم (لونه وأيقونته وسطره التعريفي) تُشتقّ من هنا لا تُمرَّر:
 * البلاطة في الرئيسية، والبطل عند التركيز، وبيئة الخلفية، وترويسة شاشة
 * العمل — كلّها تقرأ من هذا الملف. لذلك لا يمكن أن تتناقض: تعاين قسم
 * الطلبة بالأزرق فتفتحه فيستقبلك الأزرق نفسه حرفياً.
 *
 * الفرق عن SKK: الأيقونة هنا **مكوّن** (lucide) لا مسار صورة. الفائدة
 * أنّها ترث لون القسم عبر currentColor وتبقى حادّة في كل الأحجام. لو
 * أردت صور PNG لاحقاً فالتغيير سطر واحد لكل قسم — النوع وحده يتبدّل.
 */

export interface Action {
  label: string;
  hint: string;
  icon: LucideIcon;
  to?: string;
  soon?: boolean;
}

export interface Module {
  id: string;
  label: string;
  icon: LucideIcon;
  tagline: string;
  desc: string;
  to?: string;
  soon?: boolean;
  /** تدرّج البلاطة والبطل والترويسة — القيم نفسها في المواضع الثلاثة */
  from: string;
  via: string;
  end: string;
  accent: string;
  glow: string;
  /** اسم ملف الخلفية (بلا امتداد) في assets/wallpapers — اختياري */
  wall?: string;
  actions: Action[];
}

export const MODULES: Module[] = [
  {
    id: "students",
    wall: "students",
    label: "الطلبة",
    icon: GraduationCap,
    tagline: "شؤون الطلبة",
    desc: "سجّل الطلبة الجدد، تابع بياناتهم وأولياء أمورهم، واطّلع على تسجيلاتهم في المواد.",
    to: PATHS.students,
    from: "#1257b0", via: "#0a2f6b", end: "#061024",
    accent: "#7dd3fc", glow: "rgba(125,211,252,0.28)",
    actions: [
      { label: "قائمة الطلبة", hint: "بحث · تصفية", icon: Users, to: PATHS.students },
      { label: "تسجيل طالب", hint: "طالب جديد", icon: UserPlus, to: PATHS.students },
      { label: "إسناد المواد", hint: "عدّة مواد دفعة واحدة", icon: ListChecks, to: PATHS.enrollmentsAssign },
    ],
  },
  {
    id: "enrollments",
    wall: "users",
    label: "إسناد الطلبة",
    icon: UserCog,
    tagline: "كل طالب في فوجه",
    desc: "أسند الطالب إلى مادته عند أستاذها في فوجه، أو انقله بين الأفواج، أو تصفّح فوجاً وافتح ملفّ أيّ طالب فيه.",
    to: PATHS.enrollments,
    from: "#b31646", via: "#6b0d28", end: "#240410",
    accent: "#fda4af", glow: "rgba(253,164,175,0.26)",
    actions: [
      { label: "إسناد طالب", hint: "مادة · أستاذ · فوج", icon: UserPlus, to: PATHS.enrollmentsAssign },
      { label: "نقل بين الأفواج", hint: "تصحيح فوج الطالب", icon: ArrowRightLeft, to: PATHS.enrollmentsTransfer },
      { label: "عرض الطلبة", hint: "الفوج ومَن فيه", icon: ListChecks, to: PATHS.enrollmentsBrowse },
    ],
  },
  {
    id: "teachers",
    wall: "teachers",
    label: "الأساتذة",
    icon: Users,
    tagline: "هيئة التدريس",
    desc: "بيانات الأساتذة وتخصّصاتهم، وإسناد المواد والأفواج لكل أستاذ في السنة الدراسية.",
    to: PATHS.teachers,
    from: "#12938a", via: "#0a544e", end: "#041f1c",
    accent: "#5eead4", glow: "rgba(94,234,212,0.26)",
    actions: [
      { label: "قائمة الأساتذة", hint: "بحث · تخصّص", icon: Users, to: PATHS.teachersList },
      { label: "الإسناد التدريسي", hint: "أستاذ · مادة · فوج", icon: BookMarked, to: PATHS.assignments },
    ],
  },
  {
    id: "schedules",
    wall: "schedules",
    label: "الجداول",
    icon: CalendarDays,
    tagline: "التوقيت الأسبوعي",
    desc: "ابنِ الجدول الأسبوعي بلا تعارض في القاعة أو الأستاذ أو الفوج — والحصص الفعلية بتواريخها تُدوَّن في كشف الحضور.",
    to: PATHS.schedulesWeekly,
    from: "#5145e0", via: "#2e2596", end: "#0e0a2e",
    accent: "#c7d2fe", glow: "rgba(199,210,254,0.26)",
    actions: [
      { label: "الجدول الأسبوعي", hint: "يوم · مجال زمني · قاعة", icon: CalendarDays, to: PATHS.schedulesWeekly },
      { label: "حصص التوقيت", hint: "أوقات كل أستاذ", icon: CalendarClock, to: PATHS.academicSlots },
    ],
  },
  {
    id: "attendance",
    wall: "attendance",
    label: "الحضور",
    icon: ClipboardCheck,
    tagline: "ورقة الحضور",
    desc: "سجّل حضور الفوج كاملاً في حصة واحدة: علّم الغائبين فقط والباقي حاضرون تلقائياً.",
    to: PATHS.attendance,
    from: "#c9640a", via: "#7c3a06", end: "#241202",
    accent: "#fcd34d", glow: "rgba(252,211,77,0.26)",
    actions: [
      { label: "تسجيل الحضور", hint: "الفوج دفعة واحدة", icon: ClipboardCheck, to: PATHS.attendance },
      { label: "سجل الغيابات", hint: "بحث وتصفية", icon: ListChecks, to: PATHS.attendance },
    ],
  },
  {
    id: "finance",
    wall: "finance",
    label: "المالية",
    icon: Receipt,
    tagline: "الحقوق والمدفوعات والتخليص",
    desc: "أسعار المواد وسياسات تخليص الأساتذة، وتوليد الفواتير واستقبال الدفعات وطباعة الإيصالات.",
    to: PATHS.finance,
    from: "#8f1560", via: "#4a0d5f", end: "#160521",
    accent: "#ff8fb1", glow: "rgba(255,143,177,0.30)",
    actions: [
      { label: "الفواتير", hint: "توليد شهري · متأخرات", icon: Receipt, to: PATHS.invoices },
      { label: "المدفوعات", hint: "دفعة تُسدّد عدة فواتير", icon: Wallet, to: PATHS.payments },
      { label: "الإيصالات", hint: "طباعة · إعادة طباعة", icon: Printer, to: PATHS.receipts },
      { label: "حقوق الاشتراك", hint: "السعر ونطاقه في السنة", icon: BadgeDollarSign, to: PATHS.financeFees },
      { label: "سياسات التخليص", hint: "كيف يُحسب مستحقّ الأستاذ", icon: Percent, to: PATHS.financePolicies },
    ],
  },
  {
    id: "reports",
    wall: "reports",
    label: "التقارير",
    icon: FileBarChart,
    tagline: "لوحات وإحصاءات",
    desc: "المحصَّل والمستحقّ ونسب الحضور، مع تفصيل شهري وقائمة من عليهم متأخرات.",
    to: PATHS.reports,
    from: "#1a9247", via: "#0d5228", end: "#05160c",
    accent: "#86efac", glow: "rgba(134,239,172,0.26)",
    actions: [
      { label: "التقرير المالي", hint: "محصَّل · مستحقّ", icon: BadgeDollarSign, to: PATHS.reports },
      { label: "المتأخرات", hint: "مجمَّعة حسب الطالب", icon: Wallet, to: PATHS.reports },
      { label: "تقرير الحضور", hint: "نسب الحضور والغياب", icon: ClipboardCheck, to: PATHS.reports },
    ],
  },
  {
    id: "academic",
    wall: "academic",
    label: "البنية الدراسية",
    icon: Building,
    tagline: "هيكل المؤسسة",
    desc: "السنة الدراسية والأطوار والمستويات والأفواج والمواد والقاعات وحصص التوقيت — كل ما يُبنى في مطلع السنة.",
    to: PATHS.academic,
    from: "#0e7490", via: "#083f4d", end: "#03181e",
    accent: "#67e8f9", glow: "rgba(103,232,249,0.26)",
    actions: [
      { label: "السنة الدراسية", hint: "السنة الجارية", icon: CalendarDays, to: PATHS.academicYears },
      { label: "الأطوار والمستويات", hint: "جذر البنية", icon: Layers, to: PATHS.academicStages },
      { label: "الأفواج", hint: "الطاقة والنوع", icon: School, to: PATHS.academicGroups },
      { label: "المواد", hint: "المواد المدرَّسة", icon: BookOpen, to: PATHS.academicSubjects },
      { label: "القاعات", hint: "السعة والطابق", icon: DoorOpen, to: PATHS.academicClassrooms },
      { label: "حصص التوقيت", hint: "أوقات الحصص اليومية", icon: Clock, to: PATHS.academicSlots },
    ],
  },
  {
    id: "settings",
    wall: "settings",
    label: "الإعدادات",
    icon: Settings2,
    tagline: "المؤسسة والحسابات",
    desc: "هويّة المؤسسة وما يُطبع على مستنداتها، وحسابات العاملين والأدوار التي ترث منها صلاحياتها.",
    to: PATHS.settings,
    from: "#475569", via: "#1e293b", end: "#0a0f1a",
    accent: "#cbd5e1", glow: "rgba(203,213,225,0.22)",
    actions: [
      { label: "هوية المدرسة", hint: "الاسم واللون والمطبوعات", icon: Building2, to: PATHS.settingsSchool },
      { label: "المستخدمون", hint: "حسابات العاملين", icon: UserCog, to: PATHS.settingsUsers },
      { label: "الأدوار والصلاحيات", hint: "ما يستطيعه كل دور", icon: Shield, to: PATHS.settingsRoles },
      { label: "تجربة الطباعة", hint: "ورق وهوامش وعربية", icon: Printer, to: PATHS.settingsPrint },
    ],
  },
];

/**
 * خلفيات الأقسام — تُلتقط تلقائياً من assets/wallpapers حسب اسم الملف،
 * فبمجرّد إضافة ملف باسم القسم يعمل دون تعديل الشيفرة. والغياب مقبول:
 * القسم بلا خلفية يظهر بتدرّجه اللوني وحده.
 */
export const WALLPAPERS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob("../../assets/wallpapers/*.{jpg,jpeg,png,webp}", {
      eager: true,
      query: "?url",
      import: "default",
    }) as Record<string, string>,
  ).map(([path, url]) => [
    path.split("/").pop()!.replace(/\.[^.]+$/, "").toLowerCase(),
    url,
  ]),
);

export const wallpaperOf = (m: Module | null | undefined) =>
  m?.wall ? WALLPAPERS[m.wall] : undefined;

export const moduleById = (id: string | null | undefined) =>
  MODULES.find((m) => m.id === id) ?? null;

/**
 * القسم الذي ينتمي إليه مسارٌ ما.
 *
 * تُطابَق أطول بادئة: ‏`/finance/invoices` تنتمي إلى المالية تماماً كما
 * ينتمي `/finance`. فالغوص أعمق داخل قسم لا يخرجك منه — وهذا شرط أن
 * تبقى البيئة ثابتة وأنت تتنقّل بين شاشاته.
 */
export function moduleOf(pathname: string): Module | null {
  if (pathname === PATHS.home || pathname === "/" || pathname === "") return null;

  let best: Module | null = null;

  for (const m of MODULES) {
    if (!m.to) continue;
    if (pathname === m.to || pathname.startsWith(m.to + "/")) {
      if (!best || m.to.length > (best.to?.length ?? 0)) best = m;
    }
  }

  return best;
}
