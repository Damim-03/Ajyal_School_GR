import type { ReportQuery } from "./reports.filters";
import type { ReportResponse } from "./reports.contract";
import {
  attendanceReportService,
  financialReportService,
  overviewReportService,
  studentsReportService,
  teachersReportService,
} from "./reports.service";
import {
  allocationsReportService,
  auditReportService,
  cancellationsReportService,
  dataQualityReportService,
  debtCollectionsReportService,
  debtsReportService,
  invoicesReportService,
  paymentsReportService,
  receiptsReportService,
  settlementsReportService,
  teacherPaymentsReportService,
} from "./reports.service.finance";
import {
  academicReportService,
  assignmentsReportService,
  groupsReportService,
  levelsReportService,
  sessionsReportService,
  stagesReportService,
  subjectsReportService,
} from "./reports.service.academic";

// ======================================================
// سجلُّ التقارير — §63
//
// مصدرٌ واحد يعرف كلَّ تقرير: مساره، وخدمته، وعنوانه، ومجموعته،
// وهل له جدولٌ يُصدَّر.
//
// وفائدتُه مزدوجة:
//
//   1. **التصديرُ يُشتقّ لا يُكرَّر.** مسارُ التصدير واحدٌ يقرأ
//      المفتاحَ من العنوان ويستدعي الخدمة من هنا. ولولاه لاحتاج
//      كلُّ تقريرٍ مسارَ تصديرٍ خاصّاً — عشرون مساراً إضافياً
//      يتباعد سلوكُها عند أوّل تعديل.
//
//   2. **مركزُ التصدير (§63) يُبنى من بيانات.** الشاشةُ تسأل
//      الخادمَ «ما التقارير المتاحة؟» بدل أن تحمل قائمةً مكتوبةً
//      بيدٍ تتقادم كلَّما أُضيف تقرير.
// ======================================================

export type ReportGroup =
  | "overview"
  | "academic"
  | "financial"
  | "teacher"
  | "audit";

export type ReportEntry = {
  key: string;
  title: string;
  description: string;
  group: ReportGroup;
  /** التقاريرُ بلا جدول تُصدَّر بمؤشّراتها وحدها */
  hasTable: boolean;
  service: (query: ReportQuery) => Promise<ReportResponse>;
};

const entry = (
  key: string,
  title: string,
  description: string,
  group: ReportGroup,
  hasTable: boolean,
  service: (query: ReportQuery) => Promise<ReportResponse>,
): ReportEntry => ({ key, title, description, group, hasTable, service });

export const REPORT_REGISTRY: ReportEntry[] = [
  entry(
    "overview",
    "نظرة العموم",
    "صورة المؤسسة في لمحة: الطلبة والحضور والمال والمستحقّات.",
    "overview",
    false,
    overviewReportService,
  ),

  // --------------------------------------------------
  // الأكاديمي
  // --------------------------------------------------
  entry(
    "students",
    "الطلبة",
    "تحليل الطلبة: التوزيع والحضور والوضع المالي لكلٍّ منهم.",
    "academic",
    true,
    studentsReportService,
  ),
  entry(
    "attendance",
    "الحضور",
    "سجلّات الحضور مفصّلةً بالطالب والمادة والحصّة.",
    "academic",
    true,
    attendanceReportService,
  ),
  entry(
    "academic",
    "الأكاديمي",
    "ملخّص أكاديمي حسب الأطوار التعليمية.",
    "academic",
    true,
    academicReportService,
  ),
  entry(
    "stages",
    "الأطوار التعليمية",
    "مقارنة الأطوار: الطلبة والحصص والحضور والإيراد.",
    "academic",
    true,
    stagesReportService,
  ),
  entry(
    "levels",
    "المستويات",
    "مقارنة المستويات داخل الأطوار.",
    "academic",
    true,
    levelsReportService,
  ),
  entry(
    "subjects",
    "المواد",
    "المواد: التسجيلات والحضور والإيراد والمتبقّي.",
    "academic",
    true,
    subjectsReportService,
  ),
  entry(
    "groups",
    "الأفواج",
    "الأفواج: الطلبة والحصص والحضور والوضع المالي.",
    "academic",
    true,
    groupsReportService,
  ),
  entry(
    "assignments",
    "الإسنادات التدريسية",
    "الرابط التشغيلي بين الأستاذ والمادة والفوج.",
    "academic",
    true,
    assignmentsReportService,
  ),
  entry(
    "sessions",
    "الحصص",
    "الحصص المجدولة والمكتملة، وما سُجّل حضورُه وما لم يُسجَّل.",
    "academic",
    true,
    sessionsReportService,
  ),

  // --------------------------------------------------
  // المالية — جانب الطالب
  // --------------------------------------------------
  entry(
    "financial",
    "المالي",
    "الفوترة والتحصيل والمتبقّي وحركة الشهور.",
    "financial",
    false,
    financialReportService,
  ),
  entry(
    "invoices",
    "الفواتير",
    "الفواتير بحالاتها ومبالغها وما سُدِّد منها.",
    "financial",
    true,
    invoicesReportService,
  ),
  entry(
    "payments",
    "الدفعات",
    "دفعات الطلبة بطرقها وإيصالاتها.",
    "financial",
    true,
    paymentsReportService,
  ),
  entry(
    "receipts",
    "الإيصالات",
    "الإيصالات: المطبوع والملغى والمعاد طبعه.",
    "financial",
    true,
    receiptsReportService,
  ),
  entry(
    "debts",
    "الديون",
    "المتبقّي على الطلبة وتعتيقه بحسب فترته الأصلية.",
    "financial",
    true,
    debtsReportService,
  ),
  entry(
    "debt-collections",
    "تحصيل الديون",
    "ما استُرِدّ من ديون فتراتٍ ماضية، وحصص الأساتذة منه.",
    "financial",
    true,
    debtCollectionsReportService,
  ),

  // --------------------------------------------------
  // المالية — جانب الأستاذ
  // --------------------------------------------------
  entry(
    "teachers",
    "الأساتذة",
    "عبء التدريس والمستحقّ والمدفوع لكلّ أستاذ.",
    "teacher",
    true,
    teachersReportService,
  ),
  entry(
    "settlements",
    "التخليص",
    "تخليصات الأساتذة بلقطاتها المجمَّدة لحظةَ الحساب.",
    "teacher",
    true,
    settlementsReportService,
  ),
  entry(
    "teacher-payments",
    "دفعات الأساتذة",
    "ما دُفع للأساتذة وما بقي بلا تخصيص.",
    "teacher",
    true,
    teacherPaymentsReportService,
  ),
  entry(
    "allocations",
    "تخصيصات الدفعات",
    "أين ذهب كلُّ دينار من دفعات الأساتذة.",
    "teacher",
    true,
    allocationsReportService,
  ),

  // --------------------------------------------------
  // المراجعة
  // --------------------------------------------------
  entry(
    "audit",
    "سجلّ التدقيق المالي",
    "من غيّر أيَّ قيمة، ومتى، ولماذا.",
    "audit",
    true,
    auditReportService,
  ),
  entry(
    "cancellations",
    "الإلغاءات",
    "كلُّ ما أُلغي من فواتير ودفعات وإيصالات وتخليصات.",
    "audit",
    true,
    cancellationsReportService,
  ),
  entry(
    "data-quality",
    "جودة البيانات",
    "فحوص اتّساق لا تُعدّل شيئاً — تنبّه فقط.",
    "audit",
    true,
    dataQualityReportService,
  ),
];

export const REGISTRY_BY_KEY: ReadonlyMap<string, ReportEntry> = new Map(
  REPORT_REGISTRY.map((report) => [report.key, report]),
);

export const GROUP_TITLE: Record<ReportGroup, string> = {
  overview: "نظرة العموم",
  academic: "الأكاديمي",
  financial: "المالي",
  teacher: "الأساتذة",
  audit: "المراجعة",
};
