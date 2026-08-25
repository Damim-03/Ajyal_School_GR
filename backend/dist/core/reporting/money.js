"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.change = exports.rate = exports.toNumber = exports.money = exports.subtract = exports.sum = exports.toDecimal = exports.ZERO = exports.RATE_SCALE = exports.MONEY_SCALE = void 0;
const prisma_1 = require("../../../generated/prisma");
/** خانتان — وحدةُ العرض المالي في النظام */
exports.MONEY_SCALE = 2;
/** النسب المئوية بخانتين: 91.43% لا 91% ولا 91.4285714% */
exports.RATE_SCALE = 2;
exports.ZERO = new prisma_1.Prisma.Decimal(0);
/**
 * تحويلٌ آمن إلى Decimal.
 *
 * `null` و `undefined` تصيران صفراً لا استثناءً: تجميعاتُ Prisma
 * تُرجع `_sum: null` حين لا يطابق الشرطُ صفّاً واحداً، وهذه حالةٌ
 * مشروعة (شهرٌ بلا فواتير) لا خطأ.
 */
const toDecimal = (value) => {
    if (value === null || value === undefined)
        return exports.ZERO;
    if (value instanceof prisma_1.Prisma.Decimal)
        return value;
    const decimal = new prisma_1.Prisma.Decimal(value);
    if (!decimal.isFinite()) {
        throw new TypeError(`Non-finite money value: ${String(value)}`);
    }
    return decimal;
};
exports.toDecimal = toDecimal;
/** جمعٌ بلا خطأ عائم */
const sum = (values) => values.reduce((total, value) => total.plus((0, exports.toDecimal)(value)), exports.ZERO);
exports.sum = sum;
const subtract = (a, b) => (0, exports.toDecimal)(a).minus((0, exports.toDecimal)(b));
exports.subtract = subtract;
/**
 * تقريبٌ إلى منزلتين بـHALF_UP.
 *
 * HALF_UP لا HALF_EVEN: المؤسسة تتعامل بالدينار وتحاسب البشر،
 * و«النصف يُجبر» هو ما يتوقّعه المحاسب وما تفعله بقيةُ النظام في
 * `core/pricing/rounding.ts`. اختلافُ نمطِ التقريب بين التخليص
 * والتقرير يُنتج فرقاً بينهما لا يفسّره أحد.
 */
const money = (value) => (0, exports.toDecimal)(value).toDecimalPlaces(exports.MONEY_SCALE, prisma_1.Prisma.Decimal.ROUND_HALF_UP);
exports.money = money;
/** آخرُ خطوة: إلى Number للإرسال في JSON */
const toNumber = (value) => (0, exports.money)(value).toNumber();
exports.toNumber = toNumber;
// ======================================================
// النسب
// ======================================================
/**
 * نسبةٌ مئوية آمنة القسمة.
 *
 * المقام صفرٌ حالةٌ متكرّرة لا استثنائية: شهرٌ بلا فواتير، فوجٌ بلا
 * حصص، أستاذٌ بلا إسناد. و`0/0` في JavaScript ينتج `NaN` الذي
 * يُسلسَل في JSON إلى `null`، فتعرض الواجهة فراغاً بلا تفسير.
 *
 * و`null` هنا أصدقُ من `0`: صفرٌ يعني «حُسبت النسبة فكانت صفراً»،
 * و`null` يعني «لا معنى لنسبةٍ هنا». الفرقُ بين فوجٍ حضورُه 0%
 * وفوجٍ لم تُسجَّل له حصةٌ بعد — والخلطُ بينهما يُنتج تنبيهاً كاذباً
 * في §7 عن «فوجٍ حضورُه منخفض» لم يبدأ الدراسة أصلاً.
 */
const rate = (numerator, denominator) => {
    const bottom = (0, exports.toDecimal)(denominator);
    if (bottom.isZero())
        return null;
    return (0, exports.toDecimal)(numerator)
        .dividedBy(bottom)
        .times(100)
        .toDecimalPlaces(exports.RATE_SCALE, prisma_1.Prisma.Decimal.ROUND_HALF_UP)
        .toNumber();
};
exports.rate = rate;
/**
 * تغيّرٌ بين فترتين — §34.
 *
 * `absolute` يُحسب دائماً. أمّا `percentage` فـ`null` حين تكون
 * الفترةُ السابقة صفراً، لأنّ «زيادة بلا نهاية» ليست رقماً يُعرض:
 * مؤسسةٌ انتقلت من 0 إلى 40 طالباً نموُّها ليس «+∞%» بل «+40».
 * والواجهةُ تعرض المطلق وحده حينها.
 */
const change = (current, previous) => {
    const now = (0, exports.toDecimal)(current);
    const before = (0, exports.toDecimal)(previous);
    return {
        absolute: (0, exports.toNumber)(now.minus(before)),
        percentage: before.isZero()
            ? null
            : now
                .minus(before)
                .dividedBy(before.abs())
                .times(100)
                .toDecimalPlaces(exports.RATE_SCALE, prisma_1.Prisma.Decimal.ROUND_HALF_UP)
                .toNumber(),
    };
};
exports.change = change;
//# sourceMappingURL=money.js.map