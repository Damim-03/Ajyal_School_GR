/**
 * نظام المواد والضبابية.
 *
 * المشكلة التي يحلّها: كانت قيم `backdrop-filter: blur(10px)` و`bg-black/55`
 * مبعثرة في المكوّنات، فلكلّ نافذة زجاجها الخاص. المادة هنا وصف واحد
 * متماسك (شفافية + ضبابية + حدّ + ظلّ) يُستهلك كوحدة.
 *
 * أربع درجات ضبابية لا واحدة — لأن لكلٍّ غرضاً مختلفاً، والضبابية أغلى
 * تأثير على المعالج الرسومي فلا تُنثر بلا حساب (§performance).
 */

/** درجات الضبابية بالبكسل — تصاعدياً حسب الغرض. */
export const blur = {
  /** فصل بسيط بين سطحين متجاورين. */
  surface: 6,
  /** الزجاج المعتاد: ألواح وبطاقات فوق خلفية. */
  glass: 12,
  /** طبقة تحجب ما تحتها لتنقل الانتباه (خلفية النافذة). */
  overlay: 16,
  /** أقصى ما نسمح به — لوح النافذة نفسه فقط. */
  dialog: 20,
} as const;

export type BlurLevel = keyof typeof blur;

/** CSS جاهز للضبابية مع بادئة webkit (مطلوبة في WebView2). */
export const blurStyle = (level: BlurLevel) => ({
  backdropFilter: `blur(${blur[level]}px)`,
  WebkitBackdropFilter: `blur(${blur[level]}px)`,
});

/**
 * المواد — كل واحدة وصف كامل لسطح.
 * `elevation` رقم دلالي للترتيب البصري، لا قيمة CSS.
 */
export const material = {
  /** سطح الصفحة الأساسي — بلا زجاج. */
  surface: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    blur: null,
    shadow: "none",
    elevation: 0,
  },
  /** لوح زجاجي: بطاقات الإجراءات وما شابهها. */
  glass: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.10)",
    blur: "glass" as BlurLevel,
    shadow: "0 8px 24px rgba(0,0,0,0.28)",
    elevation: 1,
  },
  /** عنصر مرتفع فوق محيطه (بلاطة مركَّزة، شريحة). */
  elevated: {
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.16)",
    blur: "surface" as BlurLevel,
    shadow: "0 18px 44px rgba(0,0,0,0.55)",
    elevation: 2,
  },
  /** حجاب خلف نافذة. */
  overlay: {
    background: "rgba(4,6,12,0.55)",
    border: "none",
    blur: "overlay" as BlurLevel,
    shadow: "none",
    elevation: 3,
  },
  /** لوح النافذة نفسه. */
  dialog: {
    background: "rgba(22,24,30,0.88)",
    border: "1px solid rgba(255,255,255,0.09)",
    blur: "dialog" as BlurLevel,
    shadow: "0 24px 64px rgba(0,0,0,0.6)",
    elevation: 4,
  },
} as const;

export type MaterialName = keyof typeof material;

/**
 * يحوّل مادة إلى أنماط CSS جاهزة.
 *
 * `glass: false` يُسقط الضبابية وحدها ويُبقي كل شيء آخر — أداة تنفيذ
 * §44/§45: حين يضيق وقت الإطار تُخفَّض **جودة البيئة** لا جودة التفاعل.
 *
 * لماذا هذا المفتاح موجود أصلاً: `backdrop-filter` أغلى تأثير في CSS —
 * يفرض على المتصفّح التقاط ما خلف العنصر ثم ضبابه في تمريرة مستقلّة، ولا
 * يُركَّب على المعالج الرسومي كما تُركَّب الشفافية والتحويل. وثلاث بطاقات
 * تحمله وتُعاد تركيبها مع كل تنقّل تعني ثلاث تمريرات جديدة عشرَ مرّات في
 * الثانية. قِسته: انهار معدّل الإطارات من 60 إلى 3 أثناء التنقّل المتواصل.
 */
export function materialStyle(
  name: MaterialName,
  opts?: { glass?: boolean },
): React.CSSProperties {
  const m = material[name];
  const glass = opts?.glass ?? true;
  return {
    background: m.background,
    border: m.border === "none" ? undefined : m.border,
    boxShadow: m.shadow === "none" ? undefined : m.shadow,
    ...(m.blur && glass ? blurStyle(m.blur) : {}),
  };
}
