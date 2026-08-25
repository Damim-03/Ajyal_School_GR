import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import type { ReportQuery } from "../reports.api";

// ======================================================
// حالةُ الاستعلام — §4
//
// **مصدرُ الحقيقة هو العنوان** لا حالةٌ في الذاكرة.
//
// وثلاثُ فوائدَ تُشترى بذلك:
//
//   1. الرابطُ يُشارَك ويُحفظ — §4 يطلبها صراحةً. «افتح تقرير
//      سبتمبر للفوج الأوّل» تصير رابطاً يُرسَل لا وصفاً يُتَّبع.
//
//   2. زرُّ الرجوع يعمل. وحالةٌ في `useState` تجعل الرجوعَ يخرج من
//      الشاشة كلِّها بدل أن يتراجع خطوةً في الفلاتر.
//
//   3. التنقيبُ (§40) يصير تنقّلاً عادياً: الرسمُ يفتح
//      `/reports/financial?subjectId=x` ولا يحتاج تمريرَ حالةٍ بين
//      شاشتين.
//
// والثمنُ أنّ كلَّ تغييرٍ يكتب في التاريخ — ولذلك `replace` هو
// الافتراض في التعديلات المتتابعة كتغيير الصفحة.
// ======================================================

/** الفلاتر التي يفهمها الخادم — أيُّ معاملٍ آخر في العنوان يُتجاهل */
const FILTER_KEYS = [
  "academicYearId",
  "month",
  "year",
  "dateFrom",
  "dateTo",
  "educationStageId",
  "levelId",
  "studyGroupId",
  "subjectId",
  "teacherId",
  "studentId",
  "invoiceStatus",
  "paymentStatus",
  "settlementStatus",
  "attendanceStatus",
  "paymentMethod",
] as const;

const NUMERIC_KEYS = new Set(["month", "year", "page", "pageSize"]);

const PRESENTATION_KEYS = [
  "comparison",
  "page",
  "pageSize",
  "sortBy",
  "sortDir",
] as const;

export interface UseReportQuery {
  /** الاستعلامُ كاملاً — يُمرَّر إلى `fetchReport` كما هو */
  query: ReportQuery;
  /** الفلاتر وحدها — لعرض الشرائح النشطة */
  filters: Partial<ReportQuery>;
  setFilter: (key: string, value: string | number | undefined) => void;
  setFilters: (values: Partial<ReportQuery>) => void;
  setSort: (key: string, direction: "asc" | "desc") => void;
  setPage: (page: number) => void;
  setComparison: (mode: string) => void;
  reset: () => void;
  /** عددُ الفلاتر النشطة — لشارة «مرشّحات متقدّمة» */
  activeCount: number;
}

export const useReportQuery = (): UseReportQuery => {
  const [params, setParams] = useSearchParams();

  const query = useMemo(() => {
    const result: Record<string, unknown> = {};

    for (const key of [...FILTER_KEYS, ...PRESENTATION_KEYS]) {
      const value = params.get(key);

      if (value === null || value === "") continue;

      result[key] = NUMERIC_KEYS.has(key) ? Number(value) : value;
    }

    return result as ReportQuery;
  }, [params]);

  const filters = useMemo(() => {
    const result: Record<string, unknown> = {};

    for (const key of FILTER_KEYS) {
      const value = params.get(key);

      if (value === null || value === "") continue;

      result[key] = NUMERIC_KEYS.has(key) ? Number(value) : value;
    }

    return result as Partial<ReportQuery>;
  }, [params]);

  const write = useCallback(
    (mutate: (next: URLSearchParams) => void, replace = true) => {
      const next = new URLSearchParams(params);

      mutate(next);

      setParams(next, { replace });
    },
    [params, setParams],
  );

  const setFilter = useCallback(
    (key: string, value: string | number | undefined) => {
      write((next) => {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));

        /*
         * أيُّ تغييرٍ في الفلاتر يُعيد الصفحةَ إلى الأولى.
         *
         * ولولا ذلك لبقي المستخدمُ على الصفحة السابعة بعد تضييقٍ
         * نتيجتُه صفحتان — فيرى جدولاً فارغاً ويظنّ ألّا نتائج.
         */
        next.delete("page");
      });
    },
    [write],
  );

  const setFilters = useCallback(
    (values: Partial<ReportQuery>) => {
      write((next) => {
        for (const [key, value] of Object.entries(values)) {
          if (value === undefined || value === "") next.delete(key);
          else next.set(key, String(value));
        }

        next.delete("page");
      });
    },
    [write],
  );

  const setSort = useCallback(
    (key: string, direction: "asc" | "desc") => {
      write((next) => {
        next.set("sortBy", key);
        next.set("sortDir", direction);
        next.delete("page");
      });
    },
    [write],
  );

  const setPage = useCallback(
    (page: number) => {
      write((next) => {
        if (page <= 1) next.delete("page");
        else next.set("page", String(page));
      });
    },
    [write],
  );

  const setComparison = useCallback(
    (mode: string) => {
      write((next) => {
        if (mode === "none") next.delete("comparison");
        else next.set("comparison", mode);
      });
    },
    [write],
  );

  /*
   * التصفيرُ يمسح الفلاتر ويُبقي العرض.
   *
   * فمن ضغط «تصفير» يقصد البيانات لا ترتيبَ العمود الذي اختاره —
   * ومسحُ الفرز معها يُفاجئه بجدولٍ عاد إلى ترتيبٍ لم يطلبه.
   */
  const reset = useCallback(() => {
    write((next) => {
      for (const key of FILTER_KEYS) next.delete(key);
      next.delete("page");
    }, false);
  }, [write]);

  return {
    query,
    filters,
    setFilter,
    setFilters,
    setSort,
    setPage,
    setComparison,
    reset,
    activeCount: Object.keys(filters).length,
  };
};
