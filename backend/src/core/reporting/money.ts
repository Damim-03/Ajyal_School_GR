import { Prisma } from "../../../generated/prisma";

// ======================================================
// المال في التقارير — Decimal لا Number
//
// كلُّ مبلغٍ في المخطّط `Decimal`، وتحويلُه إلى `Number` قبل الجمع
// يُدخل خطأ الفاصلة العائمة: مئةُ فاتورةٍ بقيمة 0.1 تجمع 9.99999…
// لا 10. الخطأ ضئيلٌ في السطر الواحد، لكنّ التقرير يجمع آلافَ
// السطور ثمّ يقارن الناتج بمجموعٍ آخر — فيظهر فرقُ دينارٍ لا مصدرَ
// له، ويسقط ثقةُ الإدارة بالتقرير كلِّه.
//
// فالقاعدة: الحسابُ كلُّه بـDecimal، والتحويلُ إلى Number في آخر
// خطوةٍ قبل الإرسال فقط — بعد أن يكون الناتج مقرَّباً لمنزلتين.
// ======================================================

export type MoneyInput = Prisma.Decimal | number | string | null | undefined;

/** خانتان — وحدةُ العرض المالي في النظام */
export const MONEY_SCALE = 2;

/** النسب المئوية بخانتين: 91.43% لا 91% ولا 91.4285714% */
export const RATE_SCALE = 2;

export const ZERO = new Prisma.Decimal(0);

/**
 * تحويلٌ آمن إلى Decimal.
 *
 * `null` و `undefined` تصيران صفراً لا استثناءً: تجميعاتُ Prisma
 * تُرجع `_sum: null` حين لا يطابق الشرطُ صفّاً واحداً، وهذه حالةٌ
 * مشروعة (شهرٌ بلا فواتير) لا خطأ.
 */
export const toDecimal = (value: MoneyInput): Prisma.Decimal => {
  if (value === null || value === undefined) return ZERO;
  if (value instanceof Prisma.Decimal) return value;

  const decimal = new Prisma.Decimal(value);

  if (!decimal.isFinite()) {
    throw new TypeError(`Non-finite money value: ${String(value)}`);
  }

  return decimal;
};

/** جمعٌ بلا خطأ عائم */
export const sum = (values: MoneyInput[]): Prisma.Decimal =>
  values.reduce<Prisma.Decimal>(
    (total, value) => total.plus(toDecimal(value)),
    ZERO,
  );

export const subtract = (a: MoneyInput, b: MoneyInput): Prisma.Decimal =>
  toDecimal(a).minus(toDecimal(b));

/**
 * تقريبٌ إلى منزلتين بـHALF_UP.
 *
 * HALF_UP لا HALF_EVEN: المؤسسة تتعامل بالدينار وتحاسب البشر،
 * و«النصف يُجبر» هو ما يتوقّعه المحاسب وما تفعله بقيةُ النظام في
 * `core/pricing/rounding.ts`. اختلافُ نمطِ التقريب بين التخليص
 * والتقرير يُنتج فرقاً بينهما لا يفسّره أحد.
 */
export const money = (value: MoneyInput): Prisma.Decimal =>
  toDecimal(value).toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);

/** آخرُ خطوة: إلى Number للإرسال في JSON */
export const toNumber = (value: MoneyInput): number =>
  money(value).toNumber();

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
export const rate = (
  numerator: MoneyInput,
  denominator: MoneyInput,
): number | null => {
  const bottom = toDecimal(denominator);

  if (bottom.isZero()) return null;

  return toDecimal(numerator)
    .dividedBy(bottom)
    .times(100)
    .toDecimalPlaces(RATE_SCALE, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
};

/**
 * تغيّرٌ بين فترتين — §34.
 *
 * `absolute` يُحسب دائماً. أمّا `percentage` فـ`null` حين تكون
 * الفترةُ السابقة صفراً، لأنّ «زيادة بلا نهاية» ليست رقماً يُعرض:
 * مؤسسةٌ انتقلت من 0 إلى 40 طالباً نموُّها ليس «+∞%» بل «+40».
 * والواجهةُ تعرض المطلق وحده حينها.
 */
export const change = (
  current: MoneyInput,
  previous: MoneyInput,
): { absolute: number; percentage: number | null } => {
  const now = toDecimal(current);
  const before = toDecimal(previous);

  return {
    absolute: toNumber(now.minus(before)),
    percentage: before.isZero()
      ? null
      : now
          .minus(before)
          .dividedBy(before.abs())
          .times(100)
          .toDecimalPlaces(RATE_SCALE, Prisma.Decimal.ROUND_HALF_UP)
          .toNumber(),
  };
};
