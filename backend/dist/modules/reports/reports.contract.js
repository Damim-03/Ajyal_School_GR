"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chart = exports.summaryOf = exports.metric = exports.pagination = void 0;
const reporting_1 = require("../../core/reporting");
// ======================================================
// البناء
// ======================================================
const pagination = (page, pageSize, total) => {
    /*
     * `totalPages` واحدٌ على الأقلّ حتى حين لا صفوف.
     *
     * الصفرُ يجعل الواجهةَ تعرض «صفحة 1 من 0» — وهي عبارةٌ لا معنى
     * لها. والجدولُ الفارغ صفحةٌ واحدة فارغة.
     */
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
    };
};
exports.pagination = pagination;
/**
 * بطاقةُ مؤشّر بتعريفها.
 *
 * التعريفُ يُلتقط من الكتالوج بالمفتاح. وغيابُه لا يُسقط الاستجابة
 * — تُرسل البطاقةُ بلا تعريف وتعرضها الواجهةُ بلا تلميح. إسقاطُ
 * تقريرٍ ماليٍّ كامل لأنّ نصَّ تلميحٍ ناقص مقايضةٌ خاسرة.
 */
const metric = (key, value, comparison) => {
    const definition = reporting_1.METRICS_BY_KEY.get(key);
    return {
        key,
        value,
        ...(comparison ? { comparison } : {}),
        ...(definition
            ? {
                definition: {
                    label: definition.label,
                    unit: definition.unit,
                    direction: definition.direction,
                    formula: definition.formula,
                    description: definition.description,
                    caveat: definition.caveat,
                    drillTo: definition.drillTo,
                },
            }
            : {}),
    };
};
exports.metric = metric;
const summaryOf = (values) => Object.fromEntries(values.map((value) => [value.key, value]));
exports.summaryOf = summaryOf;
/**
 * رسمٌ بيانيّ، مع تحديدِ الفراغ تلقائياً.
 *
 * «فارغ» = لا سلسلةَ تحمل قيمةً غيرَ فارغة. وهذا يميّز شهراً كلُّ
 * إيراده صفر (رسمٌ مسطّح على الصفر، بيانٌ صحيح) عن شهرٍ لا بيانات
 * فيه (حالةٌ فارغة برسالة) — §48.
 */
const chart = (input) => ({
    ...input,
    isEmpty: input.categories.length === 0 ||
        input.series.every((series) => series.data.every((point) => point === null)),
});
exports.chart = chart;
//# sourceMappingURL=reports.contract.js.map