// ======================================================
// مقاييسُ الرسوم — §60
//
// هذا هو الجزءُ الذي تُعطيه المكتباتُ مجّاناً، وهو سببُ اختبارِ هذا
// الملفّ وحدَه من بين ملفّات الرسوم: الباقي هندسةٌ مباشرة، وهذا
// حسابٌ يُخطئ بصمت — محورٌ حدُّه 97 بدل 100 يُنتج رسماً صحيحَ
// النسب قبيحَ التدريج، ومحورٌ لا يشمل أكبرَ قيمة يقصّ عموداً.
// ======================================================

/**
 * حدودُ المحور: من أين يبدأ وأين ينتهي وبأيّ خطوة.
 */
export interface AxisScale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/**
 * تقريبٌ إلى «رقمٍ جميل»: 1 أو 2 أو 2.5 أو 5 أو 10 مضروبةً في قوّة عشرة.
 *
 * والغرضُ أن يقرأ الإنسانُ التدريجَ بلا حساب: محورٌ خطوتُه 2500
 * يُقرأ فوراً، وخطوتُه 2437 لا تُقرأ أصلاً. وهذه هي الخوارزمية
 * المتعارَفة في أدوات الرسم منذ عقود.
 */
const niceNumber = (value: number, round: boolean): number => {
  if (value <= 0) return 1;

  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;

  let nice: number;

  if (round) {
    if (fraction < 1.5) nice = 1;
    else if (fraction < 3) nice = 2;
    else if (fraction < 7) nice = 5;
    else nice = 10;
  } else {
    if (fraction <= 1) nice = 1;
    else if (fraction <= 2) nice = 2;
    else if (fraction <= 5) nice = 5;
    else nice = 10;
  }

  return nice * 10 ** exponent;
};

/**
 * بناءُ مقياسٍ يشمل كلَّ القيم وينتهي عند رقمٍ مقروء.
 *
 * `desiredTicks` رغبةٌ لا أمر: الخوارزميةُ تُقرّب الخطوةَ إلى رقمٍ
 * جميل، فقد يخرج العددُ الفعليُّ أكثرَ أو أقلَّ بواحد. وإجبارُه على
 * عددٍ ثابت يُنتج خطواتٍ قبيحة — والمقروئيةُ أولى.
 */
export const linearScale = (
  values: (number | null)[],
  desiredTicks = 5,
): AxisScale => {
  const present = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );

  /*
   * لا قيمَ: مقياسٌ من صفر إلى واحد.
   *
   * ولا يُترك فارغاً ولا يُرمى استثناء — الرسمُ الفارغ يُرسم بمحوره
   * وتُعرض فوقه حالةُ §48، فيبقى للشاشة هيكلٌ مفهوم بدل فراغٍ
   * يُظنّ عطباً.
   */
  if (present.length === 0) {
    return { min: 0, max: 1, step: 1, ticks: [0, 1] };
  }

  const dataMin = Math.min(...present);
  const dataMax = Math.max(...present);

  /*
   * القاعدةُ صفرٌ ما لم تكن هناك قيمٌ سالبة.
   *
   * ومحورٌ يبدأ من أدنى قيمةٍ لا من الصفر يضخّم الفروقَ بصرياً:
   * عمودان قيمتاهما 980 و1000 يظهران بفارق الضِّعف إن بدأ المحور
   * من 970. وهذا تضليلٌ لا تحسينٌ للعرض — §45 يطلب رسوماً تُقرأ
   * لا رسوماً تُبهر.
   */
  const min = dataMin < 0 ? dataMin : 0;
  const max = dataMax > 0 ? dataMax : 0;

  /*
   * مدىً صفريّ: كلُّ القيم متساوية (أو كلُّها صفر).
   *
   * فيُعطى المحورُ مدىً اصطناعياً حتى لا تُقسَم على صفر، ويُرسم
   * الخطُّ في وسط الرقعة أو على قاعدتها.
   */
  if (max === min) {
    const span = max === 0 ? 1 : Math.abs(max);
    const step = niceNumber(span, true);

    return {
      min: min === 0 ? 0 : min - step,
      max: max + step,
      step,
      ticks: min === 0 ? [0, step] : [min - step, min, max + step],
    };
  }

  const roughStep = (max - min) / Math.max(1, desiredTicks);
  const step = niceNumber(roughStep, true);

  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;

  const ticks: number[] = [];

  /*
   * الضربُ لا الجمعُ المتراكم، **ثمّ** تقريبٌ إلى دقّة الخطوة.
   *
   * كتبتُ أوّلَ مرّة الضربَ وحده ظنّاً أنّه يكفي — وأسقط الاختبار
   * ذلك: `0.1 × 3` نفسها تساوي 0.30000000000000004 في الفاصلة
   * العائمة، فالضربُ يتفادى **تراكمَ** الخطأ لا الخطأَ نفسه.
   *
   * والدقّةُ تُشتقّ من الخطوة: خطوةٌ 0.1 تعني منزلةً واحدة، وخطوةٌ
   * 2500 تعني صفراً. فالتقريبُ لا يفقد معلومةً — يحذف ضجيجاً دون
   * المنزلة التي تحملها الخطوةُ أصلاً.
   */
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const factor = 10 ** decimals;
  const count = Math.round((niceMax - niceMin) / step);

  for (let index = 0; index <= count; index += 1) {
    ticks.push(Math.round((niceMin + index * step) * factor) / factor);
  }

  return { min: niceMin, max: niceMax, step, ticks };
};

/**
 * موضعُ قيمةٍ داخل الرقعة، من 0 (القاع) إلى 1 (القمّة).
 *
 * والقصُّ إلى [0,1] حارسٌ لا تجميل: قيمةٌ خارج المقياس تُنتج
 * إحداثيّاً خارج الرقعة، فيُرسم عمودٌ يخرج من الإطار ويغطّي
 * العنوان.
 */
export const ratioOf = (value: number, scale: AxisScale): number => {
  const span = scale.max - scale.min;

  if (span === 0) return 0;

  return Math.min(1, Math.max(0, (value - scale.min) / span));
};

/**
 * مواضعُ الفئات على المحور الصنفي.
 *
 * `bandWidth` عرضُ الشريحة الكاملة، و`center` مركزُها. والأعمدةُ
 * تُرسم داخل الشريحة بهامشٍ نسبيّ، فتبقى المسافاتُ متناسبةً مهما
 * تغيّر عددُ الفئات.
 */
export interface BandScale {
  bandWidth: number;
  center: (index: number) => number;
  start: (index: number) => number;
}

export const bandScale = (count: number, extent: number): BandScale => {
  const bandWidth = count > 0 ? extent / count : extent;

  return {
    bandWidth,
    center: (index) => bandWidth * index + bandWidth / 2,
    start: (index) => bandWidth * index,
  };
};

// ======================================================
// التنسيق
// ======================================================

/**
 * اختصارُ الأرقام الكبيرة في المحور.
 *
 * محورٌ علاماتُه «980000» و«1200000» يزدحم ويُقصّ. و«980 ألف»
 * تُقرأ في لمحة.
 *
 * والاختصارُ للمحور وحده: البطاقاتُ والجداول تعرض الرقم كاملاً،
 * لأنّ «980 ألف» في بطاقةِ إيرادٍ تُخفي 437 ديناراً قد تُسأل عنها.
 */
export const compactNumber = (value: number): string => {
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number(millions.toFixed(millions >= 10 ? 0 : 1))} م`;
  }

  if (abs >= 1_000) {
    const thousands = value / 1_000;
    return `${Number(thousands.toFixed(thousands >= 10 ? 0 : 1))} ألف`;
  }

  return String(Number(value.toFixed(2)));
};

/** الرقمُ كاملاً بفواصل الآلاف — للبطاقات والتلميحات */
export const fullNumber = (value: number): string =>
  new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(value);

export const formatByUnit = (
  value: number | null,
  unit: "count" | "money" | "percent" | "ratio",
  compact = false,
): string => {
  /*
   * `null` تُعرض شرطةً لا صفراً — §48.
   *
   * «0%» تعني «حُسبت فكانت صفراً»، و«—» تعني «لا معنى لنسبةٍ هنا».
   * والخلطُ بينهما يجعل فوجاً لم يبدأ الدراسة يبدو أسوأَ الأفواج
   * حضوراً.
   */
  if (value === null) return "—";

  if (unit === "percent") return `${Number(value.toFixed(2))}%`;

  const text = compact ? compactNumber(value) : fullNumber(value);

  return unit === "money" ? `${text} دج` : text;
};
