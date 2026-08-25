import { useState } from "react";

import { ChartSkeleton, ReportChartView } from "./charts/ReportChartView";
import { MetricGrid, MetricSkeleton } from "./components/MetricCard";
import { ReportShell } from "./components/ReportShell";
import { ReportTable, TableSkeleton } from "./components/ReportTable";
import { useReport } from "./hooks/use-report";
import { useReportQuery } from "./hooks/use-report-query";

// ======================================================
// الصفحةُ الجامعة — §57 يُثمر هنا
//
// ستٌّ وعشرون شاشةً بمكوّنٍ واحد. وهذا هو العائدُ الحقيقي لتوحيد
// المظروف في الخادم: الشاشةُ لا تعرف أنّها «تقرير الفواتير» أو
// «تقرير الحضور» — تعرف أنّ لها مؤشّراتٍ ورسوماً وجدولاً.
//
// ولو أعادت كلُّ نقطةٍ شكلاً يخصّها لاحتجنا ستّاً وعشرين صفحةً
// تتباعد في التفاصيل: هذه تعرض حالةَ الفراغ وتلك تنساها، وهذه
// تحفظ الفرزَ في العنوان وتلك في الذاكرة.
//
// والشاشاتُ الخاصّة — نظرةُ العموم والتفصيل — تستعمل نفسَ القطع
// وترتّبها بنفسها.
// ======================================================

interface Props {
  reportKey: string;
  title: string;
  description: string;
  /** ترتيبٌ مقصود للبطاقات؛ وما لم يُذكر يُعرض بعده */
  metricOrder?: string[];
  emphasis?: string[];
  /** ارتفاعُ الرسوم — الأعمدةُ الأفقية تحتاج أطولَ من الخطّ */
  chartHeight?: number;
}

export const ReportPage = ({
  reportKey,
  title,
  description,
  metricOrder,
  emphasis,
  chartHeight,
}: Props) => {
  const state = useReportQuery();
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);

  const { data, isLoading, isFetching, error, refetch } = useReport(
    reportKey,
    state.query,
  );

  return (
    <ReportShell
      reportKey={reportKey}
      title={title}
      description={description}
      meta={data?.meta}
      report={data}
      state={state}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      onRetry={() => void refetch()}
    >
      {/*
        §72: الفشلُ الجزئي يُعرض ولا يُكتم.

        الخادمُ يُرسل `partialErrors` حين يبلغ مصدرٌ سقفَه — وشاشةُ
        مراجعةٍ تعرض مجموعاً ناقصاً بلا تنبيه أسوأُ من شاشةٍ لا
        تعمل.
      */}
      {data?.partialErrors?.map((partial) => (
        <p
          key={partial.section}
          className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"
        >
          {partial.message}
        </p>
      ))}

      {/* المؤشّرات */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <MetricSkeleton key={index} />
          ))}
        </div>
      ) : data && Object.keys(data.summary).length > 0 ? (
        <MetricGrid
          summary={data.summary}
          order={metricOrder}
          emphasis={emphasis}
        />
      ) : null}

      {/* الرسوم */}
      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton height={chartHeight} />
          <ChartSkeleton height={chartHeight} />
        </div>
      ) : data && data.charts.length > 0 ? (
        <div
          className={
            data.charts.length === 1
              ? "grid gap-4"
              : "grid gap-4 lg:grid-cols-2"
          }
        >
          {data.charts.map((chart) => (
            <ReportChartView
              key={chart.key}
              chart={chart}
              height={chartHeight}
            />
          ))}
        </div>
      ) : null}

      {/* الجدول */}
      {isLoading ? (
        <TableSkeleton />
      ) : data?.table ? (
        <ReportTable
          table={data.table}
          onSort={state.setSort}
          onPage={state.setPage}
          hidden={hiddenColumns}
          onToggleColumn={(key) =>
            setHiddenColumns((current) =>
              current.includes(key)
                ? current.filter((item) => item !== key)
                : [...current, key],
            )
          }
        />
      ) : null}
    </ReportShell>
  );
};
