"use strict";
// ======================================================
// الفترات — §58
//
// في هذا النظام أربعةُ مفاهيمَ زمنية لا تتطابق:
//
//   1. السنة الدراسية — 2026/2027، تمتدّ على سنتين ميلاديتين
//   2. شهرُ الأعمال     — `invoice.month/year`، حقلٌ صريح
//   3. تاريخُ الواقعة   — `payment.paymentDate`, `session.date`
//   4. تاريخُ الإدخال   — `createdAt`
//
// والخلطُ بينها هو الخطأ الأشيع في تقارير المؤسسات التعليمية:
// فاتورةُ سبتمبر تُدخَل متأخّرةً في أكتوبر، فيَحسبها تقريرٌ يقرأ
// `createdAt` ضمن أكتوبر — فيَنقص سبتمبر ويَزيد أكتوبر، والفرقُ
// لا يُكتشف لأنّ المجموع الكلّي سليم.
//
// فالقاعدة: **ما له حقلُ أعمالٍ صريح يُقرأ منه**. `createdAt`
// للتدقيق (§37) وحده — يجيب «متى أُدخل السجلّ» لا «لأيّ شهرٍ هو».
// ======================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.academicYearPeriod = exports.rangePeriod = exports.monthPeriod = exports.isBeforePeriod = exports.academicYearMonths = exports.academicYearRange = exports.comparisonRange = exports.comparisonMonth = exports.yearMonthKey = exports.yearMonthOf = exports.sameYearMonth = exports.monthsBetween = exports.addMonths = exports.monthRange = exports.endOfMonth = exports.startOfMonth = exports.endOfDay = exports.startOfDay = void 0;
// --------------------------------------------------
// حدودُ اليوم
//
// المدى شاملٌ ليوم النهاية: من اختار «إلى 30 سبتمبر» يقصد نهايةَ
// ذلك اليوم لا منتصفَ ليله. وإغفالُ ذلك يُسقط دفعاتِ آخر يومٍ من
// كل تقرير — نقصٌ صغيرٌ منتظم لا يلفت النظر.
// --------------------------------------------------
const startOfDay = (date) => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
};
exports.startOfDay = startOfDay;
const endOfDay = (date) => {
    const copy = new Date(date);
    copy.setHours(23, 59, 59, 999);
    return copy;
};
exports.endOfDay = endOfDay;
const startOfMonth = ({ year, month }) => new Date(year, month - 1, 1, 0, 0, 0, 0);
exports.startOfMonth = startOfMonth;
/**
 * آخرُ لحظةٍ في الشهر.
 *
 * `new Date(year, month, 0)` تُرجع اليومَ الأخير من الشهر السابق
 * للمُعطى — وبما أنّ `month` هنا 1-based فهي اليومُ الأخير من
 * الشهر المطلوب. تحسبها البيئةُ نفسها، فلا حاجةَ لجدول 28/30/31
 * ولا لاستثناء السنة الكبيسة.
 */
const endOfMonth = ({ year, month }) => new Date(year, month, 0, 23, 59, 59, 999);
exports.endOfMonth = endOfMonth;
const monthRange = (yearMonth) => ({
    from: (0, exports.startOfMonth)(yearMonth),
    to: (0, exports.endOfMonth)(yearMonth),
});
exports.monthRange = monthRange;
// --------------------------------------------------
// حسابُ الأشهر
//
// الجمعُ والطرحُ على (سنة، شهر) لا على كائنات Date: الحسابُ على
// التواريخ يتعثّر في نهايات الأشهر (31 مارس ناقص شهرٍ ليس 31
// فبراير)، وهذه دوالُّ فتراتٍ لا دوالُّ أيّام.
// --------------------------------------------------
const addMonths = ({ year, month }, delta) => {
    /*
     * التطبيعُ عبر فهرسٍ مطلقٍ منذ الميلاد.
     *
     * والقسمةُ الأرضية `Math.floor` لا البتر: الطرحُ إلى ما قبل
     * يناير يُنتج فهرساً سالباً، و`Math.trunc(-1/12)` تساوي صفراً
     * فتُبقي السنةَ كما هي — أي أنّ «يناير ناقص شهر» تصير «ديسمبر
     * من نفس السنة» بدل ديسمبر السابقة. خطأُ سنةٍ كاملة في مقارنةٍ
     * تعبر رأسَ السنة.
     */
    const absolute = year * 12 + (month - 1) + delta;
    return {
        year: Math.floor(absolute / 12),
        month: (((absolute % 12) + 12) % 12) + 1,
    };
};
exports.addMonths = addMonths;
const monthsBetween = (a, b) => (b.year - a.year) * 12 + (b.month - a.month);
exports.monthsBetween = monthsBetween;
const sameYearMonth = (a, b) => a.year === b.year && a.month === b.month;
exports.sameYearMonth = sameYearMonth;
const yearMonthOf = (date) => ({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
});
exports.yearMonthOf = yearMonthOf;
/** مفتاحُ ترتيبٍ نصّي: 2026-09 يسبق 2026-10 معجمياً */
const yearMonthKey = ({ year, month }) => `${year}-${String(month).padStart(2, "0")}`;
exports.yearMonthKey = yearMonthKey;
/**
 * الشهرُ المقابل في وضع المقارنة.
 *
 * `sameMonthLastYear` مهمٌّ في التعليم تحديداً: سبتمبر شهرُ
 * تسجيلٍ وديسمبر شهرُ عطلة، فمقارنةُ ديسمبر بنوفمبر تُظهر انهياراً
 * موسمياً كأنّه تدهورُ أداء. والمقارنةُ بديسمبر الماضي وحدها تقول
 * شيئاً.
 */
const comparisonMonth = (current, mode) => mode === "sameMonthLastYear"
    ? { year: current.year - 1, month: current.month }
    : (0, exports.addMonths)(current, -1);
exports.comparisonMonth = comparisonMonth;
/**
 * المدى المقابل: بنفس الطول، ينتهي قُبيل بداية الحالي.
 *
 * الطولُ محسوبٌ بالأيام الكاملة لا بالمللي ثانية، لئلّا يزحف
 * التوقيتُ الصيفي بساعةٍ فتُحسب الفترةُ السابقة يوماً أقصر.
 */
const comparisonRange = (current, mode) => {
    if (mode === "sameMonthLastYear") {
        const from = new Date(current.from);
        const to = new Date(current.to);
        from.setFullYear(from.getFullYear() - 1);
        to.setFullYear(to.getFullYear() - 1);
        return { from: (0, exports.startOfDay)(from), to: (0, exports.endOfDay)(to) };
    }
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const days = Math.max(1, Math.round(((0, exports.startOfDay)(current.to).getTime() - (0, exports.startOfDay)(current.from).getTime()) /
        MS_PER_DAY) + 1);
    const to = new Date(current.from);
    to.setDate(to.getDate() - 1);
    const from = new Date(to);
    from.setDate(from.getDate() - (days - 1));
    return { from: (0, exports.startOfDay)(from), to: (0, exports.endOfDay)(to) };
};
exports.comparisonRange = comparisonRange;
const academicYearRange = (year) => ({
    from: (0, exports.startOfDay)(year.startDate),
    to: (0, exports.endOfDay)(year.endDate),
});
exports.academicYearRange = academicYearRange;
/**
 * أشهرُ السنة الدراسية بالترتيب — محورُ السلاسل الزمنية.
 *
 * يُولَّد من الحدود لا من افتراضِ اثني عشر شهراً: السنةُ قد تكون
 * تسعةَ أشهر، والرسمُ البياني يجب أن يعرض أشهرَها هي لا أشهرَ
 * التقويم.
 */
const academicYearMonths = (year) => {
    const first = (0, exports.yearMonthOf)(year.startDate);
    const last = (0, exports.yearMonthOf)(year.endDate);
    const span = (0, exports.monthsBetween)(first, last);
    if (span < 0)
        return [first];
    return Array.from({ length: span + 1 }, (_, index) => (0, exports.addMonths)(first, index));
};
exports.academicYearMonths = academicYearMonths;
/**
 * هل الفاتورةُ سابقةٌ لفترة المرجع؟ — أساسُ «الدَّين القديم» (§25).
 *
 * المقارنةُ على حقلَي الأعمال، فالفاتورةُ المُدخَلة متأخّرةً تُنسب
 * إلى شهرها لا إلى يوم إدخالها.
 */
const isBeforePeriod = (invoice, reference) => (0, exports.monthsBetween)(invoice, reference) > 0;
exports.isBeforePeriod = isBeforePeriod;
// --------------------------------------------------
// بناءُ الفترة
// --------------------------------------------------
const monthPeriod = (yearMonth, academicYearId) => ({
    kind: "month",
    yearMonth,
    range: (0, exports.monthRange)(yearMonth),
    academicYearId,
    label: (0, exports.yearMonthKey)(yearMonth),
});
exports.monthPeriod = monthPeriod;
const rangePeriod = (from, to, academicYearId) => ({
    kind: "range",
    range: { from: (0, exports.startOfDay)(from), to: (0, exports.endOfDay)(to) },
    academicYearId,
    label: `${(0, exports.startOfDay)(from).toISOString().slice(0, 10)} → ${(0, exports.endOfDay)(to)
        .toISOString()
        .slice(0, 10)}`,
});
exports.rangePeriod = rangePeriod;
const academicYearPeriod = (year) => ({
    kind: "academicYear",
    range: (0, exports.academicYearRange)(year),
    academicYearId: year.id,
    label: year.name,
});
exports.academicYearPeriod = academicYearPeriod;
//# sourceMappingURL=period.js.map