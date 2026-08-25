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

export type YearMonth = { year: number; month: number };

export type DateRange = { from: Date; to: Date };

export type PeriodKind = "month" | "range" | "academicYear";

export type Period = {
  kind: PeriodKind;
  /** للكيانات ذات حقلَي شهر/سنة صريحين */
  yearMonth?: YearMonth;
  /** للكيانات المؤرَّخة بلحظةٍ فعلية */
  range?: DateRange;
  academicYearId?: string;
  label: string;
};

// --------------------------------------------------
// حدودُ اليوم
//
// المدى شاملٌ ليوم النهاية: من اختار «إلى 30 سبتمبر» يقصد نهايةَ
// ذلك اليوم لا منتصفَ ليله. وإغفالُ ذلك يُسقط دفعاتِ آخر يومٍ من
// كل تقرير — نقصٌ صغيرٌ منتظم لا يلفت النظر.
// --------------------------------------------------

export const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export const endOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

export const startOfMonth = ({ year, month }: YearMonth): Date =>
  new Date(year, month - 1, 1, 0, 0, 0, 0);

/**
 * آخرُ لحظةٍ في الشهر.
 *
 * `new Date(year, month, 0)` تُرجع اليومَ الأخير من الشهر السابق
 * للمُعطى — وبما أنّ `month` هنا 1-based فهي اليومُ الأخير من
 * الشهر المطلوب. تحسبها البيئةُ نفسها، فلا حاجةَ لجدول 28/30/31
 * ولا لاستثناء السنة الكبيسة.
 */
export const endOfMonth = ({ year, month }: YearMonth): Date =>
  new Date(year, month, 0, 23, 59, 59, 999);

export const monthRange = (yearMonth: YearMonth): DateRange => ({
  from: startOfMonth(yearMonth),
  to: endOfMonth(yearMonth),
});

// --------------------------------------------------
// حسابُ الأشهر
//
// الجمعُ والطرحُ على (سنة، شهر) لا على كائنات Date: الحسابُ على
// التواريخ يتعثّر في نهايات الأشهر (31 مارس ناقص شهرٍ ليس 31
// فبراير)، وهذه دوالُّ فتراتٍ لا دوالُّ أيّام.
// --------------------------------------------------

export const addMonths = (
  { year, month }: YearMonth,
  delta: number,
): YearMonth => {
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

export const monthsBetween = (a: YearMonth, b: YearMonth): number =>
  (b.year - a.year) * 12 + (b.month - a.month);

export const sameYearMonth = (a: YearMonth, b: YearMonth): boolean =>
  a.year === b.year && a.month === b.month;

export const yearMonthOf = (date: Date): YearMonth => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
});

/** مفتاحُ ترتيبٍ نصّي: 2026-09 يسبق 2026-10 معجمياً */
export const yearMonthKey = ({ year, month }: YearMonth): string =>
  `${year}-${String(month).padStart(2, "0")}`;

// --------------------------------------------------
// فتراتُ المقارنة — §34
// --------------------------------------------------

export type ComparisonMode =
  /** الشهرُ السابق مباشرةً */
  | "previousMonth"
  /** نفسُ الشهر من السنة الماضية — يعزل الموسمية */
  | "sameMonthLastYear"
  /** مدىً بطول المدى الحالي ينتهي قُبيل بدايته */
  | "previousPeriod";

/**
 * الشهرُ المقابل في وضع المقارنة.
 *
 * `sameMonthLastYear` مهمٌّ في التعليم تحديداً: سبتمبر شهرُ
 * تسجيلٍ وديسمبر شهرُ عطلة، فمقارنةُ ديسمبر بنوفمبر تُظهر انهياراً
 * موسمياً كأنّه تدهورُ أداء. والمقارنةُ بديسمبر الماضي وحدها تقول
 * شيئاً.
 */
export const comparisonMonth = (
  current: YearMonth,
  mode: ComparisonMode,
): YearMonth =>
  mode === "sameMonthLastYear"
    ? { year: current.year - 1, month: current.month }
    : addMonths(current, -1);

/**
 * المدى المقابل: بنفس الطول، ينتهي قُبيل بداية الحالي.
 *
 * الطولُ محسوبٌ بالأيام الكاملة لا بالمللي ثانية، لئلّا يزحف
 * التوقيتُ الصيفي بساعةٍ فتُحسب الفترةُ السابقة يوماً أقصر.
 */
export const comparisonRange = (
  current: DateRange,
  mode: ComparisonMode,
): DateRange => {
  if (mode === "sameMonthLastYear") {
    const from = new Date(current.from);
    const to = new Date(current.to);
    from.setFullYear(from.getFullYear() - 1);
    to.setFullYear(to.getFullYear() - 1);
    return { from: startOfDay(from), to: endOfDay(to) };
  }

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const days = Math.max(
    1,
    Math.round(
      (startOfDay(current.to).getTime() - startOfDay(current.from).getTime()) /
        MS_PER_DAY,
    ) + 1,
  );

  const to = new Date(current.from);
  to.setDate(to.getDate() - 1);

  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));

  return { from: startOfDay(from), to: endOfDay(to) };
};

// --------------------------------------------------
// السنة الدراسية
//
// لها `startDate` و `endDate` في المخطّط، فلا تُشتقّ حدودُها من
// اسمها ولا يُفترض أنّها تبدأ في سبتمبر. المؤسسةُ تضبطها.
// --------------------------------------------------

export type AcademicYearBounds = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
};

export const academicYearRange = (year: AcademicYearBounds): DateRange => ({
  from: startOfDay(year.startDate),
  to: endOfDay(year.endDate),
});

/**
 * أشهرُ السنة الدراسية بالترتيب — محورُ السلاسل الزمنية.
 *
 * يُولَّد من الحدود لا من افتراضِ اثني عشر شهراً: السنةُ قد تكون
 * تسعةَ أشهر، والرسمُ البياني يجب أن يعرض أشهرَها هي لا أشهرَ
 * التقويم.
 */
export const academicYearMonths = (year: AcademicYearBounds): YearMonth[] => {
  const first = yearMonthOf(year.startDate);
  const last = yearMonthOf(year.endDate);
  const span = monthsBetween(first, last);

  if (span < 0) return [first];

  return Array.from({ length: span + 1 }, (_, index) =>
    addMonths(first, index),
  );
};

/**
 * هل الفاتورةُ سابقةٌ لفترة المرجع؟ — أساسُ «الدَّين القديم» (§25).
 *
 * المقارنةُ على حقلَي الأعمال، فالفاتورةُ المُدخَلة متأخّرةً تُنسب
 * إلى شهرها لا إلى يوم إدخالها.
 */
export const isBeforePeriod = (
  invoice: YearMonth,
  reference: YearMonth,
): boolean => monthsBetween(invoice, reference) > 0;

// --------------------------------------------------
// بناءُ الفترة
// --------------------------------------------------

export const monthPeriod = (
  yearMonth: YearMonth,
  academicYearId?: string,
): Period => ({
  kind: "month",
  yearMonth,
  range: monthRange(yearMonth),
  academicYearId,
  label: yearMonthKey(yearMonth),
});

export const rangePeriod = (
  from: Date,
  to: Date,
  academicYearId?: string,
): Period => ({
  kind: "range",
  range: { from: startOfDay(from), to: endOfDay(to) },
  academicYearId,
  label: `${startOfDay(from).toISOString().slice(0, 10)} → ${endOfDay(to)
    .toISOString()
    .slice(0, 10)}`,
});

export const academicYearPeriod = (year: AcademicYearBounds): Period => ({
  kind: "academicYear",
  range: academicYearRange(year),
  academicYearId: year.id,
  label: year.name,
});
