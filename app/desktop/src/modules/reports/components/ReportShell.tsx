import { AlertTriangle, ArrowRight, Download, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { AppHeader } from "../../../components/AppHeader";

import type { ReportMeta } from "../reports.api";
import { downloadExport } from "../reports.api";
import type { UseReportQuery } from "../hooks/use-report-query";
import { FilterBar } from "./FilterBar";
import { SCREEN_BY_KEY } from "../reports.catalog";
import { PrintButton } from "../print/PrintButton";
import { ReportScanner } from "./ReportScanner";
import type { ReportResponse } from "../reports.api";

// ======================================================
// هيكلُ صفحة التقرير — §68 §69 §49 §71
//
// كلُّ شاشةٍ تلبسه: مسارٌ تفصيلي، وعنوانٌ ووصف، وشريطُ فلاتر،
// وأفعالٌ (تصدير وطباعة)، ولحظةُ التوليد.
//
// وتوحيدُه ليس ترفاً تنظيمياً: ستٌّ وعشرون شاشةً لكلٍّ ترويستُها
// تعني ستّاً وعشرين طريقةً لعرض «الفترة» — وقارئٌ يعبر بينها لا
// يجد شيئاً في موضعه.
// ======================================================

interface Props {
  reportKey: string;
  title: string;
  description: string;
  meta?: ReportMeta;
  /** التقريرُ كاملاً — تحتاجه ورقةُ الطباعة */
  report?: ReportResponse;
  state: UseReportQuery;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  onRetry: () => void;
  children: ReactNode;
}

/**
 * لحظةُ التوليد — §71.
 *
 * «مولَّد 14:32» لا «الآن»: النظامُ لا يقدّم بياناتٍ لحظية، والزعمُ
 * بها يجعل مديراً يتّخذ قراراً على رقمٍ عمرُه دقائق وهو يظنّه
 * ثانيةً.
 */
const generatedLabel = (iso: string): string => {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "";

  return `مولَّد ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
};

export const ReportShell = ({
  reportKey,
  title,
  description,
  meta,
  report,
  state,
  isLoading,
  isFetching,
  error,
  onRetry,
  children,
}: Props) => {
  const navigate = useNavigate();

  /*
   * الرجوعُ إلى محور المجموعة لا إلى محور التقارير.
   *
   * من دخل «الفواتير» جاء من محور المالي، فرجوعُه إليه يُبقيه في
   * سياقه. والرجوعُ إلى الجذر يُجبره على النزول مرّتين ليصل إلى
   * تقريرٍ مجاور.
   */
  const group = SCREEN_BY_KEY.get(reportKey)?.group;
  const backTo =
    group && group !== "overview" ? `/reports/section/${group}` : "/reports";

  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const runExport = async (format: "csv" | "xlsx") => {
    setExporting(format);
    setExportError(null);

    try {
      const { blob, filename } = await downloadExport(
        reportKey,
        format,
        state.query,
      );

      /*
       * التنزيلُ عبر رابطٍ مؤقّت.
       *
       * و`revokeObjectURL` بعده لازم: كلُّ `createObjectURL` يحجز
       * الـblob في الذاكرة حتى يُفكّ صراحةً. ومستخدمٌ يصدّر عشرين
       * تقريراً في جلسةٍ يُراكم عشرين ملفّاً في ذاكرة التطبيق.
       */
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = filename;
      anchor.click();

      URL.revokeObjectURL(url);
    } catch {
      /*
       * الفشلُ يُعرض ولا يُبتلع.
       *
       * وأشيعُ سببٍ هنا نقصُ صلاحية `report.export` (§54): يرى
       * المستخدمُ الأرقامَ ولا يُخرجها. فرسالةٌ مفهومة خيرٌ من زرٍّ
       * لا يفعل شيئاً.
       */
      setExportError("تعذّر التصدير. قد تنقصك صلاحية التصدير.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-[#05070d] text-white">
      {/*
        ترويسةُ القسم — نفسُ `AppHeader` في كلّ شاشات التطبيق.

        وهويّتُها مشتقّةٌ من المسار لا ممرَّرة، فتأخذ لونَ التقارير
        وأيقونتَه من `modules.ts` بلا أن تُمرَّر — كما تفعل بقيّةُ
        الشاشات.
      */}
      {/*
        `sticky` على اللافّة نفسِها لا على `AppHeader` وحدها.

        و`.home-header` ملتصقةٌ في `index.css` أصلاً، لكنّ الملتصقَ لا
        يتجاوز صندوقَ أبيه: لافّةٌ ارتفاعُها ارتفاعُ الترويسة تعني أنّ
        الالتصاقَ ينتهي حيث تنتهي — فتخرج مع أوّل تمرير. واللافّةُ
        موجودةٌ لإخفاء الترويسة عند الطباعة، فتُعطى الالتصاقَ نفسَه
        بدل أن تُلغى.
      */}
      <div className="sticky top-0 z-30 print:hidden">
        <AppHeader title={title} subtitle={description}>
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
          >
            <ArrowRight className="h-4 w-4" />
            رجوع
          </button>
        </AppHeader>
      </div>

      {/* شريطُ الأفعال — §69 */}
      <header className="border-b border-white/10 bg-white/[0.03] px-6 pb-3 pt-3 print:border-0">
        <nav className="mb-1 text-[11px] text-white/35" aria-label="المسار">
          التقارير <span className="mx-1">/</span>
          <span className="text-white/60">{title}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          {/*
            العنوانُ يُطبع ولا يُعرض: `AppHeader` أعلاه يحمله على
            الشاشة، وهو مخفيٌّ عند الطباعة. و§62 يطلب اسمَ التقرير
            في الورقة — فيُكتب هنا للطباعة وحدها.
          */}
          <div className="hidden print:block">
            <h1 className="text-lg font-semibold text-white">{title}</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-white/50">
              {description}
            </p>
          </div>

          {/* الأفعال — تُخفى عند الطباعة (§62) */}
          <div className="flex items-center gap-1.5 print:hidden">
            {meta && (
              <span className="ml-2 text-[11px] text-white/35">
                {generatedLabel(meta.generatedAt)}
                {isFetching && !isLoading && (
                  <span className="mr-2 text-white/25">· يُحدَّث…</span>
                )}
              </span>
            )}

            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs text-white/60 hover:bg-white/[0.06] disabled:opacity-50"
              onClick={() => runExport("xlsx")}
              disabled={exporting !== null}
            >
              <Download className="size-3.5" aria-hidden />
              {exporting === "xlsx" ? "…" : "Excel"}
            </button>

            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs text-white/60 hover:bg-white/[0.06] disabled:opacity-50"
              onClick={() => runExport("csv")}
              disabled={exporting !== null}
            >
              <Download className="size-3.5" aria-hidden />
              {exporting === "csv" ? "…" : "CSV"}
            </button>

            {/*
              الماسحُ في كلّ شاشة — نفسُ نافذة مسح الكشوف.

              وموضعُه في الشريط لا في المحور: الورقةُ تُمسح وأنت
              أمام تقريرٍ آخر، فيجب أن يكون الماسحُ حيث أنت لا في
              شاشةٍ تعود إليها.
            */}
            <ReportScanner />

            {report && (
              <PrintButton report={report} title={title} />
            )}
          </div>
        </div>

        {/* الفترةُ تُطبع مع الورقة — §62 يطلبها في الترويسة */}
        {meta && (
          <p className="mt-2 hidden text-xs text-white/60 print:block">
            الفترة: {meta.period.label}
            {meta.academicYear ? ` · ${meta.academicYear.name}` : ""}
          </p>
        )}
      </header>

      <div className="print:hidden">
        <FilterBar meta={meta} state={state} />
      </div>

      {exportError && (
        <p className="border-b border-amber-400/30 bg-amber-400/10 px-6 py-2 text-xs text-amber-200">
          {exportError}
        </p>
      )}

      {/*
        §49: فشلُ التقرير يُعرض برسالةٍ وزرَّين — ولا يكسر الصفحة.
      */}
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
          <AlertTriangle className="size-8 text-amber-400" aria-hidden />
          <div>
            <p className="text-sm font-medium text-white">
              تعذّر تحميل هذا التقرير.
            </p>
            <p className="mt-1 text-xs text-white/50">
              قد يكون الخادم غير متاح، أو تنقصك صلاحية عرضه.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/15 px-3 text-xs text-white hover:bg-white/25"
              onClick={onRetry}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              إعادة المحاولة
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-white/10 px-3 text-xs text-white/60 hover:bg-white/[0.06]"
              onClick={state.reset}
            >
              تصفير الفلاتر
            </button>
          </div>
        </div>
      ) : (
        <main className="flex-1 space-y-4 p-6">{children}</main>
      )}

    </div>
  );
};
