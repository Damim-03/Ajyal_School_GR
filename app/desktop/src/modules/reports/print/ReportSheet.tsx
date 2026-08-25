import { Fragment, useMemo } from "react";

import { Barcode } from "../../../components/print/Barcode";
import { SheetBarcode } from "../../../components/print/SheetBarcode";
import { reportCode } from "./report-code";
import { logoSpec } from "../../../components/print/logo";
import {
  usePagedFlow,
  type PrintBlock,
} from "../../../components/print/paged-flow";
import { useSchoolStore } from "../../../core/stores/school.store";
import { formatByUnit } from "../charts/scale";
import type { ReportResponse, TableColumn } from "../reports.api";

// ======================================================
// ورقةُ التقرير — على نظام الكشوف نفسِه
//
// كانت ورقةً واحدة تطول بلا حدّ ويتركُ تقطيعُها للمتصفّح. وأثرُ ذلك
// أنّ الترويسةَ لا تتكرّر، والترقيمَ لا يُعرف، وصفّاً يُقصّ نصفين
// بين ورقتين.
//
// وهذا النظامُ مبنيٌّ في المشروع منذ كشوف الحضور: `usePagedFlow`
// يقيس ورقةً خفيّة مرّةً، ثمّ يوزّع الكتلَ على أوراقٍ بميزانيةٍ
// محسوبة. فيتكرّر الرأسُ في كلّ ورقة، ويُعرف العددُ فيُرقَّم،
// وينزل التذييلُ إلى الحافّة بفراغٍ محسوبٍ لا مفروض.
//
// و`SHEET_MM` فيه 297×210 — **أفقيّةٌ أصلاً**، وهو ما يحتاجه
// التقرير: جداولُه تبلغ خمسةَ عشرَ عموداً.
// ======================================================

/** أعمدةٌ تحمل رقماً مرجعياً — لكلٍّ باركودُه في عمود «الرمز» */
const CODED_COLUMNS = [
  "settlementNumber",
  "invoiceNumber",
  "paymentNumber",
  "receiptNumber",
  "studentNumber",
  "reference",
] as const;

const rowCode = (
  row: Record<string, unknown>,
  columns: TableColumn[],
): string | null => {
  for (const key of CODED_COLUMNS) {
    if (!columns.some((column) => column.key === key)) continue;

    const value = row[key];

    /*
     * Code128 يقبل ASCII وحده. ورقمُ التخليص `STL-2026-0003` يمرّ،
     * وقيمةٌ فيها عربيةٌ تُرفض — و`Barcode` يبتلع الاستثناء ويترك
     * خانةً فارغة بلا تفسير، فالفحصُ هنا يمنع ذلك.
     */
    if (typeof value === "string" && /^[\x20-\x7E]+$/.test(value)) return value;
  }

  return null;
};

const cell = (value: unknown, column: TableColumn): string => {
  if (value === null || value === undefined || value === "") return "—";

  if (column.type === "money" || column.type === "percent") {
    return formatByUnit(Number(value), column.type);
  }

  if (column.type === "date") {
    const date = new Date(String(value));

    if (Number.isNaN(date.getTime())) return String(value);

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  if (typeof value === "boolean") return value ? "نعم" : "لا";

  return String(value);
};

interface Props {
  report: ReportResponse;
  title: string;
}

export const ReportSheet = ({ report, title }: Props) => {
  const settings = useSchoolStore((state) => state.settings);

  const school = settings["school.name"] || "مركز أجيال التعليمي";
  const logo = logoSpec(settings);
  const code = reportCode(report);

  const printedOn = new Date(report.meta.generatedAt).toLocaleString("ar-DZ", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const columns = useMemo(
    () =>
      report.table?.columns.filter((column) => !column.hiddenByDefault) ?? [],
    [report.table],
  );

  const hasRowCodes = useMemo(
    () =>
      CODED_COLUMNS.some((key) =>
        columns.some((column) => column.key === key),
      ),
    [columns],
  );

  /*
   * الترويسةُ تتكرّر في كلّ ورقة — نفسُ بنية كشف الحضور.
   *
   * ثلاثةُ أقسام: جانبٌ يمينَه فيه الرمزُ ولحظةُ التحرير، ووسطٌ فيه
   * الشعارُ واسمُ المؤسسة والعنوان، وجانبٌ يسارَه فيه الفترةُ
   * والفلاتر.
   */
  const header = (
    <header className="sheet-print-top">
      <div className="sheet-print-side">
        {/*
          الرمزُ بمكوّن الكشوف نفسِه — `SheetBarcode`.

          وكنتُ كتبتُ له أصنافاً خاصّة، فخرج أصغرَ من رمز الكشف
          وبإطارٍ حوله. والمكوّنُ القائم يحمل مقاسَه المعتمد (45 مم
          عرضاً و9 ارتفاعاً) ونصَّه تحته بنفس الوزن والتباعد —
          فتُقرأ الورقتان بعينٍ واحدة ويمسحهما ماسحٌ واحد.
        */}
        <SheetBarcode code={code} />
        <span className="sheet-print-printed">حُرِّر في {printedOn}</span>
      </div>

      <div className="sheet-print-center">
        {logo.src && (
          <img
            src={logo.src}
            alt=""
            className="sheet-print-logo"
            style={{ width: `${logo.widthMm}mm`, filter: logo.filter }}
          />
        )}
        <h1>{school}</h1>
        {report.meta.academicYear && <h2>{report.meta.academicYear.name}</h2>}
        <h3 className="report-sheet-title">{title}</h3>
      </div>

      <div className="sheet-print-side sheet-print-side-end">
        <span>الفترة: {report.meta.period.label}</span>
        {Object.entries(report.meta.filters).length > 0 && (
          <span className="report-sheet-filters">
            {Object.entries(report.meta.filters)
              .map(([key, value]) => `${key}=${String(value)}`)
              .join(" · ")}
          </span>
        )}
      </div>
    </header>
  );

  /*
   * الكتل — بالترتيب الذي تُقرأ به.
   *
   * المؤشّراتُ كتلةٌ صمّاء لا تُقسَّم: شبكةٌ من عشرين بطاقة تُقرأ
   * مجتمعةً، وقصُّها بين ورقتين يترك نصفَها بلا سياق.
   *
   * والجداولُ تُقسَّم صفوفاً ويتكرّر رأسُها — وهو ما يفعله
   * `paged-flow` من نفسه متى أُعلن نوعُها.
   */
  const blocks = useMemo<PrintBlock[]>(() => {
    const list: PrintBlock[] = [];

    if (Object.keys(report.summary).length > 0) {
      list.push({
        kind: "keep",
        key: "summary",
        node: (
          <section className="report-sheet-metrics">
            {Object.entries(report.summary).map(([key, metric]) => (
              <div key={key} className="report-sheet-metric">
                <span className="report-sheet-metric-label">
                  {metric.definition?.label ?? key}
                </span>
                <span className="report-sheet-metric-value">
                  {formatByUnit(
                    metric.value,
                    metric.definition?.unit ?? "count",
                  )}
                </span>
              </div>
            ))}
          </section>
        ),
      });
    }

    for (const section of report.detail?.sections ?? []) {
      list.push({
        kind: "keep",
        key: `section-${section.key}`,
        node: (
          <section className="report-sheet-section">
            <h4>{section.title}</h4>
            <dl>
              {section.fields.map((field) => (
                <div key={field.label}>
                  <dt>{field.label}</dt>
                  <dd dir={field.type === "phone" ? "ltr" : undefined}>
                    {field.value === null || field.value === ""
                      ? "—"
                      : typeof field.value === "boolean"
                        ? field.value
                          ? "نعم"
                          : "لا"
                        : String(field.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ),
      });
    }

    if (report.table && report.table.rows.length > 0) {
      list.push({
        kind: "table",
        key: "table",
        head: (
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              {hasRowCodes && <th className="report-sheet-code-col">الرمز</th>}
            </tr>
          </thead>
        ),
        rows: report.table.rows.map((row, index) => {
          const record = row as Record<string, unknown>;
          const rowBarcode = rowCode(record, columns);

          return (
            <tr key={index}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={
                    column.align === "end" ? "report-sheet-num" : undefined
                  }
                >
                  {cell(record[column.key], column)}
                </td>
              ))}
              {hasRowCodes && (
                <td className="report-sheet-code-col">
                  {rowBarcode ? (
                    <span className="report-sheet-row-code">
                      <Barcode value={rowBarcode} height={20} fit />
                    </span>
                  ) : null}
                </td>
              )}
            </tr>
          );
        }),
      });
    }

    for (const table of report.detail?.tables ?? []) {
      if (table.rows.length === 0) continue;

      list.push({
        kind: "table",
        key: `detail-${table.key}`,
        title: <h4 className="report-sheet-subtitle">{table.title}</h4>,
        head: (
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
        ),
        rows: table.rows.map((row, index) => {
          const record = row as Record<string, unknown>;

          return (
            <tr key={index}>
              {table.columns.map((column) => (
                <td
                  key={column.key}
                  className={
                    column.align === "end" ? "report-sheet-num" : undefined
                  }
                >
                  {cell(record[column.key], column)}
                </td>
              ))}
            </tr>
          );
        }),
      });
    }

    return list;
  }, [report, columns, hasRowCodes]);

  /*
   * التوقيعُ يُعيد القياسَ متى تغيّر ما يؤثّر في الارتفاع.
   *
   * وعددُ الصفوف وحده لا يكفي: تبديلُ الفلتر قد يُبقي العددَ ويغيّر
   * طولَ النصوص، فيتغيّر ارتفاعُ السطر ولا يُعاد القياس.
   */
  const signature = [
    report.meta.report,
    report.meta.period.label,
    report.table?.rows.length ?? 0,
    report.table?.pagination.page ?? 1,
    columns.length,
    blocks.length,
  ].join("|");

  const { measureRef, pages } = usePagedFlow(signature, blocks.length);

  /* طورُ القياس — ورقةٌ خفيّة فيها كلُّ الكتل بعلاماتها */
  if (!pages) {
    return (
      <div className="sheet-print report-sheet" dir="rtl">
        <div className="sheet-measure" ref={measureRef}>
          <section className="sheet-measure-page" data-measure-page="">
            {header}

            {blocks.map((block, index) => (
              <div key={block.key} data-flow-index={index}>
                {block.kind === "keep" ? (
                  block.node
                ) : (
                  <>
                    {block.title}
                    <table className="sheet-print-table" data-flow-table="">
                      {block.head}
                      <tbody>{block.rows}</tbody>
                    </table>
                  </>
                )}
              </div>
            ))}

            <footer className="sheet-print-foot" data-measure-foot="">
              <span style={{ display: "block" }}>الصفحة 1 من 1</span>
            </footer>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="sheet-print report-sheet" dir="rtl">
      {pages.map(({ pieces, fillMm }, page) => (
        <section className="sheet-page" key={page}>
          {header}

          {pieces.map((piece, at) => {
            const block = blocks[piece.index];

            if (block.kind === "keep") {
              return (
                <Fragment key={`${block.key}-${at}`}>{block.node}</Fragment>
              );
            }

            if (piece.kind !== "table") return null;

            return (
              <Fragment key={`${block.key}-${at}`}>
                {piece.withTitle && block.title}

                <table className="sheet-print-table">
                  {block.head}
                  <tbody>{block.rows.slice(piece.from, piece.to + 1)}</tbody>
                </table>
              </Fragment>
            );
          })}

          {/* الفراغُ الذي ينزل بالتذييل إلى أسفل الورقة — محسوبٌ لا مفروض */}
          <div style={{ height: `${fillMm.toFixed(2)}mm` }} />

          <footer className="sheet-print-foot">
            {report.table &&
              report.table.pagination.total > report.table.rows.length && (
                <span className="report-sheet-truncated">
                  معروض {report.table.rows.length} من{" "}
                  {report.table.pagination.total} صفّاً
                </span>
              )}
            <span style={{ display: "block" }}>
              الصفحة {page + 1} من {pages.length}
            </span>
          </footer>
        </section>
      ))}
    </div>
  );
};

/** عددُ الأوراق — يقرؤه المودل ليعرض الحصيلة قبل الطباعة */
export const usePageCount = (
  report: ReportResponse,
  blocks: number,
): number => {
  const signature = `${report.meta.report}|${report.table?.rows.length ?? 0}`;
  const { pages } = usePagedFlow(signature, blocks);

  return pages?.length ?? 1;
};
