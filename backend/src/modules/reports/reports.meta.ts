import {
  ComparisonMode,
  YearMonth,
  comparisonMonth,
  comparisonRange,
  yearMonthKey,
} from "../../core/reporting";
import type { ReportMeta } from "./reports.contract";
import {
  REPORT_CAPABILITIES,
  ReportQuery,
  applyCapability,
  supportsComparison,
} from "./reports.filters";
import { resolvePeriod } from "./reports.scope";

// ======================================================
// بناءُ meta — §57 و§71
//
// `meta` ليست حشواً. قارئُ الشاشة يرى رقماً، و`meta` وحدها تقول
// **أيَّ فترةٍ يقرأ وبأيّ فلاتر**. وبدونها يُقرأ الرقمُ الخطأ
// قراءةً صحيحة — وهو أخطر من غياب الرقم، لأنّ الغيابَ يُلاحَظ.
// ======================================================

export type PeriodSelection = {
  current: { yearMonth: YearMonth | null; from: Date | null; to: Date | null };
  previous:
    | { yearMonth: YearMonth | null; from: Date | null; to: Date | null }
    | null;
  mode: ComparisonMode | "none";
};

/**
 * تاريخٌ للعرض بالتقويم المحلّي.
 *
 * `toISOString()` يحوّل إلى UTC، والفرقُ ساعةٌ في الجزائر. فمنتصفُ
 * ليل 1 سبتمبر محليّاً هو 31 أغسطس بتوقيت UTC — ومن اختار «من 1
 * سبتمبر» كان يرى «2026-08-31» في ترويسة تقريره.
 *
 * والفلترةُ لم تكن مخطئة: الشرطُ يُبنى على كائنات `Date` بلحظاتها
 * الصحيحة. التسميةُ وحدها كانت تكذب — وهو أخبثُ من خطأ الحساب،
 * لأنّ الأرقام صحيحةٌ فلا يشكّ أحدٌ في العنوان.
 *
 * و`from`/`to` في الاستجابة تبقى ISO: تلك لحظاتٌ دقيقة تُرسل
 * للآلة، وهذه تسميةٌ تُقرأ.
 */
const localDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const COMPARISON_LABEL: Record<ComparisonMode, string> = {
  previousMonth: "الشهر السابق",
  sameMonthLastYear: "نفس الشهر من السنة الماضية",
  previousPeriod: "الفترة السابقة بنفس الطول",
};

/**
 * حلُّ الفترة الحالية وفترةِ المقارنة معاً.
 *
 * المقارنةُ تُلغى صامتةً حين لا يدعمها التقرير — والإلغاءُ يظهر في
 * `meta.comparison = null`، فتعرف الواجهةُ ألّا تعرض عمودَ التغيّر
 * بدل أن تعرضه فارغاً.
 */
export const resolveSelection = (
  reportKey: string,
  query: Partial<ReportQuery>,
  mode: ComparisonMode | "none",
): PeriodSelection => {
  const period = resolvePeriod(query);

  const current = {
    yearMonth: period.yearMonth,
    from: period.range?.from ?? null,
    to: period.range?.to ?? null,
  };

  if (mode === "none" || !supportsComparison(reportKey, mode)) {
    return { current, previous: null, mode: "none" };
  }

  /*
   * الشهرُ الصريح يُقارَن بشهر، والمدى بمدى.
   *
   * والفرقُ ليس شكلياً: مقارنةُ شهرٍ بمدىً محسوبٍ بالأيام تُنتج
   * فترةً تعبر حدودَ الشهر، فتُقارَن فواتيرُ سبتمبر بفواتيرِ
   * أواخرِ أغسطس وأوائلِ سبتمبر معاً — رقمٌ لا يقابل شيئاً.
   */
  if (period.yearMonth) {
    const previousMonth = comparisonMonth(period.yearMonth, mode);

    return {
      current,
      previous: {
        yearMonth: previousMonth,
        from: null,
        to: null,
      },
      mode,
    };
  }

  if (period.range) {
    const previousRange = comparisonRange(period.range, mode);

    return {
      current,
      previous: { yearMonth: null, from: previousRange.from, to: previousRange.to },
      mode,
    };
  }

  /*
   * بلا فترةٍ حالية لا مقارنة: «كلُّ الوقت» ليس له سابق.
   */
  return { current, previous: null, mode: "none" };
};

/** الفلاتر التي يفهمها التقرير، محوَّلةً إلى استعلامٍ للفترة السابقة */
export const previousQuery = (
  query: Partial<ReportQuery>,
  selection: PeriodSelection,
): Partial<ReportQuery> => {
  if (!selection.previous) return query;

  if (selection.previous.yearMonth) {
    return {
      ...query,
      month: selection.previous.yearMonth.month,
      year: selection.previous.yearMonth.year,
      dateFrom: undefined,
      dateTo: undefined,
    };
  }

  return {
    ...query,
    month: undefined,
    year: undefined,
    dateFrom: selection.previous.from ?? undefined,
    dateTo: selection.previous.to ?? undefined,
  };
};

export type MetaInput = {
  report: string;
  query: ReportQuery;
  selection: PeriodSelection;
  academicYear: { id: string; name: string } | null;
};

export const buildMeta = ({
  report,
  query,
  selection,
  academicYear,
}: MetaInput): ReportMeta => {
  const { filters, supported } = applyCapability(report, query as ReportQuery);
  const capability = REPORT_CAPABILITIES[report];

  const { current } = selection;

  const kind: ReportMeta["period"]["kind"] = current.yearMonth
    ? "month"
    : current.from
      ? "range"
      : "academicYear";

  const label = current.yearMonth
    ? yearMonthKey(current.yearMonth)
    : current.from && current.to
      ? `${localDate(current.from)} → ${localDate(current.to)}`
      : (academicYear?.name ?? "كل الفترات");

  return {
    report,
    academicYear,
    period: {
      kind,
      label,
      from: current.from?.toISOString() ?? null,
      to: current.to?.toISOString() ?? null,
      month: current.yearMonth?.month ?? null,
      year: current.yearMonth?.year ?? null,
    },
    /*
     * الفلاتر المطبَّقة فعلاً لا ما أُرسل.
     *
     * فمن أرسل فلتراً لا يدعمه التقرير لا يجده هنا — ويرى في
     * `supportedFilters` لماذا. وعرضُ ما أُرسل كان سيؤكّد للمستخدم
     * أنّ الفلتر مطبَّق وهو مُهمَل.
     */
    filters: filters as Record<string, unknown>,
    supportedFilters: supported,
    comparison:
      selection.mode === "none"
        ? null
        : { mode: selection.mode, label: COMPARISON_LABEL[selection.mode] },
    generatedAt: new Date().toISOString(),
    /*
     * §71: لا نزعم أنّ البيانات لحظية.
     *
     * `live` لأنّ الاستعلام قرأ القاعدةَ الآن. ويومَ يُضاف تخزينٌ
     * مؤقّت تصير `cached` ومعها لحظتُها، فتعرض الواجهةُ «مولَّد
     * 14:32» بدل «الآن».
     */
    freshness: { source: "live", cachedAt: null },
    ...(capability ? {} : {}),
  };
};
