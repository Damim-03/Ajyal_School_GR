// ======================================================
// سجلُّ الشاشات — مرآةُ `reports.registry.ts` في الخادم
//
// العناوينُ والأوصافُ مكرّرةٌ هنا عمداً لا سهواً: الشاشةُ تحتاجها
// قبل أن يصل ردُّ الخادم — في الترويسة وفي القائمة الجانبية — فلو
// انتظرَتها لظهر عنوانٌ فارغ عند كلّ تنقّل.
//
// ومركزُ التصدير يقرأ القائمةَ من الخادم مصفّاةً بالصلاحيات، فما
// هنا للعرض الفوري وما هناك للحقيقة.
// ======================================================

export type ReportGroupKey =
  | "overview"
  | "academic"
  | "financial"
  | "teacher"
  | "audit";

export interface ReportScreen {
  key: string;
  title: string;
  description: string;
  group: ReportGroupKey;
  /** ترتيبٌ مقصود لبطاقات المؤشّرات */
  metricOrder?: string[];
  emphasis?: string[];
  chartHeight?: number;
}

export const GROUPS: { key: ReportGroupKey; title: string }[] = [
  { key: "overview", title: "نظرة العموم" },
  { key: "academic", title: "الأكاديمي" },
  { key: "financial", title: "المالي" },
  { key: "teacher", title: "الأساتذة" },
  { key: "audit", title: "المراجعة" },
];

export const SCREENS: ReportScreen[] = [
  {
    key: "overview",
    title: "نظرة العموم",
    description:
      "صورة المؤسسة في لمحة: الطلبة والحضور والمال والمستحقّات.",
    group: "overview",
  },

  // --------------------------------------------------
  // الأكاديمي
  // --------------------------------------------------
  {
    key: "students",
    title: "الطلبة",
    description: "التوزيع والحضور والوضع المالي لكل طالب.",
    group: "academic",
    metricOrder: [
      "totalStudents",
      "activeStudents",
      "studentsInDebt",
      "attendanceRate",
    ],
    emphasis: ["totalStudents"],
  },
  {
    key: "attendance",
    title: "الحضور",
    description: "سجلّات الحضور مفصّلة بالطالب والمادة والحصّة.",
    group: "academic",
    metricOrder: ["attendanceRate", "absenceRate", "lateRate", "excusedRate"],
    emphasis: ["attendanceRate"],
  },
  {
    key: "stages",
    title: "الأطوار التعليمية",
    description: "مقارنة الأطوار: الطلبة والحصص والحضور والإيراد.",
    group: "academic",
    chartHeight: 220,
  },
  {
    key: "levels",
    title: "المستويات",
    description: "مقارنة المستويات داخل الأطوار.",
    group: "academic",
    chartHeight: 260,
  },
  {
    key: "subjects",
    title: "المواد",
    description: "التسجيلات والحضور والإيراد والمتبقّي لكل مادة.",
    group: "academic",
    chartHeight: 300,
  },
  {
    key: "groups",
    title: "الأفواج",
    description: "الطلبة والحصص والحضور والوضع المالي لكل فوج.",
    group: "academic",
    chartHeight: 320,
  },
  {
    key: "assignments",
    title: "الإسنادات التدريسية",
    description: "الرابط التشغيلي بين الأستاذ والمادة والفوج.",
    group: "academic",
    chartHeight: 340,
  },
  {
    key: "sessions",
    title: "الحصص",
    description:
      "المجدولة والمكتملة، وما سُجّل حضوره وما لم يُسجَّل.",
    group: "academic",
    metricOrder: [
      "sessionCount",
      "completedSessions",
      "sessionsWithAttendance",
      "sessionsWithoutAttendance",
    ],
  },

  // --------------------------------------------------
  // المالي
  // --------------------------------------------------
  {
    key: "financial",
    title: "المالي",
    description: "الفوترة والتحصيل والمتبقّي وحركة الشهور.",
    group: "financial",
    metricOrder: ["invoiced", "collected", "outstanding", "collectionRate"],
    emphasis: ["invoiced", "collected"],
  },
  {
    key: "invoices",
    title: "الفواتير",
    description: "الفواتير بحالاتها ومبالغها وما سُدّد منها.",
    group: "financial",
    metricOrder: ["invoiced", "collected", "outstanding", "cancelledInvoices"],
  },
  {
    key: "payments",
    title: "الدفعات",
    description: "دفعات الطلبة بطرقها وإيصالاتها.",
    group: "financial",
    metricOrder: ["collected", "paymentCount", "averagePayment"],
  },
  {
    key: "receipts",
    title: "الإيصالات",
    description: "المطبوع والملغى والمعاد طبعه.",
    group: "financial",
  },
  {
    key: "debts",
    title: "الديون",
    description: "المتبقّي على الطلبة وتعتيقه بحسب فترته الأصلية.",
    group: "financial",
    metricOrder: ["debtTotal", "debtOld", "debtCurrent", "studentsInDebt"],
    emphasis: ["debtTotal"],
  },
  {
    key: "debt-collections",
    title: "تحصيل الديون",
    description: "ما استُرِدّ من ديون فترات ماضية، وحصص الأساتذة منه.",
    group: "financial",
  },

  // --------------------------------------------------
  // الأساتذة
  // --------------------------------------------------
  {
    key: "teachers",
    title: "الأساتذة",
    description: "عبء التدريس والمستحقّ والمدفوع لكل أستاذ.",
    group: "teacher",
    metricOrder: [
      "teacherEntitlement",
      "teacherPaid",
      "teacherOutstanding",
    ],
    emphasis: ["teacherEntitlement"],
    chartHeight: 260,
  },
  {
    key: "settlements",
    title: "التخليص",
    description: "تخليصات الأساتذة بلقطاتها المجمّدة لحظة الحساب.",
    group: "teacher",
    metricOrder: [
      "committedEntitlement",
      "teacherPaid",
      "draftEntitlement",
      "totalSettlements",
    ],
    chartHeight: 260,
  },
  {
    key: "teacher-payments",
    title: "دفعات الأساتذة",
    description: "ما دُفع للأساتذة وما بقي بلا تخصيص.",
    group: "teacher",
    metricOrder: [
      "teacherPaid",
      "teacherPaymentCount",
      "unallocatedTeacherPayment",
    ],
  },
  {
    key: "allocations",
    title: "تخصيصات الدفعات",
    description: "أين ذهب كل دينار من دفعات الأساتذة.",
    group: "teacher",
  },

  // --------------------------------------------------
  // المراجعة
  // --------------------------------------------------
  {
    key: "audit",
    title: "سجلّ التدقيق المالي",
    description: "من غيّر أيّ قيمة، ومتى، ولماذا.",
    group: "audit",
  },
  {
    key: "cancellations",
    title: "الإلغاءات",
    description: "كل ما أُلغي من فواتير ودفعات وإيصالات وتخليصات.",
    group: "audit",
  },
  {
    key: "data-quality",
    title: "جودة البيانات",
    description: "فحوص اتّساق لا تُعدّل شيئاً — تنبّه فقط.",
    group: "audit",
  },
];

export const SCREEN_BY_KEY = new Map(
  SCREENS.map((screen) => [screen.key, screen]),
);
