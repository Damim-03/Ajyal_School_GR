import { Prisma } from "../../generated/prisma";
import { RoundingMode } from "../../generated/prisma";

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

const DECIMAL_MODE: Record<RoundingMode, Prisma.Decimal.Rounding> = {
  // نصفٌ فأكثر يُرفع — التقريب المدرسي المتوقَّع
  ROUND: Prisma.Decimal.ROUND_HALF_UP,
  // بعيداً عن الصفر: 140.01 → 141
  ROUND_UP: Prisma.Decimal.ROUND_UP,
  // نحو الصفر: 140.99 → 140
  ROUND_DOWN: Prisma.Decimal.ROUND_DOWN,
};

export const roundMoney = (
  value: Prisma.Decimal | number | string,
  mode: RoundingMode,
  precision: number,
): Prisma.Decimal =>
  new Prisma.Decimal(value).toDecimalPlaces(precision, DECIMAL_MODE[mode]);

/**
 * توزيع مبلغٍ على أسطر بحيث يبقى مجموعُها مساوياً له بالضبط.
 *
 * القسمة على 3 مثلاً تُنتج كسراً لا ينتهي، فتقريبُ كل سطر على حدة
 * يجعل المجموع يخالف الأصل بقروش. الفرقُ يُحمَّل على السطر الأخير،
 * فيبقى ما يُطبع في العمود مطابقاً لما يُطبع في الخانة السفلى.
 */
export const distributeEvenly = (
  total: Prisma.Decimal,
  parts: number,
  mode: RoundingMode,
  precision: number,
): Prisma.Decimal[] => {
  if (parts <= 0) return [];

  const share = roundMoney(total.div(parts), mode, precision);
  const shares = Array.from({ length: parts }, () => share);

  // الفارق المتراكم على آخر سطر
  const drift = total.minus(share.times(parts));
  shares[parts - 1] = roundMoney(share.plus(drift), mode, precision);

  return shares;
};
