import type { Pagination, ReportTable, TableColumn } from "./reports.contract";
import { pagination } from "./reports.contract";

// ======================================================
// الجداول الخادمية — §41 و§67
//
// خطران يعالجهما هذا الملف:
//
//   1. **الفرزُ بحقلٍ يختاره العميل.** تمريرُ `sortBy` إلى Prisma
//      كما ورد يفتح البابَ لفرزٍ بحقلٍ غير معروض — و`?sortBy=password`
//      لا يسرّب القيمةَ لكنّه يرتّب الصفوفَ بها، فيُستنتج ترتيبُ
//      البيانات المخفيّة بالمقارنة. ويكفي أن يكون الحقلُ غير موجودٍ
//      ليسقط الاستعلام بخطأ 500 يكشف بنيةَ المخطّط.
//
//      فلكلّ جدولٍ قائمةُ فرزٍ بيضاء، وما ليس فيها يُهمَل إلى
//      الافتراضي — لا يُرفَض الطلب: مستخدمٌ ضغط عموداً غير قابلٍ
//      للفرز يستحقّ جدولاً لا رسالةَ خطأ.
//
//   2. **العدُّ والصفوف يجب أن يقعا في لقطةٍ واحدة.** استعلامان
//      متتاليان قد يفصل بينهما إدخالُ صفّ، فيعرض الجدولُ «51 صفّاً»
//      ويُرسل خمسين. `$transaction` يجعلهما قراءةً واحدة.
// ======================================================

export type SortSpec = {
  /** الأعمدة التي يجوز الفرز بها، ومسارُ كلٍّ منها في Prisma */
  allowed: Record<string, unknown>;
  /** العمودُ الافتراضي — لا بدّ منه */
  fallback: string;
};

export type TableRequest = {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir: "asc" | "desc";
};

export type ResolvedSort = {
  key: string;
  direction: "asc" | "desc";
  orderBy: unknown;
};

/**
 * حلُّ الفرز عبر القائمة البيضاء.
 *
 * قيمةُ القائمة دالّةٌ تبني `orderBy` من الاتجاه، لأنّ الفرزَ عبر
 * علاقةٍ لا يُكتب مفتاحاً واحداً: الفرزُ باسم الطالب في جدولٍ صفوفُه
 * تسجيلات هو `{ student: { firstName: "asc" } }` لا `{ name: "asc" }`.
 */
export const resolveSort = (
  request: TableRequest,
  spec: SortSpec,
): ResolvedSort => {
  /*
   * `Object.hasOwn` لا `in`.
   *
   * و`in` يمشي في سلسلة النماذج الأولية، فـ`?sortBy=__proto__`
   * و`?sortBy=constructor` يجتازان القائمةَ البيضاء وهما ليسا
   * فيها. ثمّ تُقرأ القيمةُ من `Object.prototype` فليست دالّةً،
   * فيُبنى `{ __proto__: "desc" }` ويُسلَّم إلى Prisma.
   *
   * كتبتُها `in` أوّلَ مرّة وكشفها الاختبار — وهي بالضبط الثغرةُ
   * التي وُجدت القائمةُ البيضاء لسدّها، فاجتازها المدخلُ من حيث
   * لم يُحسب له حساب.
   *
   * وبالصيغة الصريحة لا `Object.hasOwn`: تلك تحتاج ES2022 والمشروع
   * على ES2020، وتوسيعُ `lib` لأجل سطرٍ واحد يمسّ الترجمة كلَّها.
   */
  const ownKey = (key: string) =>
    Object.prototype.hasOwnProperty.call(spec.allowed, key);

  const key =
    request.sortBy && ownKey(request.sortBy) ? request.sortBy : spec.fallback;

  const builder = spec.allowed[key];

  return {
    key,
    direction: request.sortDir,
    orderBy:
      typeof builder === "function"
        ? (builder as (dir: "asc" | "desc") => unknown)(request.sortDir)
        : { [key]: request.sortDir },
  };
};

export const skipTake = (request: TableRequest) => ({
  skip: (request.page - 1) * request.pageSize,
  take: request.pageSize,
});

/**
 * تجميعُ الجدول.
 *
 * `total` يأتي من عدٍّ منفصل لأنّ الترقيم يحتاج المجموعَ الكلّي لا
 * عددَ الصفحة. و`rows` مبنيّةٌ سلفاً — هذه الدالّةُ لا تعرف شكلَ
 * الصفّ ولا تلمس القاعدة.
 */
export const buildTable = <Row>(input: {
  columns: TableColumn[];
  rows: Row[];
  total: number;
  request: TableRequest;
  sort: ResolvedSort;
  rowDrill?: { to: string; idKey: string };
}): ReportTable<Row> => ({
  columns: input.columns,
  rows: input.rows,
  pagination: pagination(input.request.page, input.request.pageSize, input.total),
  sort: { key: input.sort.key, direction: input.sort.direction },
  ...(input.rowDrill ? { rowDrill: input.rowDrill } : {}),
});

/**
 * جدولٌ فارغ — لتقريرٍ لم تُطلب صفوفُه أو لا صفوفَ له.
 *
 * أعمدةٌ بلا صفوف لا `null`: الواجهةُ ترسم الترويسةَ وتعرض حالةَ
 * §48 تحتها، فيبقى الجدولُ مفهوماً بدل أن يختفي فيظنّ المستخدمُ
 * أنّ الشاشة معطوبة.
 */
export const emptyTable = <Row>(
  columns: TableColumn[],
  request: TableRequest,
  fallbackSort: string,
): ReportTable<Row> => ({
  columns,
  rows: [],
  pagination: pagination(request.page, request.pageSize, 0) as Pagination,
  sort: { key: fallbackSort, direction: request.sortDir },
});

// ======================================================
// أعمدةٌ مشتركة
// ======================================================

export const column = (
  key: string,
  label: string,
  type: TableColumn["type"],
  options: Partial<Omit<TableColumn, "key" | "label" | "type">> = {},
): TableColumn => ({
  key,
  label,
  type,
  sortable: options.sortable ?? false,
  /*
   * المحاذاة تتبع النوع لا المزاج: الأرقامُ إلى النهاية لتصطفّ
   * خاناتُها فتُقارَن بالنظر، والنصُّ إلى البداية. وخلطُهما يجعل
   * عمودَ مبالغ غيرَ قابلٍ للمسح بالعين.
   */
  align:
    options.align ??
    (type === "money" || type === "number" || type === "percent"
      ? "end"
      : "start"),
  ...(options.hiddenByDefault ? { hiddenByDefault: true } : {}),
});
