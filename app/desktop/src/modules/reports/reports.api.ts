import { apiClient } from "../../core/api/client";

// ======================================================
// واجهةُ التقارير — مرآةٌ لعقد الخادم (§57)
//
// الأنواعُ هنا نسخةٌ حرفية من `reports.contract.ts` في الخادم.
// وتكرارُها مقصود: التطبيقان منفصلان في البناء والنشر، ومشاركةُ
// نوعٍ بينهما تحتاج حزمةً ثالثة تُبنى وتُنشر معهما — كلفةٌ لا
// يبرّرها مشروعٌ بواجهةٍ واحدة.
//
// والحارسُ من التباعد أنّ الشكلَ موحَّدٌ لكلّ التقارير: خطأٌ في
// النوع يظهر في ستّةٍ وعشرين شاشةً دفعةً واحدة لا في واحدة، فلا
// يمرّ صامتاً.
// ======================================================

const BASE = "/reports/v2";

// --------------------------------------------------
// meta
// --------------------------------------------------

export interface ReportMeta {
  report: string;
  academicYear: { id: string; name: string } | null;
  period: {
    kind: "month" | "range" | "academicYear";
    label: string;
    from: string | null;
    to: string | null;
    month: number | null;
    year: number | null;
  };
  filters: Record<string, unknown>;
  supportedFilters: string[];
  comparison: { mode: string; label: string } | null;
  generatedAt: string;
  freshness: { source: "live" | "cached"; cachedAt: string | null };
}

// --------------------------------------------------
// summary
// --------------------------------------------------

export interface MetricDefinition {
  label: string;
  unit: "count" | "money" | "percent" | "ratio";
  direction: "higherIsBetter" | "lowerIsBetter" | "neutral";
  formula: string;
  description: string;
  caveat?: string;
  drillTo?: string;
}

export interface SummaryValue {
  key: string;
  /** `null` تعني «غير محسوب» لا صفر — الفرق جوهري في العرض */
  value: number | null;
  comparison?: {
    previous: number | null;
    absolute: number;
    percentage: number | null;
  };
  definition?: MetricDefinition;
}

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

export interface ChartSeries {
  key: string;
  label: string;
  /** موازٍ لـ`categories` طولاً؛ `null` فجوةٌ لا صفر */
  data: (number | null)[];
}

export interface ReportChart {
  key: string;
  title: string;
  kind: ChartKind;
  unit: "count" | "money" | "percent";
  categories: string[];
  series: ChartSeries[];
  drill?: { to: string; param: string; categoryIds: string[] };
  isEmpty: boolean;
}

// --------------------------------------------------
// table
// --------------------------------------------------

export interface TableColumn {
  key: string;
  label: string;
  type: "text" | "number" | "money" | "percent" | "date" | "status";
  sortable: boolean;
  hiddenByDefault?: boolean;
  align?: "start" | "end";
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ReportTable<Row = Record<string, unknown>> {
  columns: TableColumn[];
  rows: Row[];
  pagination: Pagination;
  sort: { key: string; direction: "asc" | "desc" } | null;
  rowDrill?: { to: string; idKey: string };
}

// --------------------------------------------------
// detail — §9 §28 §30
// --------------------------------------------------

export interface DetailField {
  label: string;
  value: string | number | boolean | null;
  type: "text" | "number" | "money" | "percent" | "date" | "status" | "phone";
  link?: { to: string; param: string; value: string };
}

export interface DetailSection {
  key: string;
  title: string;
  fields: DetailField[];
}

export interface DetailTable {
  key: string;
  title: string;
  columns: TableColumn[];
  rows: unknown[];
  shown?: number;
  total?: number;
}

export interface ReportDetail {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  sections: DetailSection[];
  tables: DetailTable[];
}

// --------------------------------------------------
// المظروف
// --------------------------------------------------

export interface ReportResponse<Row = Record<string, unknown>> {
  meta: ReportMeta;
  summary: ReportSummary;
  charts: ReportChart[];
  table: ReportTable<Row> | null;
  detail?: ReportDetail;
  partialErrors?: { section: string; message: string }[];
}

// ======================================================
// الفلاتر — §4
// ======================================================

export interface ReportFilters {
  academicYearId?: string;
  month?: number;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
  educationStageId?: string;
  levelId?: string;
  studyGroupId?: string;
  subjectId?: string;
  teacherId?: string;
  studentId?: string;
  invoiceStatus?: string;
  paymentStatus?: string;
  settlementStatus?: string;
  attendanceStatus?: string;
  paymentMethod?: string;
}

export interface ReportQuery extends ReportFilters {
  comparison?: "none" | "previousMonth" | "sameMonthLastYear" | "previousPeriod";
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

/**
 * تحويلُ الاستعلام إلى معاملات.
 *
 * القيمُ الفارغة تُحذف لا تُرسل خالية: `?studyGroupId=` يصل الخادمَ
 * سلسلةً فارغة فيرفضها المخطّط (`min(1)`) ويردّ 400 — والمستخدمُ
 * إنّما أفرغ قائمةً منسدلة.
 */
const toParams = (query: ReportQuery): Record<string, string> => {
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params[key] = String(value);
  }

  return params;
};

// ======================================================
// النداءات
// ======================================================

export const fetchReport = async <Row = Record<string, unknown>>(
  report: string,
  query: ReportQuery = {},
): Promise<ReportResponse<Row>> => {
  const { data } = await apiClient.get(`${BASE}/${report}`, {
    params: toParams(query),
  });

  return data.data as ReportResponse<Row>;
};

export const fetchReportDetail = async (
  report: string,
  id: string,
  query: ReportQuery = {},
): Promise<ReportResponse> => {
  const { data } = await apiClient.get(`${BASE}/${report}/${id}`, {
    params: toParams(query),
  });

  return data.data as ReportResponse;
};

// ======================================================
// مركزُ التصدير — §63
// ======================================================

export interface ExportableReport {
  key: string;
  title: string;
  description: string;
  group: "overview" | "academic" | "financial" | "teacher" | "audit";
  groupTitle: string;
  hasTable: boolean;
  path: string;
  exportPath: string;
  formats: readonly ("csv" | "xlsx")[];
}

export interface ExportCenter {
  reports: ExportableReport[];
  formats: { key: string; label: string; contentType: string }[];
  clientRendered: string[];
  note: string;
}

export const fetchExportCenter = async (): Promise<ExportCenter> => {
  const { data } = await apiClient.get(`${BASE}/exports`);

  return data.data as ExportCenter;
};

/**
 * تنزيلُ ملفّ تصدير.
 *
 * `responseType: "blob"` لأنّ XLSX ثنائيّ: تركُه نصّاً يُفسده
 * المحوِّلُ الافتراضي في axios فيخرج أرشيفٌ لا يُفتح.
 *
 * والاسمُ يُقرأ من `Content-Disposition` الذي يبنيه الخادم — فلا
 * يُعاد تركيبُه هنا. وتركيبُه في الموضعين يجعلهما يتباعدان، ويصير
 * اسمُ الملفّ يخالف ما يقوله الخادم في سجلّاته.
 */
export const downloadExport = async (
  report: string,
  format: "csv" | "xlsx",
  query: ReportQuery = {},
): Promise<{ blob: Blob; filename: string }> => {
  const response = await apiClient.get(`${BASE}/${report}/export`, {
    params: { ...toParams(query), format },
    responseType: "blob",
  });

  const disposition = String(response.headers["content-disposition"] ?? "");
  const match = disposition.match(/filename="?([^"]+)"?/);

  return {
    blob: response.data as Blob,
    filename: match?.[1] ?? `ajyal-${report}.${format}`,
  };
};
