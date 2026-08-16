/**
 * المال — كتابةً وقراءة.
 *
 * كانت في التطبيق أربع نسخٍ من دالّة `money` تفعل الشيء نفسه بأربع
 * صيغ، وثلاثٌ منها تُدوّر المبلغ إلى عددٍ صحيح (`Math.round`) بينما
 * العمود في قاعدة البيانات `Decimal(10,2)`. فسعرُ 1500.50 يظهر
 * «1 501 دج» في شاشة ويُحفظ 1500.50 في أخرى — والفرقُ نصفُ دينار
 * يتراكم في كل فاتورة ولا يُفسَّر.
 *
 * فالكتابة هنا واحدة: **رقمان بعد الفاصلة دائماً، والفاصلة نقطة،
 * والأرقام لاتينية، والعملة بعدها**. ولا تدوير — ما في القاعدة هو ما
 * يُعرض.
 *
 * والاتجاه مقصود: المبلغ يُلفّ بـ dir="ltr" حيث يُعرض، لأنّ خلط رقمٍ
 * بنصٍّ عربي يقلب ترتيب «1500.00 دج» على الشاشة في بعض المواضع.
 */

/** رمز العملة الافتراضي — يُستبدل بما في هوية المدرسة حيثما توفّر */
export const DEFAULT_CURRENCY = "دج";

/** الأرقام العربية الهندية والفارسية → لاتينية */
const toLatinDigits = (text: string) =>
  text.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;

    return String(code - base);
  });

const toAmount = (value: number | string | null | undefined): number => {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);

  return Number.isFinite(amount) ? amount : 0;
};

/**
 * فاصل الآلاف — فاصلةٌ لاتينية كل ثلاث خانات.
 *
 * والفاصلة لا المسافة: الكشوف تُطبع وتُصوَّر وتُرسل، والمسافةُ تنكسر
 * عند التفاف السطر فيصير «11 625» رقمين. والكسر بنقطةٍ فلا يلتبس
 * أحدُهما بالآخر — «11,625.00» يُقرأ وجهاً واحداً.
 */
const group = (whole: string): string =>
  whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * 1500 → «1,500.00 دج» · 8718.75 → «8,718.75 دج»
 *
 * منزلتان دائماً ولا تدوير — ما في القاعدة `Decimal(10,2)` هو ما
 * يُعرض. والعملة بعد الرقم، والمبلغ يُلفّ بـ`dir="ltr"` حيث يُعرض
 * لأنّ خلط رقمٍ بنصٍّ عربي يقلب ترتيبه على الشاشة.
 */
export const formatMoney = (
  value: number | string | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): string => {
  const [whole, fraction] = toAmount(value).toFixed(2).split(".");

  return `${group(whole!)}.${fraction} ${currency}`;
};

/** المبلغ وحده بلا عملة — بفاصل الآلاف، لأعمدة الكشوف والطباعة */
export const formatAmount = (value: number | string | null | undefined): string => {
  const [whole, fraction] = toAmount(value).toFixed(2).split(".");

  return `${group(whole!)}.${fraction}`;
};

/**
 * المبلغ خاماً بلا فاصل آلاف — لخانات الإدخال وحدها.
 *
 * الحقل يُعاد كتابتُه عند الخروج منه بما سيُحفظ، وإدخالُ الفاصلة فيه
 * يجعل ما يُقرأ يخالف ما يُرسل. والعرضُ شيءٌ والإدخال شيء.
 */
export const formatInputAmount = (
  value: number | string | null | undefined,
): string => toAmount(value).toFixed(2);

/**
 * ما يكتبه المستخدم → رقم، أو `null` إن لم يكن مبلغاً.
 *
 * يقبل ما تكتبه اليد فعلاً: «1500» و«1500.5» و«1500,5» و«١٥٠٠» ومعها
 * المسافات ورمز العملة. ويرفض ما عداه صراحةً بدل أن يُنتج `NaN` يمرّ
 * إلى الخادم فيرتدّ برسالةٍ غامضة.
 */
export const parseMoney = (input: string): number | null => {
  const raw = toLatinDigits(input).trim();

  // والسالب ليس مبلغاً — وابتلاعُ إشارته يجعل «-500» يُحفظ 500 صامتاً
  if (raw.startsWith("-")) return null;

  /*
   * ما نكتبه نحن يجب أن نقبله نحن.
   *
   * الكشوف صارت تعرض «11,625.00» بفاصل آلاف، فمن نسخ رقماً من كشفٍ
   * إلى حقلٍ كان يُردّ عليه «ليس مبلغاً». والقاعدة حين تجتمع الفاصلة
   * والنقطة: **الأخيرةُ فاصلةُ الكسر وما قبلها فواصلُ آلاف** — فتُقرأ
   * «1,500.50» و«1.500,50» كلتاهما 1500.50.
   *
   * وتُفحص الفواصل أنّها ثلاثيةٌ فعلاً: «18,75.00» ليست رقماً مجموعاً
   * بل خلطٌ بين الاصطلاحين، فتبقى مرفوضةً كما كانت.
   */
  const kept = raw.replace(/[^\d.,٫]/g, "");
  const lastDot = kept.lastIndexOf(".");
  const lastComma = Math.max(kept.lastIndexOf(","), kept.lastIndexOf("٫"));

  if (lastDot >= 0 && lastComma >= 0) {
    const at = Math.max(lastDot, lastComma);
    const whole = kept.slice(0, at);
    const fraction = kept.slice(at + 1);

    if (!/^\d{1,3}(?:[.,٫]\d{3})*$/.test(whole)) return null;
    if (!/^\d+$/.test(fraction)) return null;

    const grouped = Number(`${whole.replace(/[.,٫]/g, "")}.${fraction}`);

    return Number.isFinite(grouped) ? grouped : null;
  }

  const cleaned = toLatinDigits(input)
    .replace(/[\s  ]/g, "")
    /*
     * الفاصلة العربية `٫` تُحوَّل كنظيرتها اللاتينية لا تُحذف.
     *
     * وحذفُها كان يقع صامتاً ويُكلّف مئةَ ضعف: من كتب «١٨٫٧٥» بالأرقام
     * الهندية — وهي التي تُكتب بها هذه الفاصلة أصلاً — كان مبلغُه
     * يُحفظ 1875. ولا رسالةَ خطأ، لأنّ الناتج رقمٌ صحيحُ الشكل.
     *
     * أمّا فاصلة الآلاف `٬` فتُحذف مع ما يُحذف، وهو الصواب فيها.
     */
    .replace(/[,٫]/g, ".")
    .replace(/[^\d.]/g, "");

  if (!cleaned || cleaned === ".") return null;

  // فاصلتان لا معنى لهما — «1.500.00» خطأٌ لا مبلغ
  if ((cleaned.match(/\./g) ?? []).length > 1) return null;

  const value = Number(cleaned);

  return Number.isFinite(value) ? value : null;
};

/** يُقرَّب إلى قرشين — كما يُحفظ في `Decimal(10,2)` */
export const roundMoney = (value: number) => Math.round(value * 100) / 100;
