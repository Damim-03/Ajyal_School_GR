"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.distributeEvenly = exports.roundMoney = void 0;
const prisma_1 = require("../../../generated/prisma");
/**
 * التقريب مركزيٌّ هنا.
 *
 * §19: «لا تستخدم rounding عشوائياً في أماكن مختلفة». وسببُ ذلك عملي
 * لا جمالي: تقريبٌ في منتصف السلسلة ثم آخر في نهايتها يُنتجان مبلغاً
 * يخالف ما تحسبه الآلة الحاسبة على الورقة، فيفقد الأستاذ ثقته بالرقم.
 *
 * فالقاعدة: **احسب بالكامل، وقرِّب مرّة واحدة في النهاية.**
 * ولذلك rate في SettlementLine بأربع منازل لا اثنتين — القسمة
 * 1500 ÷ 8 × 75% = 140.625 تُحفظ كما هي، ولا تُقرَّب إلا بعد ضربها
 * في عدد الحضور.
 */
const DECIMAL_MODE = {
    // نصفٌ فأكثر يُرفع — التقريب المدرسي المتوقَّع
    ROUND: prisma_1.Prisma.Decimal.ROUND_HALF_UP,
    // بعيداً عن الصفر: 140.01 → 141
    ROUND_UP: prisma_1.Prisma.Decimal.ROUND_UP,
    // نحو الصفر: 140.99 → 140
    ROUND_DOWN: prisma_1.Prisma.Decimal.ROUND_DOWN,
};
const roundMoney = (value, mode, precision) => new prisma_1.Prisma.Decimal(value).toDecimalPlaces(precision, DECIMAL_MODE[mode]);
exports.roundMoney = roundMoney;
/**
 * توزيع مبلغٍ على أسطر بحيث يبقى مجموعُها مساوياً له بالضبط.
 *
 * القسمة على 3 مثلاً تُنتج كسراً لا ينتهي، فتقريبُ كل سطر على حدة
 * يجعل المجموع يخالف الأصل بقروش. الفرقُ يُحمَّل على السطر الأخير،
 * فيبقى ما يُطبع في العمود مطابقاً لما يُطبع في الخانة السفلى.
 */
const distributeEvenly = (total, parts, mode, precision) => {
    if (parts <= 0)
        return [];
    const share = (0, exports.roundMoney)(total.div(parts), mode, precision);
    const shares = Array.from({ length: parts }, () => share);
    // الفارق المتراكم على آخر سطر
    const drift = total.minus(share.times(parts));
    shares[parts - 1] = (0, exports.roundMoney)(share.plus(drift), mode, precision);
    return shares;
};
exports.distributeEvenly = distributeEvenly;
//# sourceMappingURL=rounding.js.map