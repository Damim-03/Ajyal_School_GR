/**
 * الغبارُ المضاء — الطبقة الخامسة، وهي التي تحمل العمق كلَّه.
 *
 * والفرقُ بين «غبارٍ في غرفة» و«حقلِ نجوم» ليس في عدد النقاط بل في
 * أمرين: **التوزيعُ غيرُ المنتظم**، و**اشتقاقُ كلّ صفةٍ من البعد**.
 * نقاطٌ موزّعةٌ بالتساوي بأحجامٍ عشوائية تُقرأ سماءً مهما زُخرفت.
 *
 * فهنا: حقلُ كثافةٍ يحاكي تركيب المرجع (تجمّعٌ أسفل الوسط، شريطٌ من
 * الصغائر يمين الوسط، أعلى الشاشة شبه خالٍ)، وستُّ صفاتٍ تُشتقّ من
 * `z` وحده — الحجم والسطوع والفرشاة والسرعة والبارالاكس وبهتانُ
 * المسافة.
 */

import type {
  BokehParticle,
  Particle,
  SceneOptions,
  SpriteKind,
  Viewport,
} from "./types";
import { KEY_LIGHT, PALETTE } from "./lightingSystem";

// --------------------------------------------------
// الفرشاة — أربعُ درجاتٍ من الحدّة تُبنى مرّةً
// --------------------------------------------------

const canvasOf = (size: number) =>
  typeof OffscreenCanvas === "function"
    ? new OffscreenCanvas(size, size)
    : (Object.assign(document.createElement("canvas"), {
        width: size,
        height: size,
      }) as HTMLCanvasElement);

/**
 * الضبابةُ من شكل الفرشاة لا من `filter: blur`.
 *
 * المرشّحُ يُعيد ترشيح الطبقة كلَّها في كلّ إطار — عشراتُ الملّي ثانية
 * لألف جسيم. أمّا أربعُ فرشٍ مُهيّأةٍ سلفاً بانحداراتٍ مختلفة فتُعطي
 * التدرّجَ نفسَه من الحادّ إلى الغائم بلا كلفةٍ في الحلقة، وهي التي
 * تصنع عمقَ الميدان: الفرشاةُ تُختار بحسب البعد.
 */
const dotSprite = (kind: SpriteKind) => {
  const SIZE = kind === "bokeh" ? 128 : 64;
  const canvas = canvasOf(SIZE);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const half = SIZE / 2;

  const g = ctx.createRadialGradient(half, half, 0, half, half, half);

  if (kind === "sharp") {
    /* نواةٌ صلبةٌ تكاد تملأ نصف القطر — تبقى نقطةً واضحةً وإن صغُرت */
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.32, "rgba(255,255,255,0.92)");
    g.addColorStop(0.5, "rgba(255,255,255,0.3)");
    g.addColorStop(0.78, "rgba(255,255,255,0.04)");
    g.addColorStop(1, "rgba(255,255,255,0)");
  } else if (kind === "soft") {
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.18, "rgba(255,255,255,0.68)");
    g.addColorStop(0.42, "rgba(255,255,255,0.22)");
    g.addColorStop(0.72, "rgba(255,255,255,0.04)");
    g.addColorStop(1, "rgba(255,255,255,0)");
  } else if (kind === "glow") {
    g.addColorStop(0, "rgba(255,255,255,0.78)");
    g.addColorStop(0.22, "rgba(255,255,255,0.4)");
    g.addColorStop(0.5, "rgba(255,255,255,0.13)");
    g.addColorStop(0.8, "rgba(255,255,255,0.02)");
    g.addColorStop(1, "rgba(255,255,255,0)");
  } else {
    /*
     * البوكيه — قرصٌ لا هالة.
     *
     * داخلُه شبه مستوٍ ثمّ حافّةٌ تخفت بسرعة، ومعها حلقةٌ أفتحُ قليلاً
     * قبل الحافّة مباشرة. تلك الحلقةُ هي ما تُميّز قرصَ عدسةٍ خارجَ
     * البؤرة عن هالةٍ ضوئية — وبدونها يبدو الجسيمُ الكبير بقعةَ ضوءٍ
     * لا جسماً قريباً من الكاميرا.
     *
     * **والشفافيةُ منخفضةٌ جداً (0.14 لا 0.5).** أوّلُ ضبطٍ جعل الداخل
     * شبه معتم، فامتلأ الإطارُ أقراصاً رماديةً صلبةً تُقرأ طبقةَ بوكيه
     * جاهزةً مركّبةً فوق المشهد. والقرصُ خارجَ البؤرة في التصوير خافتٌ
     * يكاد يُرى ما وراءه من خلاله — وهو ما يجعله جزءاً من الهواء لا
     * شيئاً موضوعاً عليه.
     */
    g.addColorStop(0, "rgba(255,255,255,0.14)");
    g.addColorStop(0.5, "rgba(255,255,255,0.13)");
    g.addColorStop(0.76, "rgba(255,255,255,0.17)");
    g.addColorStop(0.88, "rgba(255,255,255,0.09)");
    g.addColorStop(0.96, "rgba(255,255,255,0.02)");
    g.addColorStop(1, "rgba(255,255,255,0)");
  }

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  return canvas;
};

// --------------------------------------------------
// حقلُ الكثافة — تركيبُ المرجع مكتوباً دالّة
// --------------------------------------------------

const bump = (d: number, r: number) => Math.exp(-(d * d) / (2 * r * r));

/**
 * احتمالُ وجود جسيمٍ عند (u, v) — كلاهما في [0..1].
 *
 * ثلاثُ كتلٍ فوق أرضيةٍ خافتة، ثمّ كبحٌ للأعلى.
 *
 *   • أسفلُ الوسط — التجمّعُ الأكبر، وهو ما يعطي المشهدَ ثقلَه.
 *   • يمينُ الوسط — شريطُ الصغائر في المرجع.
 *   • أسفلُ اليسار — قليلٌ من الكبار المضاءة، فالضوءُ آتٍ من تلك الجهة.
 *
 * والكبحُ في الأعلى ليس زينة: الفراغُ السالب فوق هو ما يجعل النصّ
 * والزرَّ مقروءين، وهو نصفُ التركيب السينمائي.
 */
/**
 * تشويشٌ منخفضُ التردّد يكسر استدارةَ الكتل.
 *
 * الكتلةُ الجاوسية دائرةٌ كاملة، ومجموعُ ثلاثِ دوائرَ يُقرأ ثلاثَ
 * دوائر — «سحابةٌ دائرية» كما في عروض الجسيمات. وضربُها في حقلٍ
 * متموّجٍ يقضم حوافَّها قضماً غيرَ منتظم فتصير بقعاً عضويةً لا شكلَ
 * لها يُسمّى.
 *
 * والترددُ منخفضٌ (موجتان إلى ثلاث عبر الشاشة): أعلى منه يُنتج نقشاً
 * منتظماً يُرى، وأدنى منه لا يكسر شيئاً.
 */
const grain = (u: number, v: number) =>
  0.62 +
  0.38 *
    ((Math.sin(u * 7.3 + v * 4.1) * Math.cos(v * 5.7 - u * 3.2) +
      Math.sin(u * 3.1 - v * 6.4 + 1.7) * 0.6) *
      0.35 +
      0.5);

const densityAt = (u: number, v: number) => {
  const lowerCenter = bump(Math.hypot(u - 0.5, (v - 0.72) * 0.8), 0.32) * 1.05;
  /* شريطُ اليمين أعرضُ وأقوى — «كثافة أعلى في الجهة اليمنى» */
  const rightBand = bump(Math.hypot((u - 0.82) * 0.95, (v - 0.52) * 0.62), 0.3) * 0.95;
  const lowerLeft = bump(Math.hypot((u - 0.19) * 0.85, (v - 0.8) * 0.75), 0.24) * 0.62;

  /*
   * أرضيةٌ منحازةٌ إلى النصف السفلي.
   *
   * كانت 0.08 ثابتةً في الإطار كلِّه، فبقي ما بين الكتل خالياً وبدا
   * العددُ أقلَّ ممّا هو. والأرضيةُ المتدرّجة تملأ ما بينها بغبارٍ
   * خافتٍ متّصل — وهو ما يجعل الهواء يبدو مسكوناً لا مرقّطاً.
   */
  const floor = 0.1 + Math.max(0, v - 0.35) * 0.34;

  const field = (floor + lowerCenter + rightBand + lowerLeft) * grain(u, v);

  /* أعلى الشاشة يُكبَح تدريجياً — لا قطعاً حادّاً يُرى له خطّ */
  const ceiling = Math.min(1, Math.max(0, (v - 0.06) / 0.34));

  /**
   * نافذةٌ هادئةٌ خلف الترويسة.
   *
   * العنوانُ والسطرُ تحته يقعان بين 0.2 و0.33 من الارتفاع في وسط
   * العرض. والغبارُ خلف نصٍّ رفيعٍ خفيفِ الوزن يزاحمه على التباين
   * فيُقرأ بجهد — وهو أوّلُ ما يفرّق بين واجهة جهازٍ وصفحةِ ويب.
   * فتُخفَّض الكثافةُ هناك ولا تُصفَّر: الفراغُ التامّ يُرى مستطيلاً.
   */
  const behindTitle =
    1 - 0.72 * bump(Math.hypot((u - 0.5) * 0.62, (v - 0.265) * 1.9), 0.2);

  return Math.min(1, field * (0.16 + ceiling * 0.84) * behindTitle);
};

// --------------------------------------------------
// حقلُ التدفّق — ما يجعل الحركة تُقرأ هواءً لا انزلاقاً
// --------------------------------------------------

/**
 * تيّارٌ ناعمٌ متغيّرٌ في المكان والزمان.
 *
 * الانجرافُ بسرعةٍ ثابتةٍ لكلّ جسيم يرسم خطوطاً مستقيمةً متوازية: مهما
 * بطُؤت أو أُسرعت تُقرأ انزلاقاً ميكانيكياً. والغبارُ في هواءٍ ساكن
 * يتبع دوّاماتٍ بطيئةً واسعة، فيتقوّس مسارُه ويتفاوت بين موضعٍ وآخر.
 *
 * وهذا الحقلُ مجموعُ جيوبٍ بترددات غير متناسبة — يقارب الضجيج المتّصل
 * بكسرٍ من كلفته: لا جدولَ يُبنى ولا تخصيصَ في الحلقة، أربعُ دوالَّ
 * مثلّثية لكلّ جسيم. والترددُ منخفضٌ عمداً (2–3 دورات عبر الشاشة) فتخرج
 * دوّاماتٌ كبيرةٌ يسبح فيها الغبار، لا اهتزازٌ موضعيّ.
 */
const flowX = (x: number, y: number, t: number) =>
  Math.sin(y * 2.9 + t * 0.19) * Math.cos(x * 2.1 - t * 0.11) +
  Math.sin(x * 1.3 + y * 1.7 - t * 0.07) * 0.5;

const flowY = (x: number, y: number, t: number) =>
  Math.cos(x * 2.6 - t * 0.15) * Math.sin(y * 3.2 + t * 0.09) +
  Math.cos(x * 1.9 - y * 1.1 + t * 0.06) * 0.5;

// --------------------------------------------------
// النظام
// --------------------------------------------------

export class ParticleSystem {
  private sprites: Record<SpriteKind, HTMLCanvasElement | OffscreenCanvas> = {
    sharp: dotSprite("sharp"),
    soft: dotSprite("soft"),
    glow: dotSprite("glow"),
    bokeh: dotSprite("bokeh"),
  };

  particles: Particle[] = [];
  bokeh: BokehParticle[] = [];

  /** المولّدُ نفسُه يبقى بعد البذر — تُعيد به `recycle` أخذَ العيّنات */
  private rng: () => number = Math.random;

  /** إزاحةُ البارالاكس — تتبع المؤشّر بتباطؤ، وتُقاس بالبكسل المنطقي */
  private px = 0;
  private py = 0;
  private tx = 0;
  private ty = 0;

  /**
   * موضعٌ من حقل الكثافة — بالرفض لا بالعكس.
   *
   * أخذُ نقطةٍ عشوائية وقبولُها باحتمالٍ يساوي كثافةَ موضعها: أبسطُ من
   * قلب الدالّة وأدقُّ من تقسيم الشاشة مناطقَ ذاتِ حصص — والتقسيمُ
   * تظهر حدودُه في الصورة.
   */
  private samplePosition(random: () => number): [number, number] {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const u = random();
      const v = random();

      if (random() < densityAt(u, v)) return [u, v];
    }

    /* تعذّر القبول — تُوضع في أكثف موضعٍ بدل رفضٍ يُنقص العدد */
    return [0.5 + (random() - 0.5) * 0.3, 0.7 + (random() - 0.5) * 0.2];
  }

  /**
   * الدفءُ بحسب القرب من المصدر — الضوءُ يلتقط الغبار، فالأقربُ أدفأ.
   *
   * وأرضيةُ الدفء 0.45 لا صفر: أوّلُ ضبطٍ ترك البعيدَ عن المصدر بارداً
   * خالصاً فخرج المشهد أزرقَ أكثر ممّا ينبغي. والغبارُ في غرفةٍ مضاءةٍ
   * بمصباحٍ دافئ لا يوجد فيه ما هو بارد تماماً — أبعدُه أبيضُ مائل،
   * وأقربُه ذهبيّ.
   */
  private warmthAt(u: number, v: number, random: () => number) {
    const reach = Math.hypot(u - KEY_LIGHT.x, v - KEY_LIGHT.y);
    const lit = Math.min(1, Math.max(0, 1 - reach * 0.7));

    return Math.min(1, 0.45 + lit * 0.55 * (0.7 + random() * 0.3));
  }

  seed(count: number, bokehCount: number, random: () => number) {
    this.rng = random;
    this.particles.length = 0;
    this.bokeh.length = 0;

    /*
     * ثلاثُ طبقاتٍ مقطوعةٌ صراحةً — لا توزيعٌ متّصلٌ للبعد.
     *
     * الأسُّ المستمرّ (`pow(random(), 1.9)`) يعطي تدرّجاً رياضياً
     * سليماً، لكنّه بصرياً يُخرج سحابةً واحدةً متشابهةَ الحجم: أغلبُ
     * القيم تتجمّع في نطاقٍ ضيّق فلا تُقرأ «طبقات». والقطعُ الصريح
     * يضمن أن تُرى ثلاثُ مسافاتٍ متمايزة — حادّةٌ صغيرةٌ في الخلف،
     * ومتوسّطة، وأقراصٌ ضبابيةٌ كبيرةٌ في المقدّمة — وهو ما يصنع
     * الإحساس الثلاثيّ الأبعاد.
     */
    for (let i = 0; i < count; i += 1) {
      const [u, v] = this.samplePosition(random);
      const roll = i / count;

      let z: number;
      let size: number;
      let opacity: number;
      let sprite: SpriteKind;

      if (roll < 0.8) {
        /*
         * FAR — أربعةُ أخماس الحقل، وأغلبُها لا يكاد يُرى.
         *
         * والنسبةُ مقصودة: من عدّ الجسيماتِ رأى عرضَ جسيمات، ومن لم
         * يستطع عدَّها رأى هواءً. فالكثرةُ هنا لا تُرى فرادى وإنّما
         * تُحسّ كثافةً — وشفافيةُ 0.05 إلى 0.14 هي حدُّ ما تلتقطه العين
         * دون أن تتوقّف عنده.
         */
        z = random() * 0.22;
        size = 0.7 + random() * 0.5;
        opacity = 0.05 + random() * 0.09;
        sprite = "sharp";
      } else if (roll < 0.95) {
        /* MID — خُمسُ ما تراه العينُ فعلاً، وهو ما يُقرأ «غباراً» */
        z = 0.28 + random() * 0.24;
        size = 1.3 + random() * 0.8;
        opacity = 0.11 + random() * 0.16;
        sprite = "soft";
      } else if (roll < 0.985) {
        /* NEAR — أكبرُ وأنعم، وحدُّه الأعلى دون سطوع الوسط */
        z = 0.58 + random() * 0.22;
        size = 2.4 + random() * 1.6;
        opacity = 0.08 + random() * 0.12;
        sprite = "glow";
      } else {
        /* FOREGROUND — واحدٌ ونصفٌ بالمئة، أقراصٌ كبيرةٌ شبه شفّافة */
        z = 0.85 + random() * 0.15;
        size = 5 + random() * 4;
        opacity = 0.04 + random() * 0.07;
        sprite = "bokeh";
      }

      this.particles.push({
        x: u,
        y: v,
        z,
        /*
         * صعودٌ خفيفٌ مائل — والتيّارُ فوقه هو ما يقوّس المسار.
         * القيمُ نسبةٌ من الشاشة في الثانية.
         */
        vx: (random() - 0.5) * 0.008,
        vy: -(0.004 + random() * 0.013),
        size,
        opacity,
        warmth: this.warmthAt(u, v, random),
        brightness: 0.42 + random() * 0.38,
        phase: random() * Math.PI * 2,
        /* وميضٌ أبطأ — النبضُ السريع يُقرأ وميضاً لا غباراً */
        twinkleSpeed: 0.08 + random() * 0.24,
        sprite,
      });
    }

    for (let i = 0; i < bokehCount; i += 1) {
      const [u, v] = this.samplePosition(random);

      this.bokeh.push({
        x: u,
        y: v,
        z: 0.72 + random() * 0.28,
        vx: (random() - 0.5) * 0.006,
        vy: -(0.003 + random() * 0.009),
        /* مدى أوسع: من قرصٍ صغير إلى قرصٍ يبلغ عُشر الشاشة */
        radius: 0.01 + Math.pow(random(), 1.6) * 0.055,
        opacity: 0.018 + random() * 0.035,
        warmth: this.warmthAt(u, v, random),
        phase: random() * Math.PI * 2,
        driftSpeed: 0.025 + random() * 0.06,
      });
    }
  }

  /** المؤشّر بالنسبة إلى مركز الشاشة، في [-1..1] */
  setPointer(nx: number, ny: number) {
    this.tx = nx;
    this.ty = ny;
  }

  /**
   * الخطوة — `dt` بالثواني، و`t` ساعةُ المشهد.
   *
   * **والسرعةُ تتبع القربَ تبعاً مباشراً** — بارالاكسٌ حقيقيّ. كان
   * السابقُ يجعل ذروتَها في العمق المتوسّط فيهدأ الطرفان، وذلك يُضعف
   * أقوى إشارةٍ تملكها العينُ على المسافة: ما يعبر الحقلَ سريعاً قريب،
   * وما يكاد يثبت بعيد. فصار القريبُ يسبق البعيدَ بستّة أضعاف.
   *
   * والوحدةُ **نسبةٌ من الشاشة في الثانية** لا إزاحةٌ لكلّ إطار: العددُ
   * يُقرأ ويُضبط («0.05 يعني عبورَ الشاشة في عشرين ثانية»)، والحركةُ
   * تستقلّ عن معدّل الإطارات فلا تتسارع على شاشةٍ 120Hz.
   */
  update(dt: number, t: number, o: SceneOptions) {
    /* تتبّعٌ بتباطؤ — الإزاحةُ لا تلتصق بالمؤشّر بل تلحق به */
    this.px += (this.tx - this.px) * Math.min(1, dt * 2.2);
    this.py += (this.ty - this.py) * Math.min(1, dt * 2.2);

    if (o.reducedMotion) return;

    for (const p of this.particles) {
      /**
       * الانجرافُ يبلغ ذروتَه في الوسط، والبارالاكسُ يزيد مع القرب.
       *
       * وهما شيئان لا شيءٌ واحد، وخلطُهما كان خطأً. البعيدُ ساكنٌ
       * لبعده، والقريبُ **ثقيلٌ** فيزحف ببطء — وهو ما يُرى في الغبار
       * القريب من العدسة. والذي يقول «هذا قريب» ليس سرعةَ انجرافه بل
       * استجابتُه للحركة: إزاحةُ البارالاكس تتبع `z` تبعاً مباشراً
       * (في `draw`)، فيبقى الإحساسُ بالمسافة ويهدأ المشهد.
       */
      const pace = 0.25 + 1.35 * Math.exp(-Math.pow((p.z - 0.45) / 0.26, 2));

      p.x += (p.vx + flowX(p.x, p.y, t) * 0.016) * pace * dt;
      p.y += (p.vy + flowY(p.x, p.y, t) * 0.011) * pace * dt;

      this.recycle(p);
    }

    for (const b of this.bokeh) {
      /* أبطأُ ما في المشهد — قرصٌ كبيرٌ يزحف، وبارالاكسُه هو الذي يقرّبه */
      const pace = 0.34 + b.z * 0.22;

      b.x += (b.vx + flowX(b.x, b.y, t) * 0.012) * pace * dt;
      b.y += (b.vy + flowY(b.x, b.y, t) * 0.008) * pace * dt;

      if (b.y < -0.2) { b.y = 1.2; b.x = this.rng(); }
      if (b.y > 1.2) b.y = -0.2;
      if (b.x < -0.2) b.x = 1.2;
      if (b.x > 1.2) b.x = -0.2;
    }
  }

  /**
   * إعادةُ الخارج — من حقل الكثافة لا من الحافّة المقابلة.
   *
   * اللفُّ البسيط (`y < 0 → y = 1`) يُبقي العددَ ثابتاً لكنّه **يُذيب
   * التركيب**: الجسيمُ يخرج من موضعٍ كثيف ويعود إلى موضعٍ عشوائي، فبعد
   * دقائقَ من صعودٍ متّصل يستوي التوزيعُ ويضيع تجمّعُ أسفل الوسط الذي
   * قام عليه المشهد. والعودةُ بأخذ عيّنةٍ جديدة من الحقل تُبقي الصورةَ
   * على حالها مهما طالت الجلسة — وهو ما صار لازماً حين أُسرعت الحركة.
   */
  private recycle(p: Particle) {
    if (p.y > -0.06 && p.y < 1.06 && p.x > -0.06 && p.x < 1.06) return;

    const [u, v] = this.samplePosition(this.rng);

    /* يدخل من الحافّة المقابلة، وموضعُه على تلك الحافّة من الحقل */
    if (p.y <= -0.06) { p.x = u; p.y = 1.05; }
    else if (p.y >= 1.06) { p.x = u; p.y = -0.05; }
    else if (p.x <= -0.06) { p.x = 1.05; p.y = v; }
    else { p.x = -0.05; p.y = v; }
  }

  /**
   * الرسم.
   *
   * `lighter` مرّةً واحدة للمرور كلِّه: الضوءُ يتراكم حيث تتقارب
   * الجسيمات فتُولَد كثافةٌ مضيئةٌ لم تُرسم صراحةً — وهو ما يحدث في
   * العدسة الحقيقية. والتركيبُ العاديّ يجعل كلَّ جسيمٍ يحجب ما تحته
   * فيبدو المشهدُ ملصقاً.
   *
   * ولا `shadowBlur` في أيّ موضع: أغلى ما يُرسم على الوحدة، وأثرُه
   * هنا يؤدّيه اختيارُ الفرشاة بلا كلفة.
   */
  draw(ctx: CanvasRenderingContext2D, view: Viewport, t: number, o: SceneOptions, focusY: number) {
    const scale = view.min / 900;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    /* البوكيه أوّلاً — أقراصُ المقدّمة تحت الغبار الحادّ لا فوقه */
    for (const b of this.bokeh) {
      const breathe = o.reducedMotion ? 1 : 0.8 + (Math.sin(t * b.driftSpeed + b.phase) * 0.5 + 0.5) * 0.4;
      const r = b.radius * view.min * (0.9 + b.z * 0.4);

      const x = b.x * view.width + this.px * b.z * 26;
      const y = b.y * view.height + this.py * b.z * 18;

      ctx.globalAlpha = b.opacity * breathe * o.intensity;
      ctx.drawImage(this.tint("bokeh", b.warmth), x - r, y - r, r * 2, r * 2);
    }

    for (const p of this.particles) {
      /*
       * الوميضُ موجتان غيرُ متناسبتين — كما في تنفّس المصدر. والموجةُ
       * الواحدة تُنتج نبضاً منتظماً تلتقطه العين بعد ثوانٍ.
       */
      const twinkle = o.reducedMotion
        ? 0.85
        : 0.62 + (Math.sin(t * p.twinkleSpeed + p.phase) * 0.34 + Math.sin(t * p.twinkleSpeed * 0.41 + p.phase * 1.7) * 0.16 + 0.5) * 0.5;

      /*
       * المنظورُ الجوّي: البعيدُ يخفت لأنّ بينه وبين العين هواءٌ أكثر.
       * وهو الذي يمنع الحقلَ من أن يبدو صفحةً واحدة.
       */
      const aerial = 0.34 + p.z * 0.66;

      /* الزرُّ يُضيء ما حوله قليلاً — إشعاعٌ خافتٌ لا هالة */
      const near = 1 + bump(Math.hypot(p.x - 0.5, p.y - focusY), 0.14) * 0.5;

      const alpha = p.opacity * twinkle * aerial * near * p.brightness * o.intensity;
      if (alpha < 0.004) continue;

      const r = p.size * scale * (1 + p.z * 1.5);
      const x = p.x * view.width + this.px * (0.25 + p.z) * 30;
      const y = p.y * view.height + this.py * (0.25 + p.z) * 20;

      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(this.tint(p.sprite, p.warmth), x - r, y - r, r * 2, r * 2);
    }

    ctx.restore();
  }

  /**
   * الفرشاةُ ملوّنةً — أربعُ درجاتِ دفءٍ لكلّ نوع، لا لونٌ لكلّ جسيم.
   *
   * تلوينُ كلِّ جسيمٍ على حدة يعني لوحةً لكلّ واحد. والعينُ لا تفرّق
   * بين درجتَي دفءٍ متجاورتين في نقطةٍ قطرُها بكسلان، فأربعُ درجاتٍ
   * تكفي لكسر الرتابة — والمجموعُ ستّ عشرة لوحةً تُبنى مرّةً.
   */
  private tinted = new Map<string, HTMLCanvasElement | OffscreenCanvas>();

  private tint(kind: SpriteKind, warmth: number) {
    const step = Math.min(3, Math.max(0, Math.round(warmth * 3)));
    const key = `${kind}${step}`;
    const cached = this.tinted.get(key);
    if (cached) return cached;

    const base = this.sprites[kind];
    const size = (base as HTMLCanvasElement).width;
    const canvas = canvasOf(size);
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    const w = step / 3;
    const color = [
      Math.round(PALETTE.key[0] * w + PALETTE.cool[0] * (1 - w)),
      Math.round(PALETTE.key[1] * w + PALETTE.cool[1] * (1 - w)),
      Math.round(PALETTE.key[2] * w + PALETTE.cool[2] * (1 - w)),
    ];

    ctx.drawImage(base, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.fillRect(0, 0, size, size);

    this.tinted.set(key, canvas);

    return canvas;
  }
}
