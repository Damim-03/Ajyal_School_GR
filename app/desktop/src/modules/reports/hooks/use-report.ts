import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  fetchReport,
  fetchReportDetail,
  type ReportQuery,
  type ReportResponse,
} from "../reports.api";

// ======================================================
// جلبُ التقرير — §47 §49 §72
//
// `keepPreviousData` هو القرارُ المهمّ هنا.
//
// §47 يقول: «عند تغيير الفلاتر لا تعيد تحميل الصفحة بالكامل، حدّث
// البيانات بطريقة سلسة». وبدونه تختفي كلُّ البطاقات والرسوم عند
// كلّ تغيير فلتر وتُستبدل بهياكل ثمّ تعود — وميضٌ يجعل الشاشةَ
// تبدو مضطربة وإن كان الجلبُ سريعاً.
//
// ومعه تبقى الأرقامُ السابقة معروضةً خافتةً حتى تصل الجديدة، فيُرى
// التغيّرُ لا الانقطاع.
// ======================================================

export const reportKeys = {
  all: ["reports"] as const,
  report: (name: string, query: ReportQuery) =>
    ["reports", name, query] as const,
  detail: (name: string, id: string, query: ReportQuery) =>
    ["reports", name, "detail", id, query] as const,
  exports: ["reports", "exports"] as const,
};

export const useReport = <Row = Record<string, unknown>>(
  report: string,
  query: ReportQuery,
  enabled = true,
) =>
  useQuery<ReportResponse<Row>>({
    queryKey: reportKeys.report(report, query),
    queryFn: () => fetchReport<Row>(report, query),
    enabled,
    placeholderData: keepPreviousData,
    /*
     * دقيقةٌ واحدة قبل اعتبار البيانات قديمة.
     *
     * والتقاريرُ ليست لحظيةً بطبيعتها: مديرٌ يقارن شهرين لا ينتظر
     * تحديثاً كلَّ ثانية. و`meta.freshness` تقول متى وُلّدت
     * الأرقام، فلا نزعم لحظيةً لا نقدّمها (§71).
     */
    staleTime: 60_000,
    /*
     * لا إعادةَ جلبٍ عند العودة إلى النافذة.
     *
     * المستخدمُ ينتقل بين التطبيق وExcel أثناء المراجعة، وإعادةُ
     * الجلب عند كلّ عودة تُقفز الأرقامَ تحت عينه وهو يقرؤها.
     */
    refetchOnWindowFocus: false,
  });

export const useReportDetail = (
  report: string,
  id: string | undefined,
  query: ReportQuery,
) =>
  useQuery<ReportResponse>({
    queryKey: reportKeys.detail(report, id ?? "", query),
    queryFn: () => fetchReportDetail(report, id as string, query),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    /*
     * لا إعادةَ محاولةٍ على 404 أو 403.
     *
     * كيانٌ لا وجود له لن يوجد بالمحاولة الثانية، وثلاثُ محاولاتٍ
     * تؤخّر ظهورَ رسالة «غير موجود» ثلاثةَ أضعاف بلا فائدة. وكذلك
     * المنعُ: صلاحيةٌ ناقصة لا تكتمل بالإلحاح.
     */
    retry: (count, error) => {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;

      if (status === 404 || status === 403) return false;

      return count < 2;
    },
  });
