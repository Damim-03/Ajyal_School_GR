import { useNavigate, useParams } from "react-router-dom";

import { ReportChartView } from "./charts/ReportChartView";
import { formatByUnit } from "./charts/scale";
import { MetricGrid, MetricSkeleton } from "./components/MetricCard";
import { ReportShell } from "./components/ReportShell";
import { TableSkeleton } from "./components/ReportTable";
import { useReportDetail } from "./hooks/use-report";
import { useReportQuery } from "./hooks/use-report-query";
import type { DetailField, DetailTable } from "./reports.api";

// ======================================================
// شاشةُ الكيان الواحد — §9 §28 §30
//
// تستعمل نفسَ المظروف: `summary` و `charts` كالمعتاد، ويُضاف
// `detail` بأقسامه وجداوله.
//
// والأقسامُ حقولٌ نصّية لا مؤشّرات — ولذلك لم تُحشر في `summary`:
// بطاقةُ مؤشّرٍ قيمتُها «0553…» ليست مؤشّراً.
// ======================================================

const fieldValue = (field: DetailField) => {
  if (field.value === null || field.value === "") {
    return <span className="text-white/25">—</span>;
  }

  if (field.type === "money" || field.type === "percent") {
    return (
      <span className="tabular-nums">
        {formatByUnit(Number(field.value), field.type)}
      </span>
    );
  }

  if (field.type === "number") {
    return <span className="tabular-nums">{String(field.value)}</span>;
  }

  if (field.type === "date") {
    const date = new Date(String(field.value));

    if (Number.isNaN(date.getTime())) return String(field.value);

    return (
      <span className="tabular-nums">
        {`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`}
      </span>
    );
  }

  /*
   * الهاتفُ بأرقامٍ لاتينية واتّجاهٍ يساري.
   *
   * الرقمُ العربيُّ داخل نصٍّ عربيّ ينقلب ترتيبُ مقاطعه في العرض
   * ثنائيّ الاتجاه، فيُقرأ «0553» «3550». و`dir="ltr"` تعزله.
   */
  if (field.type === "phone") {
    return (
      <span dir="ltr" className="inline-block tabular-nums">
        {String(field.value)}
      </span>
    );
  }

  return String(field.value);
};

const SubTable = ({ table }: { table: DetailTable }) => (
  <section className="rounded-lg border border-white/10 bg-white/[0.03]">
    <header className="flex items-baseline justify-between border-b border-white/10 px-4 py-2.5">
      <h3 className="text-sm font-medium text-white">{table.title}</h3>

      {/*
        §41: الاقتطاعُ يُعلَن.
        «5 من 40» يقول للقارئ إنّه يرى طرفاً — و«5» وحدها تجعله
        يظنّ أنّ الطالبَ له خمسُ دفعاتٍ لا أربعون.
      */}
      {table.total !== undefined && table.shown !== undefined && (
        <span className="text-[11px] tabular-nums text-white/35">
          {table.shown < table.total
            ? `${table.shown} من ${table.total}`
            : `${table.total}`}
        </span>
      )}
    </header>

    {table.rows.length === 0 ? (
      <p className="py-8 text-center text-xs text-white/35">لا صفوف</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04]">
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-3 py-2 text-xs font-medium text-white/50 ${
                    column.align === "end" ? "text-left" : "text-right"
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => {
              const record = row as Record<string, unknown>;

              return (
                <tr
                  key={String(record.id ?? index)}
                  className="border-b border-white/5 last:border-0"
                >
                  {table.columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-2 text-white/75 ${
                        column.align === "end" ? "text-left" : "text-right"
                      }`}
                    >
                      {fieldValue({
                        label: column.label,
                        value: record[column.key] as DetailField["value"],
                        type:
                          column.type === "status"
                            ? "status"
                            : (column.type as DetailField["type"]),
                      })}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

interface Props {
  reportKey: string;
  paramName: string;
  title: string;
}

export const DetailPage = ({ reportKey, paramName, title }: Props) => {
  const params = useParams();
  const navigate = useNavigate();
  const state = useReportQuery();

  const id = params[paramName];

  const { data, isLoading, isFetching, error, refetch } = useReportDetail(
    reportKey,
    id,
    state.query,
  );

  const detail = data?.detail;

  return (
    <ReportShell
      reportKey={reportKey}
      title={detail?.title ?? title}
      description={detail?.subtitle ?? ""}
      meta={data?.meta}
      report={data}
      state={state}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      onRetry={() => void refetch()}
    >
      <button
        type="button"
        className="text-xs text-white/50 hover:text-white print:hidden"
        onClick={() => navigate(-1)}
      >
        ← رجوع
      </button>

      {isLoading ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <MetricSkeleton key={index} />
            ))}
          </div>
          <TableSkeleton rows={5} />
        </>
      ) : (
        data && (
          <>
            {Object.keys(data.summary).length > 0 && (
              <MetricGrid summary={data.summary} />
            )}

            {detail && (
              <div className="grid gap-4 lg:grid-cols-2">
                {detail.sections.map((section) => (
                  <section
                    key={section.key}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
                  >
                    <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/35">
                      {section.title}
                    </h3>
                    <dl className="space-y-1.5">
                      {section.fields.map((field) => (
                        <div
                          key={field.label}
                          className="flex items-baseline justify-between gap-4 text-sm"
                        >
                          <dt className="shrink-0 text-xs text-white/50">
                            {field.label}
                          </dt>
                          <dd className="text-left text-white/90">
                            {field.link ? (
                              <button
                                type="button"
                                className="text-white/90 underline decoration-white/25 underline-offset-2 hover:decoration-white/60"
                                onClick={() =>
                                  navigate(
                                    `${field.link!.to}?${field.link!.param}=${encodeURIComponent(field.link!.value)}`,
                                  )
                                }
                              >
                                {fieldValue(field)}
                              </button>
                            ) : (
                              fieldValue(field)
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            )}

            {data.charts.length > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                {data.charts.map((chart) => (
                  <ReportChartView key={chart.key} chart={chart} />
                ))}
              </div>
            )}

            {detail?.tables.map((table) => (
              <SubTable key={table.key} table={table} />
            ))}
          </>
        )
      )}
    </ReportShell>
  );
};
