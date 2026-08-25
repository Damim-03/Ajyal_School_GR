import { MODULES } from "../home/modules";
import { RESOURCES, FINANCE_RESOURCES, ADMIN_RESOURCES } from "../settings/resource.config";
import { SCREENS as REPORT_SCREENS } from "../../modules/reports/reports.catalog";
import { PATHS } from "../../routes/paths";

/**
 * **دليلُ وجهات التطبيق — مشتقٌّ لا مكتوب.**
 *
 * القرارُ الوحيد المهمّ في هذا الملفّ: **لا قائمةَ يدوية**. الشاشاتُ في
 * NexSchool تُعرَّف في أربعة سجلّاتٍ قائمة (‏الأقسام وإجراءاتُها،
 * وموارد البنية الدراسية، وموارد المالية والحسابات، وشاشات التقارير)،
 * وكلُّها تحمل أسماءَها وأوصافَها ومساراتِها أصلاً.
 *
 * ولو كُتب هنا سجلٌّ خامسٌ بأسماء الشاشات لَما بقي صحيحاً أسبوعين: تُضاف
 * شاشةٌ فلا يجدها البحث، ويُعاد تسميةُ أخرى فيبقى الاسمُ القديم — ولا
 * شيء يشتكي، لأنّ «لا نتيجة» تبدو جواباً مشروعاً. وهذا أخبثُ ما في
 * محرّكات البحث الداخلية: تفشل بصمت.
 *
 * فيُقرأ من المصادر نفسِها. وما يُضاف إلى النظام يصير مبحوثاً عنه في
 * اللحظة نفسِها، بلا أن يتذكّر أحدٌ هذا الملفّ.
 *
 * وما لا سجلَّ له (شاشاتُ الكشوف والجداول والمالية التشغيلية) يُكتب في
 * `STANDALONE` أدناه — وهي محروسةٌ باختبارٍ يقارنها بـ`PATHS`، فما يُضاف
 * إلى المسارات ولا يُغطّى هنا يُسقط الاختبار.
 */

export type DestinationKind = "module" | "action" | "resource" | "report" | "screen";

export interface Destination {
  /** مفتاحٌ فريد — يمنع تكرار الوجهة الواحدة من مصدرين. */
  id: string;
  kind: DestinationKind;
  title: string;
  /** سطرٌ ثانٍ: وصفٌ أو تلميح. */
  detail?: string;
  to: string;
  /** القسمُ الذي تنتمي إليه — يُلوَّن به الصفّ ويُجمَّع تحته. */
  moduleId?: string;
  /**
   * كلماتٌ تُطابَق ولا تُعرض.
   *
   * الغرضُ منها أن يجد المستخدمُ الشاشةَ بالكلمة التي في رأسه لا
   * بالكلمة التي كُتبت في الواجهة: من يبحث عن «غياب» يقصد كشفَ الحضور،
   * ومن يكتب «رواتب» يقصد تخليصَ الأساتذة.
   */
  keywords?: string[];
}

/**
 * شاشاتٌ لا سجلَّ لها — تُكتب هنا، ويحرسها اختبارُ التغطية.
 *
 * وهي التشغيلية: الكشوفُ والجداولُ والمالية. لا يجمعها سجلٌّ لأنّ لكلٍّ
 * منها شاشةً مكتوبةً بيدها لا مولَّدةً من مواصفة — بخلاف موارد البنية
 * الدراسية التي تتولّد كلُّها من `ResourceSpec` واحد.
 */
const STANDALONE: Destination[] = [
  {
    id: "screen:attendance-daily",
    kind: "screen",
    title: "كشف الحضور اليومي",
    detail: "حضورُ الفوج يوماً بيوم",
    to: PATHS.attendanceDaily,
    moduleId: "attendance",
    keywords: ["غياب", "حاضر", "تغيب", "ورقة الحضور"],
  },
  {
    id: "screen:attendance-monthly-fees",
    kind: "screen",
    title: "حقوق الشهر",
    detail: "ما استحقّه كلُّ طالبٍ في الشهر",
    to: PATHS.attendanceMonthlyFees,
    moduleId: "attendance",
    keywords: ["اشتراك", "مستحقّ", "شهري"],
  },
  {
    id: "screen:attendance-expected",
    kind: "screen",
    title: "الحقوق المتوقّعة",
    detail: "تقديرُ ما سيُستحقّ",
    to: PATHS.attendanceExpected,
    moduleId: "attendance",
    keywords: ["توقّع", "تقدير"],
  },
  {
    id: "screen:student-account",
    kind: "screen",
    title: "كشف حساب الطالب",
    detail: "سنتُه كاملةً: حضورٌ وحقٌّ وإيصال",
    to: PATHS.attendanceStudentAccount,
    moduleId: "attendance",
    keywords: ["حساب طالب", "رصيد", "متأخّرات"],
  },
  {
    id: "screen:teacher-account",
    kind: "screen",
    title: "كشف حساب الأستاذ",
    detail: "ما استحقّه وما قبضه",
    to: PATHS.attendanceTeacherAccount,
    moduleId: "attendance",
    keywords: ["حساب أستاذ", "مستحقّ الأستاذ"],
  },
  {
    id: "screen:settlement-archive",
    kind: "screen",
    title: "أرشيف التخليص",
    detail: "ما دُفع ولمن وبأيّ ورقة",
    to: PATHS.settlementArchive,
    moduleId: "attendance",
    keywords: ["تخليص", "رواتب", "دفع الأساتذة"],
  },
  {
    id: "screen:schedules-weekly",
    kind: "screen",
    title: "الجدول الأسبوعي",
    detail: "شبكةُ الحصص",
    to: PATHS.schedulesWeekly,
    moduleId: "schedules",
    keywords: ["توقيت", "حصص", "جدول"],
  },
  {
    id: "screen:invoices",
    kind: "screen",
    title: "الفواتير",
    to: PATHS.invoices,
    moduleId: "finance",
    keywords: ["فاتورة"],
  },
  {
    id: "screen:payments",
    kind: "screen",
    title: "المدفوعات",
    detail: "ومنها تُطبع الإيصالات",
    to: PATHS.payments,
    moduleId: "finance",
    keywords: ["دفعة", "إيصال", "قبض"],
  },
  {
    id: "screen:finance-settlements",
    kind: "screen",
    title: "تخليص الأساتذة",
    to: PATHS.financeSettlements,
    moduleId: "finance",
    keywords: ["تخليص", "رواتب"],
  },
  {
    id: "screen:students-list",
    kind: "screen",
    title: "قائمة الطلبة",
    to: PATHS.studentsList,
    moduleId: "students",
  },
  {
    id: "screen:students-files",
    kind: "screen",
    title: "ملفّات الطلبة",
    detail: "الوثائقُ والصور",
    to: PATHS.studentsFiles,
    moduleId: "students",
    keywords: ["وثائق", "مستندات"],
  },
  {
    id: "screen:student-new",
    kind: "screen",
    title: "تسجيل طالب جديد",
    to: PATHS.studentNew,
    moduleId: "students",
    keywords: ["إضافة طالب", "تسجيل"],
  },
  {
    id: "screen:teachers-list",
    kind: "screen",
    title: "قائمة الأساتذة",
    to: PATHS.teachersList,
    moduleId: "teachers",
  },
  {
    id: "screen:assignments",
    kind: "screen",
    title: "إسناد الأساتذة",
    detail: "الأستاذُ إلى الفوج والمادّة",
    to: PATHS.assignments,
    moduleId: "teachers",
  },
  {
    id: "screen:enrollments-assign",
    kind: "screen",
    title: "إسناد الطلبة",
    to: PATHS.enrollmentsAssign,
    moduleId: "enrollments",
  },
  {
    id: "screen:enrollments-transfer",
    kind: "screen",
    title: "نقلُ طالب",
    detail: "من فوجٍ إلى فوج",
    to: PATHS.enrollmentsTransfer,
    moduleId: "enrollments",
    keywords: ["تحويل", "نقل"],
  },
  {
    id: "screen:enrollments-browse",
    kind: "screen",
    title: "تصفّح الإسنادات",
    to: PATHS.enrollmentsBrowse,
    moduleId: "enrollments",
  },
  {
    id: "screen:settings-school",
    kind: "screen",
    title: "هويّة المؤسسة",
    detail: "الاسمُ والشعارُ والألوان",
    to: PATHS.settingsSchool,
    moduleId: "settings",
    keywords: ["شعار", "اسم المدرسة", "هوية"],
  },
  {
    id: "screen:settings-print",
    kind: "screen",
    title: "تجربة الطباعة",
    to: PATHS.settingsPrint,
    moduleId: "settings",
    keywords: ["طابعة", "طباعة"],
  },
  {
    id: "screen:settings-maintenance",
    kind: "screen",
    title: "النسخ الاحتياطي والصيانة",
    detail: "نسخٌ واستعادةٌ وإعادةُ تهيئة",
    to: PATHS.settingsMaintenance,
    moduleId: "settings",
    keywords: ["نسخة", "استعادة", "backup", "تهيئة"],
  },
  {
    id: "screen:settings-roles",
    kind: "screen",
    title: "الأدوار والصلاحيات",
    to: PATHS.settingsRoles,
    moduleId: "settings",
    keywords: ["صلاحية", "دور", "أذونات"],
  },
  {
    id: "screen:welcome",
    kind: "screen",
    title: "ابنِ مؤسستك",
    detail: "لوحةُ ما بعد التهيئة",
    to: PATHS.welcome,
    moduleId: "settings",
    keywords: ["بداية", "onboarding"],
  },
];

/** الوجهاتُ كلُّها — تُبنى مرّةً عند تحميل الوحدة. */
export const DESTINATIONS: Destination[] = buildDestinations();

function buildDestinations(): Destination[] {
  const out: Destination[] = [];
  /* المسارُ الواحد يظهر مرّةً: «قائمة الطلبة» إجراءٌ في القسم وشاشةٌ هنا. */
  const seen = new Set<string>();

  const push = (d: Destination) => {
    const key = `${d.to}|${d.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(d);
  };

  /* ① الأقسامُ نفسُها */
  for (const m of MODULES) {
    if (m.to) {
      push({
        id: `module:${m.id}`,
        kind: "module",
        title: m.label,
        detail: m.tagline,
        to: m.to,
        moduleId: m.id,
      });
    }

    /* ② وإجراءاتُها — أسرعُ طريقٍ إلى ما يُفعل داخلها */
    for (const a of m.actions) {
      if (!a.to || a.soon) continue;

      push({
        id: `action:${m.id}:${a.label}`,
        kind: "action",
        title: a.label,
        detail: a.hint,
        to: a.to,
        moduleId: m.id,
      });
    }
  }

  /* ③ الموارد — البنيةُ الدراسية والمالية والحسابات */
  const resourceModule: Record<string, string> = {
    finance: "finance",
    admin: "settings",
    academic: "academic",
  };

  for (const [group, list] of [
    ["academic", RESOURCES],
    ["finance", FINANCE_RESOURCES],
    ["admin", ADMIN_RESOURCES],
  ] as const) {
    for (const r of list) {
      push({
        id: `resource:${r.key}`,
        kind: "resource",
        title: r.label,
        detail: r.desc,
        to: r.path,
        moduleId: resourceModule[group],
        keywords: [r.singular],
      });
    }
  }

  /* ④ شاشاتُ التقارير */
  for (const s of REPORT_SCREENS) {
    push({
      id: `report:${s.key}`,
      kind: "report",
      title: `تقرير: ${s.title}`,
      detail: s.description,
      to: `/reports/${s.key}`,
      moduleId: "reports",
      keywords: [s.title, "تقرير", "كشف"],
    });
  }

  /* ⑤ وما لا سجلَّ له */
  for (const s of STANDALONE) push(s);

  return out;
}
