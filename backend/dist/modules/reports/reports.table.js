"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.column = exports.emptyTable = exports.buildTable = exports.skipTake = exports.resolveSort = void 0;
const reports_contract_1 = require("./reports.contract");
/**
 * حلُّ الفرز عبر القائمة البيضاء.
 *
 * قيمةُ القائمة دالّةٌ تبني `orderBy` من الاتجاه، لأنّ الفرزَ عبر
 * علاقةٍ لا يُكتب مفتاحاً واحداً: الفرزُ باسم الطالب في جدولٍ صفوفُه
 * تسجيلات هو `{ student: { firstName: "asc" } }` لا `{ name: "asc" }`.
 */
const resolveSort = (request, spec) => {
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
    const ownKey = (key) => Object.prototype.hasOwnProperty.call(spec.allowed, key);
    const key = request.sortBy && ownKey(request.sortBy) ? request.sortBy : spec.fallback;
    const builder = spec.allowed[key];
    return {
        key,
        direction: request.sortDir,
        orderBy: typeof builder === "function"
            ? builder(request.sortDir)
            : { [key]: request.sortDir },
    };
};
exports.resolveSort = resolveSort;
const skipTake = (request) => ({
    skip: (request.page - 1) * request.pageSize,
    take: request.pageSize,
});
exports.skipTake = skipTake;
/**
 * تجميعُ الجدول.
 *
 * `total` يأتي من عدٍّ منفصل لأنّ الترقيم يحتاج المجموعَ الكلّي لا
 * عددَ الصفحة. و`rows` مبنيّةٌ سلفاً — هذه الدالّةُ لا تعرف شكلَ
 * الصفّ ولا تلمس القاعدة.
 */
const buildTable = (input) => ({
    columns: input.columns,
    rows: input.rows,
    pagination: (0, reports_contract_1.pagination)(input.request.page, input.request.pageSize, input.total),
    sort: { key: input.sort.key, direction: input.sort.direction },
    ...(input.rowDrill ? { rowDrill: input.rowDrill } : {}),
});
exports.buildTable = buildTable;
/**
 * جدولٌ فارغ — لتقريرٍ لم تُطلب صفوفُه أو لا صفوفَ له.
 *
 * أعمدةٌ بلا صفوف لا `null`: الواجهةُ ترسم الترويسةَ وتعرض حالةَ
 * §48 تحتها، فيبقى الجدولُ مفهوماً بدل أن يختفي فيظنّ المستخدمُ
 * أنّ الشاشة معطوبة.
 */
const emptyTable = (columns, request, fallbackSort) => ({
    columns,
    rows: [],
    pagination: (0, reports_contract_1.pagination)(request.page, request.pageSize, 0),
    sort: { key: fallbackSort, direction: request.sortDir },
});
exports.emptyTable = emptyTable;
// ======================================================
// أعمدةٌ مشتركة
// ======================================================
const column = (key, label, type, options = {}) => ({
    key,
    label,
    type,
    sortable: options.sortable ?? false,
    /*
     * المحاذاة تتبع النوع لا المزاج: الأرقامُ إلى النهاية لتصطفّ
     * خاناتُها فتُقارَن بالنظر، والنصُّ إلى البداية. وخلطُهما يجعل
     * عمودَ مبالغ غيرَ قابلٍ للمسح بالعين.
     */
    align: options.align ??
        (type === "money" || type === "number" || type === "percent"
            ? "end"
            : "start"),
    ...(options.hiddenByDefault ? { hiddenByDefault: true } : {}),
});
exports.column = column;
//# sourceMappingURL=reports.table.js.map