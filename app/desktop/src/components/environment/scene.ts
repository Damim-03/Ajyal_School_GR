/**
 * المنسّق — يملك اللوحة والحلقة، ويستدعي الأنظمة بترتيب الطبقات.
 *
 * **وهو خارجُ React تماماً.** لا حالةَ تتحدّث في كلّ إطار، ولا تصييرَ
 * يُطلَب ستّين مرّةً في الثانية. React يُنشئ هذا الكائن مرّةً ويُمرّر
 * إليه خياراتٍ عالية المستوى (الشدّة، الجودة، تقليل الحركة)، والباقي
 * يجري هنا على `requestAnimationFrame`.
 *
 * ترتيبُ الرسم مقصود:
 *
 *   القاع → المصدر → الأشعّة → الضباب → الغبار → حجابُ القاع → الوهج
 *
 * الضبابُ **تحت** الغبار ليُرى الغبار من خلاله، وحجابُ القاع **فوقه**
 * ليخفت ما بعُد — وهو المنظور الجوّي مطبَّقاً على المشهد لا على الجسيم.
 */

import { AtmosphereSystem } from "./atmosphereSystem";
import { LightingSystem } from "./lightingSystem";
import { ParticleSystem } from "./particleSystem";
import type { Quality, QualityPreset, SceneOptions, Viewport } from "./types";

export const QUALITY: Record<Quality, QualityPreset> = {
  high: { particles: 1800, bokeh: 18, haze: 8, rays: 4, maxDPR: 2 },
  medium: { particles: 1000, bokeh: 11, haze: 6, rays: 3, maxDPR: 1.75 },
  low: { particles: 420, bokeh: 6, haze: 4, rays: 3, maxDPR: 1.25 },
};

/**
 * جودةٌ تُخمَّن من قدرة الجهاز.
 *
 * ولا قياسَ لمعدّل الإطارات ثمّ خفضٌ عند التعثّر: ذلك يُري المستخدم
 * ثوانيَ متلعثمةً أوّلَ ما يفتح الشاشة، وأوّلُ انطباعٍ في شاشة إقلاعٍ
 * لا يُصلَح بعده. فالتقديرُ قبليٌّ ومتحفّظ.
 */
export const detectQuality = (): Quality => {
  const cores = navigator.hardwareConcurrency ?? 4;
  const dpr = window.devicePixelRatio ?? 1;
  const pixels = window.screen.width * window.screen.height * dpr * dpr;

  if (cores <= 2 || pixels > 12_000_000) return "low";
  if (cores <= 4 || pixels > 6_000_000) return "medium";

  return "high";
};

/**
 * مولّدٌ عشوائيّ ببذرة.
 *
 * `Math.random` يعطي تركيباً مختلفاً في كلّ إقلاع، وقد يقع أحدُها
 * سيّئاً — تجمّعٌ في غير موضعه أو فراغٌ حيث ينبغي أن يكون ثقل. والبذرةُ
 * الثابتة تجعل التركيب الذي ضُبط هو الذي يُرى في كلّ مرّة.
 */
const seeded = (seed: number) => {
  let s = seed >>> 0;

  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;

    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

export class CinematicScene {
  private ctx: CanvasRenderingContext2D;
  private view: Viewport = { width: 1, height: 1, min: 1, dpr: 1 };

  private lighting = new LightingSystem();
  private atmosphere = new AtmosphereSystem();
  private particles = new ParticleSystem();

  private raf = 0;
  private last = 0;
  private clock = 0;
  /** الخطوةُ منعَّمة — تمتصّ ذبذبة طوابع الإطارات */
  private smoothed = 0;
  private running = false;

  private options: SceneOptions = { quality: "high", intensity: 1, reducedMotion: false };

  /**
   * الشدّةُ المعروضة — تلحق بالمطلوبة ولا تقفز إليها.
   *
   * `options.intensity` صارت **هدفاً** لا قيمةً فورية. وبدون هذا كان
   * إخفاتُ المشهد عند الخروج ومضةً: تُطفأ الأقراصُ والضبابُ والأشعّة
   * في إطارٍ واحد فيُرى القطعُ لا الانطفاء. والتدرّجُ يجعل الفضاءَ
   * يهدأ كما يهدأ ضوءٌ يُخفَّض بمنظّم.
   *
   * ويقع هنا لا في React: تغييرُ الشفافية ستّين مرّةً في الثانية عبر
   * حالةٍ يعني ستّين تصييراً — والحلقةُ تملكه أصلاً.
   */
  private shown = 1;

  /**
   * نسخةٌ واحدةٌ تُعاد كتابتُها كلَّ إطار.
   *
   * بناءُ كائنِ خياراتٍ جديدٍ في كلّ إطارٍ يُخصّص ستّين كائناً في
   * الثانية لأجل حقلٍ واحدٍ يتغيّر — وذلك ما تمنعه قاعدةُ «لا تخصيصَ
   * في الحلقة».
   */
  private frame$: SceneOptions = { quality: "high", intensity: 1, reducedMotion: false };

  /** موضعُ الزرّ رأسياً [0..1] — حوله يزداد إضاءةُ الغبار قليلاً */
  focusY = 0.52;

  constructor(private canvas: HTMLCanvasElement, options: Partial<SceneOptions> = {}) {
    const ctx = canvas.getContext("2d", { alpha: false });

    if (!ctx) throw new Error("تعذّر الحصول على سياق الرسم ثنائيّ الأبعاد");

    this.ctx = ctx;
    this.options = { ...this.options, ...options };

    this.build();
    this.resize();
  }

  private build() {
    const preset = QUALITY[this.options.quality];
    const random = seeded(0x5f3a91);

    this.particles.seed(preset.particles, preset.bokeh, random);
    this.atmosphere.seed(preset.haze, random);
    this.lighting.seedRays(preset.rays, random);
  }

  setOptions(next: Partial<SceneOptions>) {
    const rebuild = next.quality !== undefined && next.quality !== this.options.quality;

    this.options = { ...this.options, ...next };

    if (rebuild) {
      this.build();
      this.resize();
    }
  }

  setPointer(nx: number, ny: number) {
    this.particles.setPointer(nx, ny);
  }

  /**
   * التحجيم — وهنا وحدَه يُعاد بناءُ الطبقات المخبوءة.
   *
   * ونسبةُ البكسل مسقوفة: شاشةٌ 4K بنسبة 2 تعني رسمَ ثلاثةٍ وثلاثين
   * مليونَ بكسل في الإطار الواحد. والسقفُ يُنزل ذلك إلى ما يُرسم في
   * الوقت، والفرقُ لا يُرى في مشهدٍ قوامُه تدرّجاتٌ ناعمة.
   */
  resize() {
    const preset = QUALITY[this.options.quality];
    const dpr = Math.min(window.devicePixelRatio ?? 1, preset.maxDPR);

    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;

    this.view = { width, height, min: Math.min(width, height), dpr };

    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.lighting.resize(this.view);
    /* أوّلُ رسمٍ قبل دوران الحلقة — بلا لحاقٍ فيبدأ من الهدف مباشرة */
    this.shown = this.options.intensity;
    this.render(0);
  }

  start() {
    if (this.running) return;

    this.running = true;
    this.last = performance.now();
    /* استئنافٌ بعد توقّف: تُنسى الخطوةُ القديمة فلا تُحسب فجوةُ الغياب */
    this.smoothed = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;

    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    this.stop();
  }

  private frame = (now: number) => {
    if (!this.running) return;

    /*
     * سقفُ الخطوة: تبويبٌ عاد بعد دقيقةٍ يعطي `dt` هائلاً فتقفز
     * الجسيمات دفعةً واحدة. والسقفُ يجعلها تستأنف من حيث كانت.
     */
    const raw = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    /*
     * تنعيمُ الخطوة.
     *
     * طوابعُ `requestAnimationFrame` تتذبذب على ويندوز بضعةَ أجزاء من
     * الألف بين إطارٍ وآخر. والذبذبةُ لا تُرى في جسمٍ كبير، لكنّ الغبارَ
     * نقاطٌ بحجم بكسلين تتحرّك ببطء — فيظهر التفاوتُ ارتعاشاً دقيقاً في
     * مسارها. والمتوسّطُ الأسّي يمتصّه دون أن يُدخل تأخّراً محسوساً:
     * وزنُ الإطار الجديد 0.2، فيلحق الحركةَ في خُمس ثانية.
     */
    this.smoothed = this.smoothed === 0 ? raw : this.smoothed + (raw - this.smoothed) * 0.2;

    const dt = this.smoothed;
    this.clock += dt;

    /* لحاقُ الشدّة بهدفها — نحوَ ثلثَي ثانيةٍ إلى الاستقرار */
    this.shown += (this.options.intensity - this.shown) * Math.min(1, dt * 3.4);

    this.particles.update(dt, this.clock, this.options);
    this.render(this.clock);

    this.raf = requestAnimationFrame(this.frame);
  };

  private render(t: number) {
    const { ctx, view } = this;

    this.frame$.quality = this.options.quality;
    this.frame$.reducedMotion = this.options.reducedMotion;
    this.frame$.intensity = this.shown;

    const options = this.frame$;

    this.lighting.drawBase(ctx, view);
    this.lighting.drawKeyLight(ctx, view, t, options);
    this.lighting.drawRays(ctx, view, t, options);
    this.atmosphere.draw(ctx, view, t, options);
    this.particles.draw(ctx, view, t, options, this.focusY);
    this.atmosphere.drawVeil(ctx, view, t, options);
    this.lighting.drawFloorGlow(ctx, view, t, options);
  }
}
