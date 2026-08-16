/**
 * AMBIENT_CONFIG — كل الأرقام البصرية في مكان واحد (بلا أرقام سحرية متناثرة).
 * البيئة: غرفة مظلمة عميقة، ضوء حجميّ من أعلى اليسار، توهّج سفلي بارد، وغبار طافٍ.
 */

/** مصدر الضوء بإحداثيات معيارية (خارج الإطار أعلى اليسار). */
export const LIGHT_ORIGIN = { x: -0.10, y: -0.22 } as const;

/** مدى وصول الضوء (معياري) — بعده يخفت الإضاءة تماماً. */
export const LIGHT_REACH = 1.15;

export const PALETTE = {
  deepest: "#050914",
  navy: "#080D19",
  navy2: "#0B101D",
  charcoal: "#111722",
  charcoal2: "#151B25",
  litGray: "#252C34",
  litGray2: "#303740",
  warmLight: "#C7A58F",
  warmLight2: "#D4B59E",
  cold: [183, 200, 232] as [number, number, number], // #B7C8E8
  cold2: [216, 228, 245] as [number, number, number], // #D8E4F5
  warm: [214, 163, 106] as [number, number, number], // #D6A36A
  warm2: [224, 179, 123] as [number, number, number], // #E0B37B
  neutral: [226, 232, 240] as [number, number, number],
} as const;

export type Quality = "low" | "medium" | "high";
export type AmbientState = "idle" | "connecting" | "success" | "error";

export interface QualityPreset {
  /** كثافة الجسيمات لكل مليون بكسل (تُضرب في مساحة اللوحة). */
  particlesPerMegapixel: number;
  bokehEnabled: boolean;
  hazeEnabled: boolean;
  raysEnabled: boolean;
  noiseEnabled: boolean;
  /** أقصى عدد جسيمات مهما كبرت الشاشة (حماية الأداء). */
  maxParticles: number;
}

export const QUALITY_PRESETS: Record<Quality, QualityPreset> = {
  high: { particlesPerMegapixel: 115, bokehEnabled: true, hazeEnabled: true, raysEnabled: true, noiseEnabled: true, maxParticles: 340 },
  medium: { particlesPerMegapixel: 70, bokehEnabled: true, hazeEnabled: true, raysEnabled: true, noiseEnabled: false, maxParticles: 200 },
  low: { particlesPerMegapixel: 28, bokehEnabled: false, hazeEnabled: false, raysEnabled: true, noiseEnabled: false, maxParticles: 60 },
};

export const AMBIENT_CONFIG = {
  /** أقصى نسبة بكسل الجهاز — حماية من الرسم بدقّة 4x على شاشات HiDPI. */
  maxDPR: 2,

  particles: {
    /** نِسَب الفئات (المجموع 1). */
    mix: { micro: 0.40, medium: 0.26, warm: 0.20, bokeh: 0.14 },
    radius: {
      micro: [0.5, 1.5] as [number, number],
      medium: [1.5, 3.0] as [number, number],
      warm: [1.2, 2.6] as [number, number],
      bokeh: [6.0, 18.0] as [number, number],
    },
    /** سرعات معيارية (بكسل/إطار عند 60fps). */
    vx: [-0.02, 0.05] as [number, number],
    vy: [-0.08, 0.02] as [number, number],
    life: [8, 30] as [number, number], // ثوانٍ
    /** أقصى شفافية لكل فئة. */
    alpha: { micro: 0.5, medium: 0.72, warm: 0.8, bokeh: 0.4 },
    /** تذبذب جيبيّ خفيف. */
    swayAmplitude: [0.05, 0.35] as [number, number],
    swaySpeed: [0.08, 0.28] as [number, number],
  },

  /** التدفّق الأفقي الاختياري (وسط/أسفل الوسط). */
  flow: {
    ratio: 0.09, // نسبة من الجسيمات
    speed: [0.18, 0.45] as [number, number],
    bandY: [0.46, 0.76] as [number, number], // نطاق رأسي معياري
  },

  /** قوّة إزاحة الماوس لكل طبقة (بكسل). */
  parallax: { base: 3, haze: 7, particlesNear: 9, damping: 0.06 },

  /** مدّة ظهور البيئة عند الإقلاع (مللي ثانية). */
  intro: { canvasFadeMs: 2200, canvasDelayMs: 900 },

  /** استجابة الحالات. */
  states: {
    pulseMs: 1100,
    successMs: 1600,
  },
} as const;
