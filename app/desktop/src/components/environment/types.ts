/**
 * أنواعُ المشهد السينمائي.
 *
 * المحورُ الذي يقوم عليه كلُّ شيء هو `depth` — بُعدُ الجسيم عن الكاميرا،
 * صفرٌ في الأفق وواحدٌ عند العدسة. ومنه تُشتقّ ستُّ صفاتٍ لا صفةٌ واحدة:
 * الحجم، والسطوع، ودرجةُ الضبابة، وسرعةُ الانجراف، وقوّةُ البارالاكس،
 * وبهتانُ المسافة. ولو كانت كلُّها مستقلّةً لخرج حقلُ نجومٍ مسطّح — إذ
 * لا شيء في الصورة يقول إنّ هذه أقربُ من تلك.
 */

export type Quality = "low" | "medium" | "high";

/**
 * جسيمُ غبارٍ مضاء.
 *
 * كائنٌ يُنشأ مرّةً ويُعاد استعماله إلى آخر الجلسة: الحلقةُ تعمل ستّين
 * مرّةً في الثانية، وتخصيصُ ألفِ كائنٍ في كلّ إطارٍ يُشغّل جامعَ القمامة
 * فيظهر تلعثمٌ دوريّ في مشهدٍ يُفترض أن يكون ساكناً.
 */
export interface Particle {
  x: number;
  y: number;
  /** البعد [0..1] — منه تُشتقّ الصفات كلُّها */
  z: number;
  vx: number;
  vy: number;
  /** نصفُ القطر بالبكسل المنطقي قبل ضربه في البعد */
  size: number;
  opacity: number;
  /** الميلُ إلى الدفء [0..1] — صفرٌ رماديٌّ بارد، وواحدٌ أبيضُ دافئ */
  warmth: number;
  brightness: number;
  /** طورُ الوميض — مبعثرٌ عند الإنشاء كي لا تتنفّس الجسيمات معاً */
  phase: number;
  twinkleSpeed: number;
  /** أيُّ فرشاةٍ تُرسم بها — تُختار مرّةً بحسب البعد */
  sprite: SpriteKind;
}

/**
 * الفرشاة — صورةٌ مُهيّأةٌ سلفاً تُرسم بـ`drawImage`.
 *
 * ولا تدرّجٌ يُبنى لكلّ جسيمٍ في كلّ إطار: ألفُ `createRadialGradient`
 * ستّين مرّةً في الثانية تُغرق الخيط الرئيسي. والضبابةُ الحقيقية تأتي
 * من شكل الفرشاة نفسها لا من `filter: blur` — وذاك يُعيد رسم الطبقة
 * كلَّها على وحدة المعالجة.
 */
export type SpriteKind = "sharp" | "soft" | "glow" | "bokeh";

/** جسيمٌ في المقدّمة — قرصٌ كبيرٌ خارجَ بؤرة العدسة */
export interface BokehParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  warmth: number;
  phase: number;
  driftSpeed: number;
}

/** كتلةُ ضبابٍ منخفضةُ التردّد — تنجرف ببطءٍ وتتنفّس */
export interface HazeBlob {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  opacity: number;
  /** زاويةُ الميل — الضبابةُ إهليلجيةٌ مائلة لا دائرةٌ صريحة */
  angle: number;
  phase: number;
  speed: number;
  drift: number;
  warmth: number;
}

/** شعاعٌ حجميّ من مصدر الضوء */
export interface LightRay {
  /** الزاويةُ بالتقدير الدائري من مصدر الضوء */
  angle: number;
  /** نصفُ عرض الشعاع عند طرفه البعيد، نسبةً إلى القطر */
  spread: number;
  length: number;
  opacity: number;
  phase: number;
  speed: number;
}

/** أبعادُ سطح الرسم — بالبكسل المنطقي، لا بكسل الجهاز */
export interface Viewport {
  width: number;
  height: number;
  /** أصغرُ البعدين — به تُقاس الأحجام فلا تتشوّه بتغيّر النسبة */
  min: number;
  dpr: number;
}

export interface QualityPreset {
  particles: number;
  bokeh: number;
  haze: number;
  rays: number;
  /** سقفُ نسبة بكسل الجهاز — الرسمُ بـ3x على شاشةٍ كبيرة يُهلك الأداء */
  maxDPR: number;
}

export interface SceneOptions {
  quality: Quality;
  /** شدّةٌ عامّة [0..1] — بها تُكشف الخلفية تدريجياً أو تُخفَت */
  intensity: number;
  /** يُجمَّد المشهد على إطارٍ واحد — احتراماً لتفضيل تقليل الحركة */
  reducedMotion: boolean;
}
