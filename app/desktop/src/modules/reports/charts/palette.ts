// ======================================================
// ألوانُ الرسوم — §46 و§45
//
// قاعدتان تحكمان هذا الملف:
//
//   1. **اللونُ لا يشرح وحده.** §46 صريح: اللونُ مع أيقونةٍ ونصّ.
//      فالأحمرُ هنا يؤكّد «متبقّي» ولا يعرّفه — والعمودُ الأحمر بلا
//      عنوانٍ لا يقول شيئاً لمن لا يميّز الألوان، وهم واحدٌ من كلّ
//      اثني عشر رجلاً.
//
//   2. **ألوانٌ قليلة هادئة.** §45 يمنع «ألواناً كثيرة». والقائمةُ
//      الصنفية ستّةٌ لا اثنا عشر: رسمٌ بعشرة ألوانٍ لا يُقرأ، ومَن
//      احتاج أكثر فمشكلتُه في عدد الفئات لا في القائمة.
//
// والقيمُ مكتوبةٌ هنا لا في CSS لأنّ SVG يحتاجها قيمةً وقتَ الرسم —
// و`var(--x)` داخل `fill` يعمل في المتصفّح ويسقط عند تصدير الرسم
// صورةً (`html-to-image` المستعمَل في المشروع) فتخرج أشكالٌ سوداء.
// ======================================================

/**
 * الدلالات — §46.
 *
 * أربعٌ لا أكثر: موجب، تحذير، خطر، محايد. وكلُّ ما يُعرض يقع في
 * واحدةٍ منها أو يبقى محايداً.
 */
/*
 * القيمُ مضيئةٌ لا داكنة: التطبيقُ كلُّه على `#05070d`.
 *
 * والألوانُ الداكنة التي تصلح على ورقةٍ بيضاء تختفي على هذه
 * الخلفية — `#0f766e` عليها بقعةٌ لا لون. فكلُّ قيمةٍ هنا مختارةٌ
 * لتباينها مع الأسود لا مع الأبيض.
 */
export const SEMANTIC = {
  /** المحصَّل، الحضور، المدفوع */
  positive: "#4ade80",
  /** المعذور، المعلَّق، ما يستحقّ النظر */
  warning: "#fbbf24",
  /** الدَّين، الغياب، الملغى */
  danger: "#fb7185",
  /** المفوتر، الأعداد، ما لا حكمَ عليه */
  neutral: "#94a3b8",
} as const;

export type SemanticTone = keyof typeof SEMANTIC;

/**
 * القائمةُ الصنفية — للفئات التي لا دلالةَ لها.
 *
 * مواد، أفواج، أساتذة: لا لونَ «صحيحاً» لمادّة الرياضيات. فتُؤخذ
 * بالترتيب، وتُعاد من أوّلها إن زادت الفئاتُ على ستّ.
 *
 * وتدرّجُها مقصود: الأوّلُ أغمقُ وأقوى، ثمّ تخفّ. فالفئةُ الأولى —
 * وهي الأكبرُ دائماً لأنّ الرسوم مرتَّبة — تأخذ اللونَ الأوضح.
 */
export const CATEGORICAL = [
  "#86efac",
  "#a5b4fc",
  "#fbbf24",
  "#f9a8d4",
  "#67e8f9",
  "#c4b5fd",
] as const;

/**
 * لونُ سلسلةٍ بحسب مفتاحها.
 *
 * المفاتيحُ المعروفة تأخذ دلالتَها، وما عداها يأخذ من القائمة
 * الصنفية بترتيبه. فسلسلةُ «المحصَّل» خضراءُ في كلّ شاشةٍ تظهر
 * فيها — واتّساقُ اللون عبر الشاشات جزءٌ من قابلية القراءة، إذ
 * يتعلّم المستخدمُ الرمزَ مرّةً واحدة.
 */
const SERIES_TONE: Record<string, SemanticTone> = {
  collected: "positive",
  paid: "positive",
  allocated: "positive",
  present: "positive",

  outstanding: "danger",
  remaining: "danger",
  absent: "danger",
  debt: "danger",
  cancelled: "danger",

  late: "warning",
  excused: "warning",
  pending: "warning",

  invoiced: "neutral",
  count: "neutral",
  students: "neutral",
  amount: "neutral",
};

export const seriesColor = (key: string, index: number): string => {
  const tone = SERIES_TONE[key];

  if (tone) return SEMANTIC[tone];

  return CATEGORICAL[index % CATEGORICAL.length];
};

/**
 * لونُ فئةٍ داخل سلسلةٍ واحدة — للحلقة والأعمدة الأفقية.
 *
 * الحلقةُ تعرض فئاتٍ لا سلاسل، فيؤخذ اللونُ بترتيب الفئة. وحالاتُ
 * الفواتير والحضور استثناء: لها دلالةٌ معروفة تُقرأ أسرعَ من أيّ
 * ترتيب.
 */
const CATEGORY_TONE: Record<string, SemanticTone> = {
  حاضر: "positive",
  غائب: "danger",
  "متأخّر": "warning",
  معذور: "warning",
  "مسدَّدة": "positive",
  "مسدَّدة جزئياً": "warning",
  "معلَّقة": "warning",
  ملغاة: "danger",
  نشط: "positive",
  "ملغى": "danger",
  "أُعيد طبعه": "warning",
  مجدولة: "neutral",
  مكتملة: "positive",
};

export const categoryColor = (label: string, index: number): string => {
  const tone = CATEGORY_TONE[label];

  if (tone) return SEMANTIC[tone];

  return CATEGORICAL[index % CATEGORICAL.length];
};

/**
 * ألوانُ الهيكل — لا ألوانُ البيانات.
 *
 * خافتةٌ عمداً: §45 يمنع «borders في كل مكان». وخطوطُ الشبكة تُرى
 * حين يُبحث عنها ولا تُزاحم المنحنى.
 */
export const CHART_INK = {
  grid: "rgba(255,255,255,0.07)",
  axis: "rgba(255,255,255,0.18)",
  label: "rgba(255,255,255,0.45)",
  strongLabel: "#ffffff",
  surface: "rgba(255,255,255,0.03)",
} as const;

/**
 * اتّجاهُ المؤشّر لوناً — §46 و§70.
 *
 * ارتفاعُ الدَّين أحمرُ وارتفاعُ التحصيل أخضر، والاثنان «ارتفاع».
 * فاللونُ يتبع المعنى لا الإشارة — والاعتمادُ على الإشارة وحدها
 * كان سيصبغ انخفاضَ الدَّين أحمرَ وهو خبرٌ سارّ.
 */
export const changeTone = (
  delta: number,
  direction: "higherIsBetter" | "lowerIsBetter" | "neutral",
): SemanticTone => {
  if (delta === 0 || direction === "neutral") return "neutral";

  const improved = direction === "higherIsBetter" ? delta > 0 : delta < 0;

  return improved ? "positive" : "danger";
};
