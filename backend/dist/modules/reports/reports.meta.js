"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMeta = exports.previousQuery = exports.resolveSelection = void 0;
const reporting_1 = require("../../core/reporting");
const reports_filters_1 = require("./reports.filters");
const reports_scope_1 = require("./reports.scope");
/**
 * تاريخٌ للعرض بالتقويم المحلّي.
 *
 * `toISOString()` يحوّل إلى UTC، والفرقُ ساعةٌ في الجزائر. فمنتصفُ
 * ليل 1 سبتمبر محليّاً هو 31 أغسطس بتوقيت UTC — ومن اختار «من 1
 * سبتمبر» كان يرى «2026-08-31» في ترويسة تقريره.
 *
 * والفلترةُ لم تكن مخطئة: الشرطُ يُبنى على كائنات `Date` بلحظاتها
 * الصحيحة. التسميةُ وحدها كانت تكذب — وهو أخبثُ من خطأ الحساب،
 * لأنّ الأرقام صحيحةٌ فلا يشكّ أحدٌ في العنوان.
 *
 * و`from`/`to` في الاستجابة تبقى ISO: تلك لحظاتٌ دقيقة تُرسل
 * للآلة، وهذه تسميةٌ تُقرأ.
 */
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const COMPARISON_LABEL = {
    previousMonth: "الشهر السابق",
    sameMonthLastYear: "نفس الشهر من السنة الماضية",
    previousPeriod: "الفترة السابقة بنفس الطول",
};
/**
 * حلُّ الفترة الحالية وفترةِ المقارنة معاً.
 *
 * المقارنةُ تُلغى صامتةً حين لا يدعمها التقرير — والإلغاءُ يظهر في
 * `meta.comparison = null`، فتعرف الواجهةُ ألّا تعرض عمودَ التغيّر
 * بدل أن تعرضه فارغاً.
 */
const resolveSelection = (reportKey, query, mode) => {
    const period = (0, reports_scope_1.resolvePeriod)(query);
    const current = {
        yearMonth: period.yearMonth,
        from: period.range?.from ?? null,
        to: period.range?.to ?? null,
    };
    if (mode === "none" || !(0, reports_filters_1.supportsComparison)(reportKey, mode)) {
        return { current, previous: null, mode: "none" };
    }
    /*
     * الشهرُ الصريح يُقارَن بشهر، والمدى بمدى.
     *
     * والفرقُ ليس شكلياً: مقارنةُ شهرٍ بمدىً محسوبٍ بالأيام تُنتج
     * فترةً تعبر حدودَ الشهر، فتُقارَن فواتيرُ سبتمبر بفواتيرِ
     * أواخرِ أغسطس وأوائلِ سبتمبر معاً — رقمٌ لا يقابل شيئاً.
     */
    if (period.yearMonth) {
        const previousMonth = (0, reporting_1.comparisonMonth)(period.yearMonth, mode);
        return {
            current,
            previous: {
                yearMonth: previousMonth,
                from: null,
                to: null,
            },
            mode,
        };
    }
    if (period.range) {
        const previousRange = (0, reporting_1.comparisonRange)(period.range, mode);
        return {
            current,
            previous: { yearMonth: null, from: previousRange.from, to: previousRange.to },
            mode,
        };
    }
    /*
     * بلا فترةٍ حالية لا مقارنة: «كلُّ الوقت» ليس له سابق.
     */
    return { current, previous: null, mode: "none" };
};
exports.resolveSelection = resolveSelection;
/** الفلاتر التي يفهمها التقرير، محوَّلةً إلى استعلامٍ للفترة السابقة */
const previousQuery = (query, selection) => {
    if (!selection.previous)
        return query;
    if (selection.previous.yearMonth) {
        return {
            ...query,
            month: selection.previous.yearMonth.month,
            year: selection.previous.yearMonth.year,
            dateFrom: undefined,
            dateTo: undefined,
        };
    }
    return {
        ...query,
        month: undefined,
        year: undefined,
        dateFrom: selection.previous.from ?? undefined,
        dateTo: selection.previous.to ?? undefined,
    };
};
exports.previousQuery = previousQuery;
const buildMeta = ({ report, query, selection, academicYear, }) => {
    const { filters, supported } = (0, reports_filters_1.applyCapability)(report, query);
    const capability = reports_filters_1.REPORT_CAPABILITIES[report];
    const { current } = selection;
    const kind = current.yearMonth
        ? "month"
        : current.from
            ? "range"
            : "academicYear";
    const label = current.yearMonth
        ? (0, reporting_1.yearMonthKey)(current.yearMonth)
        : current.from && current.to
            ? `${localDate(current.from)} → ${localDate(current.to)}`
            : (academicYear?.name ?? "كل الفترات");
    return {
        report,
        academicYear,
        period: {
            kind,
            label,
            from: current.from?.toISOString() ?? null,
            to: current.to?.toISOString() ?? null,
            month: current.yearMonth?.month ?? null,
            year: current.yearMonth?.year ?? null,
        },
        /*
         * الفلاتر المطبَّقة فعلاً لا ما أُرسل.
         *
         * فمن أرسل فلتراً لا يدعمه التقرير لا يجده هنا — ويرى في
         * `supportedFilters` لماذا. وعرضُ ما أُرسل كان سيؤكّد للمستخدم
         * أنّ الفلتر مطبَّق وهو مُهمَل.
         */
        filters: filters,
        supportedFilters: supported,
        comparison: selection.mode === "none"
            ? null
            : { mode: selection.mode, label: COMPARISON_LABEL[selection.mode] },
        generatedAt: new Date().toISOString(),
        /*
         * §71: لا نزعم أنّ البيانات لحظية.
         *
         * `live` لأنّ الاستعلام قرأ القاعدةَ الآن. ويومَ يُضاف تخزينٌ
         * مؤقّت تصير `cached` ومعها لحظتُها، فتعرض الواجهةُ «مولَّد
         * 14:32» بدل «الآن».
         */
        freshness: { source: "live", cachedAt: null },
        ...(capability ? {} : {}),
    };
};
exports.buildMeta = buildMeta;
//# sourceMappingURL=reports.meta.js.map