import { MetricDefinition, METRICS_BY_KEY } from "../../core/reporting";

// ======================================================
// عقدُ الاستجابة الموحّد — §57
//
// خمسةٌ وثلاثون نقطةَ تقرير. ولو أعادت كلُّ واحدةٍ شكلاً يخصّها،
// لاحتاجت الواجهةُ خمسةً وثلاثين محوِّلاً — ولصار كلُّ مكوِّنِ
// جدولٍ أو رسمٍ مربوطاً بنقطةٍ بعينها لا يُعاد استعماله.
//
// فالشكلُ واحد: `meta` و `summary` و `charts` و `table`. والتقريرُ
// الذي لا جدولَ فيه يتركه فارغاً، لا يخترع شكلاً آخر.
//
// و`meta` ليست زينة: §71 يطلب عرضَ لحظة التوليد والفترة والفلاتر
// المطبَّقة. وبدونها لا يعرف قارئُ الشاشة أيَّ فترةٍ يقرأ — وهذا
// أخطرُ من غياب الرقم نفسه، لأنّ الرقمَ الخطأ يُقرأ صحيحاً.
// ======================================================

// --------------------------------------------------
// meta
// --------------------------------------------------

export type ReportMeta = {
  /** معرّف التقرير — يطابق مسار الواجهة */
  report: string;
  academicYear: { id: string; name: string } | null;
  period: {
    kind: "month" | "range" | "academicYear";
    label: string;
    from: string | null;
    to: string | null;
    /** حقلا الأعمال حين يكون التقرير شهرياً — §58 */
    month: number | null;
    year: number | null;
  };
  /** الفلاتر المطبَّقة فعلاً بعد التحقّق، لا ما أُرسل */
  filters: Record<string, unknown>;
  /** الفلاتر التي يفهمها هذا التقرير — §4 */
  supportedFilters: string[];
  comparison: {
    mode: string;
    label: string;
  } | null;
  generatedAt: string;
  /**
   * §71: لا نزعم أنّ البيانات لحظية.
   *
   * `live` تعني أنّ الاستعلام قرأ القاعدةَ الآن. وحين يُضاف تخزينٌ
   * مؤقّت لاحقاً تصير `cached` ومعها `cachedAt`، فتعرض الواجهةُ
   * «مولَّد 14:32» بدل «الآن» — والفرقُ يهمّ من يتّخذ قراراً.
   */
  freshness: { source: "live" | "cached"; cachedAt: string | null };
};

// --------------------------------------------------
// summary — بطاقات المؤشّرات
// --------------------------------------------------

export type SummaryValue = {
  key: string;
  /** الرقم. `null` تعني «غير محسوب» لا صفر — انظر money.rate */
  value: number | null;
  /** مقارنةُ الفترة السابقة حين تُطلب — §34 */
  comparison?: {
    previous: number | null;
    absolute: number;
    percentage: number | null;
  };
  /**
   * التعريفُ يُرسل مع الرقم لا يُعاد كتابته في الواجهة — §70.
   *
   * يُحقن من الكتالوج بمفتاحه، فالتعريفُ مصدرُه واحد. وحقنُه هنا
   * يعني أنّ تصحيحَ تعريفٍ يظهر في كل شاشةٍ تعرضه بلا تعديلِ
   * واجهة.
   */
  definition?: Pick<
    MetricDefinition,
    "label" | "unit" | "direction" | "formula" | "description" | "caveat" | "drillTo"
  >;
};

export type ReportSummary = Record<string, SummaryValue>;

// --------------------------------------------------
// charts
// --------------------------------------------------

export type ChartKind =
  | "line"
  | "area"
  | "bar"
  | "stackedBar"
  | "horizontalBar"
  | "donut";

export type ChartSeries = {
  key: string;
  label: string;
  /** موازٍ لـ`categories` طولاً؛ `null` فجوةٌ لا صفر */
  data: (number | null)[];
};

export type ReportChart = {
  key: string;
  title: string;
  kind: ChartKind;
  unit: "count" | "money" | "percent";
  /** محورُ الفئات — أشهرٌ أو أسماءُ مواد */
  categories: string[];
  series: ChartSeries[];
  /**
   * وجهةُ النقر على قطاع — §40 و§70.
   *
   * `param` اسمُ الفلتر الذي يُطبَّق، وقيمتُه معرّفُ الفئة المنقورة
   * من `categoryIds`. فلا يُعيد المستخدمُ اختيارَ الفلتر يدوياً.
   */
  drill?: { to: string; param: string; categoryIds: string[] };
  /** §48: تمييز «لا بيانات» عن «كلُّ القيم صفر» */
  isEmpty: boolean;
};

// --------------------------------------------------
// table
// --------------------------------------------------

export type TableColumn = {
  key: string;
  label: string;
  type: "text" | "number" | "money" | "percent" | "date" | "status";
  sortable: boolean;
  /** §41: إخفاءُ الأعمدة — الافتراضُ ظاهر */
  hiddenByDefault?: boolean;
  align?: "start" | "end";
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type ReportTable<Row = Record<string, unknown>> = {
  columns: TableColumn[];
  rows: Row[];
  pagination: Pagination;
  sort: { key: string; direction: "asc" | "desc" } | null;
  /** وجهةُ النقر على صفّ — §8 */
  rowDrill?: { to: string; idKey: string };
};

// --------------------------------------------------
// المظروف
// --------------------------------------------------

// --------------------------------------------------
// التفصيل — §9 §28 §30
//
// تقريرُ الكيان الواحد لا يسعه `summary` وحده: الطالبُ اسمٌ وتاريخُ
// ميلادٍ وهاتفُ وليّ — حقولٌ نصّية لا مؤشّراتٌ رقمية.
//
// و§57 يطلب توحيد الشكل «قدر الإمكان» لا مطلقاً. فالمظروفُ يبقى
// كما هو — `meta` و `summary` و `charts` و `table` — ويُضاف `detail`
// اختيارياً. والتقاريرُ الخمسةَ عشرَ القائمة لا تُرسله فلا يتغيّر
// شيءٌ عندها، والواجهةُ ترسم القسمَ الإضافي متى وُجد.
//
// وهذا أصدقُ من حشو الحقول النصّية في `summary`: بطاقةُ مؤشّرٍ
// قيمتُها «0553...» ليست مؤشّراً.
// --------------------------------------------------

export type DetailFieldType =
  | "text"
  | "number"
  | "money"
  | "percent"
  | "date"
  | "status"
  | "phone";

export type DetailField = {
  label: string;
  value: string | number | boolean | null;
  type: DetailFieldType;
  /** رابطٌ إلى كيانٍ آخر — §40 */
  link?: { to: string; param: string; value: string };
};

export type DetailSection = {
  key: string;
  title: string;
  fields: DetailField[];
};

export type DetailTable = {
  key: string;
  title: string;
  columns: TableColumn[];
  rows: unknown[];
  /** الصفوفُ المعروضة من أصل الكلّ — حين يُقتطع */
  shown?: number;
  total?: number;
};

export type ReportDetail = {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  sections: DetailSection[];
  tables: DetailTable[];
};

export type ReportResponse<Row = Record<string, unknown>> = {
  meta: ReportMeta;
  summary: ReportSummary;
  charts: ReportChart[];
  table: ReportTable<Row> | null;
  /** يُرسل في تقارير الكيان الواحد وحدها — §9 §28 §30 */
  detail?: ReportDetail;
  /**
   * §72: فشلٌ جزئي.
   *
   * سقوطُ رسمٍ واحد لا يمنع الجدولَ من العمل. فالقسمُ المتعثّر
   * يُذكر هنا وتعرض الواجهةُ حالةَ خطأ في موضعه وحده، بدل أن تُلغى
   * الشاشةُ كلُّها لأجل رسمٍ ثانوي.
   */
  partialErrors?: { section: string; message: string }[];
};

// ======================================================
// البناء
// ======================================================

export const pagination = (
  page: number,
  pageSize: number,
  total: number,
): Pagination => {
  /*
   * `totalPages` واحدٌ على الأقلّ حتى حين لا صفوف.
   *
   * الصفرُ يجعل الواجهةَ تعرض «صفحة 1 من 0» — وهي عبارةٌ لا معنى
   * لها. والجدولُ الفارغ صفحةٌ واحدة فارغة.
   */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
};

/**
 * بطاقةُ مؤشّر بتعريفها.
 *
 * التعريفُ يُلتقط من الكتالوج بالمفتاح. وغيابُه لا يُسقط الاستجابة
 * — تُرسل البطاقةُ بلا تعريف وتعرضها الواجهةُ بلا تلميح. إسقاطُ
 * تقريرٍ ماليٍّ كامل لأنّ نصَّ تلميحٍ ناقص مقايضةٌ خاسرة.
 */
export const metric = (
  key: string,
  value: number | null,
  comparison?: SummaryValue["comparison"],
): SummaryValue => {
  const definition = METRICS_BY_KEY.get(key);

  return {
    key,
    value,
    ...(comparison ? { comparison } : {}),
    ...(definition
      ? {
          definition: {
            label: definition.label,
            unit: definition.unit,
            direction: definition.direction,
            formula: definition.formula,
            description: definition.description,
            caveat: definition.caveat,
            drillTo: definition.drillTo,
          },
        }
      : {}),
  };
};

export const summaryOf = (values: SummaryValue[]): ReportSummary =>
  Object.fromEntries(values.map((value) => [value.key, value]));

/**
 * رسمٌ بيانيّ، مع تحديدِ الفراغ تلقائياً.
 *
 * «فارغ» = لا سلسلةَ تحمل قيمةً غيرَ فارغة. وهذا يميّز شهراً كلُّ
 * إيراده صفر (رسمٌ مسطّح على الصفر، بيانٌ صحيح) عن شهرٍ لا بيانات
 * فيه (حالةٌ فارغة برسالة) — §48.
 */
export const chart = (
  input: Omit<ReportChart, "isEmpty">,
): ReportChart => ({
  ...input,
  isEmpty:
    input.categories.length === 0 ||
    input.series.every((series) =>
      series.data.every((point) => point === null),
    ),
});
