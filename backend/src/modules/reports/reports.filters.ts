import { z } from "zod";

// ======================================================
// الفلاتر العامّة — §4
//
// شريطٌ واحد أعلى كلّ شاشات التقارير. لكنّ الفلتر الذي يفهمه تقريرٌ
// لا يفهمه آخر: «طريقة الدفع» بلا معنى في تقرير الحضور، و«حالة
// الحضور» بلا معنى في تقرير الفواتير.
//
// والمعالجةُ الساذجة أن تُمرَّر كلُّ الفلاتر إلى كلّ تقرير ويتجاهل
// كلٌّ ما لا يعنيه. وأثرُها أنّ المستخدم يضبط فلتراً ويرى الرقمَ
// لا يتغيّر — فيظنّ البيانات خاطئة، والفلترُ لم يُقرأ أصلاً.
//
// فكلُّ تقريرٍ يعلن قدراته هنا صراحةً، والاستجابةُ تُرجعها في
// `meta.supportedFilters` لتُعطّل الواجهةُ ما لا يُدعم بدل أن تعرضه
// معطوباً صامتاً.
// ======================================================

const id = () => z.string().trim().min(1);

// --------------------------------------------------
// الفلاتر الأساسية — تُعرض دائماً
// --------------------------------------------------

export const primaryFilterSchema = z.object({
  academicYearId: id().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// --------------------------------------------------
// الفلاتر المتقدّمة — خلف «مزيد»
// --------------------------------------------------

export const advancedFilterSchema = z.object({
  educationStageId: id().optional(),
  levelId: id().optional(),
  studyGroupId: id().optional(),
  subjectId: id().optional(),
  teacherId: id().optional(),
  studentId: id().optional(),
  invoiceStatus: z.enum(["PENDING", "PARTIAL", "PAID", "CANCELLED"]).optional(),
  paymentStatus: z.enum(["ACTIVE", "CANCELLED"]).optional(),
  settlementStatus: z
    .enum(["DRAFT", "CONFIRMED", "PAID", "CANCELLED"])
    .optional(),
  attendanceStatus: z
    .enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"])
    .optional(),
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER"]).optional(),
});

// --------------------------------------------------
// العرض والمقارنة
// --------------------------------------------------

export const presentationSchema = z.object({
  comparison: z
    .enum(["none", "previousMonth", "sameMonthLastYear", "previousPeriod"])
    .default("none"),
  page: z.coerce.number().int().min(1).default(1),
  /*
   * سقفُ الصفحة 200 — §41 يمنع إرسال آلاف الصفوف دفعةً واحدة.
   * والسقفُ في المخطّط لا في الخدمة، فلا يمكن تجاوزُه بمعامل
   * استعلامٍ مصنوع يدوياً (§67).
   */
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  sortBy: z.string().trim().min(1).max(64).optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const reportQuerySchema = primaryFilterSchema
  .extend(advancedFilterSchema.shape)
  .extend(presentationSchema.shape)
  .refine(
    (query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo,
    {
      message: "dateFrom must not be after dateTo",
      path: ["dateFrom"],
    },
  )
  .refine(
    /*
     * الشهرُ بلا سنةٍ غامض: «سبتمبر» أيُّ سبتمبر؟ ولو أكملناه
     * بالسنة الجارية صامتين، لعرضنا سبتمبر 2026 لمن قصد 2025 —
     * والرقمُ يبدو سليماً. فالرفضُ أوضح من التخمين.
     */
    (query) => query.month === undefined || query.year !== undefined,
    { message: "month requires year", path: ["month"] },
  );

export type ReportQuery = z.infer<typeof reportQuerySchema>;

/**
 * استعلامُ التصدير — §42.
 *
 * نفسُ فلاتر التقرير زائدَ الصيغةِ واختيارِ الأعمدة، فالملفُّ يحترم
 * ما تراه الشاشةُ حرفياً: الفترة والفلاتر والفرز والأعمدة.
 *
 * و`pageSize` يبلغ هنا خمسةَ آلاف لا مئتين: الشاشةُ تُرقَّم لأنّ
 * العينَ لا تقرأ ألفَ صفّ، والملفُّ يُفتح في Excel الذي يقرؤها.
 * وتصديرُ خمسين صفّاً من أصل ألف هو أسوأُ ما يمكن أن يفعله زرُّ
 * «تصدير» — يبدو ناجحاً ويُخرج عُشرَ البيانات.
 */
export const exportQuerySchema = primaryFilterSchema
  .extend(advancedFilterSchema.shape)
  .extend({
    comparison: presentationSchema.shape.comparison,
    sortBy: presentationSchema.shape.sortBy,
    sortDir: presentationSchema.shape.sortDir,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(5000).default(5000),
    format: z.enum(["csv", "xlsx"]).default("xlsx"),
    columns: z.string().trim().max(1024).optional(),
  })
  .refine(
    (query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo,
    { message: "dateFrom must not be after dateTo", path: ["dateFrom"] },
  )
  .refine((query) => query.month === undefined || query.year !== undefined, {
    message: "month requires year",
    path: ["month"],
  });

export type ExportQuery = z.infer<typeof exportQuerySchema>;

export type FilterKey =
  | keyof z.infer<typeof primaryFilterSchema>
  | keyof z.infer<typeof advancedFilterSchema>;

// ======================================================
// قدراتُ التقرير
// ======================================================

export type ReportCapability = {
  report: string;
  supports: FilterKey[];
  /** أوضاعُ المقارنة المعقولة لهذا التقرير */
  comparisons: ("previousMonth" | "sameMonthLastYear" | "previousPeriod")[];
};

const ACADEMIC_SCOPE: FilterKey[] = [
  "academicYearId",
  "educationStageId",
  "levelId",
  "studyGroupId",
  "subjectId",
  "teacherId",
];

const PERIOD_SCOPE: FilterKey[] = ["month", "year", "dateFrom", "dateTo"];

/**
 * سجلُّ القدرات.
 *
 * جدولٌ صريح لا اشتقاقٌ ذكيّ: مَن يضيف تقريراً يُصرّح بما يدعمه،
 * ومَن يراجع يقرأ سطراً واحداً ليعرف لماذا لا يؤثّر فلترٌ في شاشة.
 */
export const REPORT_CAPABILITIES: Record<string, ReportCapability> = {
  overview: {
    report: "overview",
    supports: [...PERIOD_SCOPE, "academicYearId", "educationStageId", "levelId"],
    comparisons: ["previousMonth", "sameMonthLastYear", "previousPeriod"],
  },
  students: {
    report: "students",
    supports: [...PERIOD_SCOPE, ...ACADEMIC_SCOPE, "studentId"],
    comparisons: ["previousMonth", "sameMonthLastYear"],
  },
  attendance: {
    report: "attendance",
    supports: [...PERIOD_SCOPE, ...ACADEMIC_SCOPE, "studentId", "attendanceStatus"],
    comparisons: ["previousMonth", "sameMonthLastYear", "previousPeriod"],
  },
  financial: {
    report: "financial",
    supports: [
      ...PERIOD_SCOPE,
      ...ACADEMIC_SCOPE,
      "studentId",
      "invoiceStatus",
      "paymentMethod",
    ],
    comparisons: ["previousMonth", "sameMonthLastYear", "previousPeriod"],
  },
  debts: {
    report: "debts",
    supports: [...PERIOD_SCOPE, ...ACADEMIC_SCOPE, "studentId"],
    comparisons: ["previousMonth", "sameMonthLastYear"],
  },
  teachers: {
    report: "teachers",
    supports: [...PERIOD_SCOPE, "academicYearId", "subjectId", "teacherId"],
    comparisons: ["previousMonth", "sameMonthLastYear"],
  },
  settlements: {
    report: "settlements",
    supports: [
      ...PERIOD_SCOPE,
      "academicYearId",
      "teacherId",
      "subjectId",
      "settlementStatus",
    ],
    comparisons: ["previousMonth", "sameMonthLastYear"],
  },
  payments: {
    report: "payments",
    supports: [...PERIOD_SCOPE, "academicYearId", "studentId", "paymentMethod", "paymentStatus"],
    comparisons: ["previousMonth", "previousPeriod"],
  },
  audit: {
    /*
     * التدقيق لا يقبل فلاتر النطاق الأكاديمي.
     *
     * سجلُّه واقعاتٌ على كياناتٍ مختلفة الأنواع، لا صفوفٌ تنتمي
     * إلى فوجٍ أو مادة. وتقييدُه بفوجٍ يُنتج قائمةً ناقصة تُقرأ
     * كأنّها كاملة — وهذا أسوأ ما يقع في شاشة مراجعة.
     */
    report: "audit",
    supports: ["dateFrom", "dateTo"],
    comparisons: [],
  },
  invoices: {
    report: "invoices",
    supports: [
      ...PERIOD_SCOPE,
      ...ACADEMIC_SCOPE,
      "studentId",
      "invoiceStatus",
    ],
    comparisons: ["previousMonth", "sameMonthLastYear"],
  },
  receipts: {
    /*
     * الإيصالُ لا نطاقَ أكاديمياً له.
     *
     * هو ورقةٌ تتبع دفعةً، والدفعةُ قد تسدّد فواتيرَ موادَّ عدّة —
     * فنسبتُه إلى مادّةٍ واحدة تعسّفٌ. ويُفلتر بزمنه وحالته.
     */
    report: "receipts",
    supports: [...PERIOD_SCOPE, "academicYearId"],
    comparisons: ["previousMonth"],
  },
  "debt-collections": {
    report: "debt-collections",
    supports: [...PERIOD_SCOPE, "academicYearId", "studentId", "teacherId"],
    comparisons: ["previousMonth", "sameMonthLastYear"],
  },
  "teacher-payments": {
    report: "teacher-payments",
    supports: [...PERIOD_SCOPE, "academicYearId", "teacherId", "paymentMethod"],
    comparisons: ["previousMonth", "previousPeriod"],
  },
  allocations: {
    report: "allocations",
    supports: [...PERIOD_SCOPE, "academicYearId", "teacherId"],
    comparisons: [],
  },
  cancellations: {
    /*
     * الإلغاءاتُ تعبر الكياناتِ كالتدقيق، فلا نطاقَ أكاديمياً لها.
     */
    report: "cancellations",
    supports: ["dateFrom", "dateTo", "month", "year"],
    comparisons: [],
  },
  "data-quality": {
    /*
     * فحوصُ جودة البيانات تمسح القاعدةَ كلَّها بلا فترة.
     *
     * وتقييدُها بشهرٍ يُنتج طمأنينةً كاذبة: «لا مشاكل في سبتمبر»
     * بينما الخللُ في أغسطس قائم. فالفحصُ شامل أو لا يكون.
     */
    report: "data-quality",
    supports: [],
    comparisons: [],
  },
  "financial-flow": {
    report: "financial-flow",
    supports: [...PERIOD_SCOPE, "academicYearId"],
    comparisons: ["previousMonth", "sameMonthLastYear", "previousPeriod"],
  },

  // --------------------------------------------------
  // الأكاديمي — §11 إلى §17
  //
  // خمسةُ أبعادٍ من شجرةٍ واحدة، فقدراتُها واحدة: كلٌّ منها يقبل
  // كلَّ فلاتر النطاق، لأنّ تضييقَ الطور مشروعٌ في تقرير المواد
  // كما هو مشروعٌ في تقرير الأفواج.
  // --------------------------------------------------
  academic: {
    report: "academic",
    supports: [...PERIOD_SCOPE, ...ACADEMIC_SCOPE],
    comparisons: [],
  },
  stages: {
    report: "stages",
    supports: [...PERIOD_SCOPE, ...ACADEMIC_SCOPE],
    comparisons: [],
  },
  levels: {
    report: "levels",
    supports: [...PERIOD_SCOPE, ...ACADEMIC_SCOPE],
    comparisons: [],
  },
  subjects: {
    report: "subjects",
    supports: [...PERIOD_SCOPE, ...ACADEMIC_SCOPE],
    comparisons: [],
  },
  groups: {
    report: "groups",
    supports: [...PERIOD_SCOPE, ...ACADEMIC_SCOPE],
    comparisons: [],
  },
  assignments: {
    report: "assignments",
    supports: [...PERIOD_SCOPE, ...ACADEMIC_SCOPE],
    comparisons: [],
  },
  sessions: {
    report: "sessions",
    supports: [...PERIOD_SCOPE, ...ACADEMIC_SCOPE],
    comparisons: ["previousMonth", "previousPeriod"],
  },
};

/**
 * تصفيةُ ما لا يدعمه التقرير.
 *
 * الفلترُ غيرُ المدعوم **يُسقط ولا يُطبَّق**. وهذا مقصود: تطبيقُ
 * فلترٍ لم يُصرَّح به يفتح باباً لتقييدٍ غير متوقَّع، وتجاهلُه
 * صامتاً مع إعلانه في `meta` يُبقي السلوك مفهوماً.
 */
export const applyCapability = (
  reportKey: string,
  query: ReportQuery,
): { filters: Partial<ReportQuery>; supported: FilterKey[]; ignored: string[] } => {
  const capability = REPORT_CAPABILITIES[reportKey];

  if (!capability) {
    throw new Error(`Unknown report: ${reportKey}`);
  }

  const supported = new Set<string>(capability.supports);
  const filters: Record<string, unknown> = {};
  const ignored: string[] = [];

  const filterKeys = [
    ...Object.keys(primaryFilterSchema.shape),
    ...Object.keys(advancedFilterSchema.shape),
  ];

  for (const key of filterKeys) {
    const value = (query as Record<string, unknown>)[key];

    if (value === undefined) continue;

    if (supported.has(key)) filters[key] = value;
    else ignored.push(key);
  }

  return {
    filters: filters as Partial<ReportQuery>,
    supported: capability.supports,
    ignored,
  };
};

/**
 * هل وضعُ المقارنة معقولٌ لهذا التقرير؟
 *
 * `sameMonthLastYear` في مؤسسةٍ عمرُها سنةٌ واحدة يقارن بالعدم،
 * فتظهر كلُّ المؤشّرات «+∞». لا تُمنع هنا — القرارُ للبيانات لا
 * للمخطّط — لكنّ التقرير الذي لا معنى للمقارنة فيه يعلن ذلك
 * بقائمةٍ فارغة، فتُخفي الواجهةُ الخيار.
 */
export const supportsComparison = (
  reportKey: string,
  mode: string,
): boolean => {
  if (mode === "none") return true;

  const capability = REPORT_CAPABILITIES[reportKey];

  return capability
    ? (capability.comparisons as string[]).includes(mode)
    : false;
};
