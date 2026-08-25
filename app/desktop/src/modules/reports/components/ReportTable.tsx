import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { ReportTable as TableData, TableColumn } from "../reports.api";
import { SEMANTIC } from "../charts/palette";
import { formatByUnit, fullNumber } from "../charts/scale";

// ======================================================
// جدولُ التقرير — §41
//
// الترقيمُ والفرزُ **خادميّان**: الجدولُ يعرض ما وصله ويطلب غيرَه،
// ولا يفرز في الذاكرة. وفرزُ الصفحة المعروضة وحدها هو أخطرُ ما
// يمكن أن يفعله جدولٌ مرقَّم — يبدو صحيحاً ويكذب: «أعلى المتبقّين»
// تعرض أعلى الخمسين المعروضين لا أعلى الأربعمئة.
// ======================================================

interface Props<Row> {
  table: TableData<Row>;
  onSort: (key: string, direction: "asc" | "desc") => void;
  onPage: (page: number) => void;
  /** أعمدةٌ مخفيّة يتحكّم بها المستخدم — §41 */
  hidden?: string[];
  onToggleColumn?: (key: string) => void;
}

const alignOf = (column: TableColumn) =>
  column.align === "end" ? "text-left" : "text-right";

/**
 * تلوينُ الحالات — §46: لونٌ مع نصّ لا لونٌ وحده.
 *
 * والنصُّ يبقى مقروءاً بلا لون: من لا يميّز الأحمرَ من الأخضر يقرأ
 * «ملغاة» كما يقرؤها غيرُه.
 */
const STATUS_TONE: Record<string, keyof typeof SEMANTIC> = {
  PAID: "positive",
  ACTIVE: "positive",
  CONFIRMED: "positive",
  COMPLETED: "positive",
  APPROVED: "positive",
  PRESENT: "positive",
  نشط: "positive",

  PENDING: "warning",
  PARTIAL: "warning",
  DRAFT: "warning",
  SCHEDULED: "warning",
  LATE: "warning",
  EXCUSED: "warning",
  REPRINTED: "warning",

  CANCELLED: "danger",
  ABSENT: "danger",
  "غير نشط": "danger",
};

const STATUS_LABEL: Record<string, string> = {
  PAID: "مسدَّدة",
  PARTIAL: "جزئية",
  PENDING: "معلَّقة",
  CANCELLED: "ملغاة",
  ACTIVE: "نشطة",
  DRAFT: "مسوّدة",
  CONFIRMED: "مؤكَّدة",
  SCHEDULED: "مجدولة",
  COMPLETED: "مكتملة",
  APPROVED: "معتمدة",
  PRESENT: "حاضر",
  ABSENT: "غائب",
  LATE: "متأخّر",
  EXCUSED: "معذور",
  MALE: "ذكر",
  FEMALE: "أنثى",
  CASH: "نقداً",
  CARD: "بطاقة",
  BANK_TRANSFER: "تحويل",
  REPRINTED: "أُعيد طبعه",
  settlement: "تخليص",
  debtShare: "حصّة دَين",
  unknown: "بلا وجهة",
  critical: "حرج",
  warning: "تنبيه",
};

const renderCell = (value: unknown, column: TableColumn) => {
  if (value === null || value === undefined) {
    return <span className="text-white/25">—</span>;
  }

  if (column.type === "money" || column.type === "percent") {
    return (
      <span className="tabular-nums">
        {formatByUnit(Number(value), column.type)}
      </span>
    );
  }

  if (column.type === "number") {
    return <span className="tabular-nums">{fullNumber(Number(value))}</span>;
  }

  if (column.type === "date") {
    const date = new Date(String(value));

    if (Number.isNaN(date.getTime())) return String(value);

    /*
     * التاريخُ بأجزائه المحلّية لا بقصّ ISO: القصُّ يزحف يوماً في
     * التوقيتات الموجبة — وهي الزلّة نفسها التي وقعت في تسمية
     * الفترة على الخادم.
     */
    return (
      <span className="tabular-nums">
        {`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`}
      </span>
    );
  }

  if (column.type === "status") {
    if (typeof value === "boolean") {
      return (
        <span
          className="text-xs font-medium"
          style={{ color: SEMANTIC[value ? "positive" : "danger"] }}
        >
          {value ? "نعم" : "لا"}
        </span>
      );
    }

    const text = String(value);
    const tone = STATUS_TONE[text];

    return (
      <span
        className="text-xs font-medium"
        style={{ color: tone ? SEMANTIC[tone] : undefined }}
      >
        {STATUS_LABEL[text] ?? text}
      </span>
    );
  }

  return String(value);
};

export const ReportTable = <Row extends Record<string, unknown>>({
  table,
  onSort,
  onPage,
  hidden = [],
  onToggleColumn,
}: Props<Row>) => {
  const navigate = useNavigate();
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const columns = useMemo(
    () =>
      table.columns.filter(
        (column) =>
          !hidden.includes(column.key) &&
          (!column.hiddenByDefault || hidden.includes(`!${column.key}`)),
      ),
    [table.columns, hidden],
  );

  const { pagination } = table;

  const openRow = (row: Row) => {
    if (!table.rowDrill) return;

    const id = row[table.rowDrill.idKey];

    if (typeof id === "string") navigate(`${table.rowDrill.to}/${id}`);
  };

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03]">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <p className="text-xs text-white/50">
          {pagination.total > 0 ? (
            <>
              <span className="font-medium tabular-nums text-white/75">
                {fullNumber(pagination.total)}
              </span>{" "}
              صفّاً · صفحة{" "}
              <span className="tabular-nums">{pagination.page}</span> من{" "}
              <span className="tabular-nums">{pagination.totalPages}</span>
            </>
          ) : (
            "لا صفوف"
          )}
        </p>

        {onToggleColumn && (
          <div className="relative">
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-white/50 hover:bg-white/[0.06] hover:text-white/75"
              onClick={() => setShowColumnMenu((open) => !open)}
            >
              الأعمدة
            </button>

            {showColumnMenu && (
              <div className="absolute left-0 top-8 z-20 w-52 rounded-md border border-white/10 bg-white/[0.03] p-2 shadow-lg">
                {table.columns.map((column) => (
                  <label
                    key={column.key}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-white/[0.06]"
                  >
                    <input
                      type="checkbox"
                      checked={columns.some((shown) => shown.key === column.key)}
                      onChange={() => onToggleColumn(column.key)}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/*
        §50: الجدولُ العريض يمرّر أفقياً داخل حاويته.
        والصفحةُ نفسها لا تمرّر — تمريرُ الصفحة كلِّها يُفقد
        الترويسةَ والفلاتر.
      */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04]">
              {columns.map((column) => {
                const sorted = table.sort?.key === column.key;
                const SortIcon = !sorted
                  ? ChevronsUpDown
                  : table.sort?.direction === "asc"
                    ? ChevronUp
                    : ChevronDown;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={[
                      "px-3 py-2 text-xs font-medium text-white/50",
                      alignOf(column),
                      /* §41: الترويسةُ ثابتة عند التمرير */
                      "sticky top-0",
                      column.sortable ? "cursor-pointer select-none" : "",
                    ].join(" ")}
                    onClick={
                      column.sortable
                        ? () =>
                            onSort(
                              column.key,
                              sorted && table.sort?.direction === "desc"
                                ? "asc"
                                : "desc",
                            )
                        : undefined
                    }
                    aria-sort={
                      sorted
                        ? table.sort?.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {column.label}
                      {column.sortable && (
                        <SortIcon
                          className={
                            sorted
                              ? "size-3 text-white/60"
                              : "size-3 text-white/25"
                          }
                          aria-hidden
                        />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {table.rows.map((row, index) => (
              <tr
                key={String(row.id ?? index)}
                className={[
                  "border-b border-white/5 last:border-0",
                  table.rowDrill
                    ? "cursor-pointer hover:bg-white/[0.06]"
                    : "hover:bg-white/[0.03]",
                ].join(" ")}
                onClick={table.rowDrill ? () => openRow(row) : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 py-2 text-white/75 ${alignOf(column)}`}
                  >
                    {renderCell(row[column.key], column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
        §48: الفراغُ يُشرح ولا يُترك سطراً واحداً.
        والأعمدةُ تبقى مرسومةً فوقه، فيبقى للجدول هيكلٌ مفهوم.
      */}
      {table.rows.length === 0 && (
        <div className="flex flex-col items-center gap-1 py-10 text-center">
          <p className="text-sm text-white/50">
            لا صفوف تطابق الفلاتر المختارة.
          </p>
          <p className="text-xs text-white/35">
            جرّب توسيع الفترة أو إزالة فلترٍ من الشريط أعلاه.
          </p>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <footer className="flex items-center justify-between border-t border-white/10 px-4 py-2.5">
          <button
            type="button"
            className="rounded px-3 py-1 text-xs text-white/60 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-white/25"
            disabled={!pagination.hasPrevious}
            onClick={() => onPage(pagination.page - 1)}
          >
            السابقة
          </button>

          <span className="text-xs tabular-nums text-white/35">
            {pagination.page} / {pagination.totalPages}
          </span>

          <button
            type="button"
            className="rounded px-3 py-1 text-xs text-white/60 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-white/25"
            disabled={!pagination.hasNext}
            onClick={() => onPage(pagination.page + 1)}
          >
            التالية
          </button>
        </footer>
      )}
    </section>
  );
};

/** §47: هيكلُ جدولٍ بصفوفٍ وهمية لا دوّامة */
export const TableSkeleton = ({ rows = 8 }: { rows?: number }) => (
  <section className="rounded-lg border border-white/10 bg-white/[0.03]">
    <div className="border-b border-white/10 px-4 py-2.5">
      <div className="h-3 w-32 animate-pulse rounded bg-white/12" />
    </div>
    <div className="divide-y divide-white/5">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex gap-4 px-4 py-3">
          <div className="h-3 flex-1 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  </section>
);
