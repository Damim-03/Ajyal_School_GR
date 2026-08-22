/**
 * الإضاءة — القاع، والمصدرُ العلويّ الأيسر، والأشعّة، والوهجُ السفليّ.
 *
 * **المبدأ الذي يحكم الملفّ كلَّه: لا تدرّجٌ يُبنى داخل الحلقة.**
 * `createRadialGradient` عمليةٌ ثقيلة، وطبقاتُ الضوء هنا ضخمةٌ تغطّي
 * الشاشة. فتُرسم مرّةً في لوحاتٍ خارج الشاشة، ثمّ تُركَّب بـ`drawImage`
 * مع إزاحةٍ ودورانٍ وشفافيةٍ متغيّرة — فيتحرّك الضوء دون أن يُعاد بناؤه.
 *
 * والقاعُ مخبوءٌ كذلك: تدرّجٌ متعدّدُ المحطّات بحجم الشاشة يُرسم عند
 * التحجيم فقط، لا ستّين مرّةً في الثانية لصورةٍ لا تتغيّر.
 */

import type { LightRay, SceneOptions, Viewport } from "./types";

/**
 * لوحةٌ خارج الشاشة.
 *
 * `OffscreenCanvas` حيث توجد — ترسم على خيطها الخاصّ في بعض المحرّكات —
 * و`<canvas>` عادي حيث لا توجد. والفرقُ لا يُرى في الاستعمال.
 */
const surface = (size: number): [CanvasRenderingContext2D, HTMLCanvasElement | OffscreenCanvas] => {
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas === "function"
      ? new OffscreenCanvas(size, size)
      : Object.assign(document.createElement("canvas"), { width: size, height: size });

  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  return [ctx, canvas];
};

/** ألوانُ المشهد — لا لونَ مُشبَعاً فيها، والدفءُ إيحاءٌ لا صبغة */
export const PALETTE = {
  /** ليس أسودَ خالصاً: الأسودُ الخالص يقتل الإحساس بالفضاء */
  voidTop: "#04060c",
  voidCore: "#080c15",
  /** زُرقةٌ رماديةٌ باردة تسكن أسفل المشهد */
  floor: "#0a1220",
  /**
   * ذهبٌ خفيف لا أبيضُ مائل.
   *
   * كان `[255,241,219]` — أبيضَ فيه أثرُ دفء، فخرج المشهد بارداً أكثر
   * ممّا ينبغي. وخفضُ الأزرق وحده هو ما يصنع الذهب: الفارقُ بين الأحمر
   * والأزرق هو ما تقرؤه العين حرارةً، لا رفعُ الأحمر.
   */
  /*
   * أقلُّ إشباعاً ممّا كان.
   *
   * `[255,226,178]` كان ذهباً بيّناً، فقرأت العينُ «كشّافاً أصفر» لا
   * «إضاءةً دافئة». ورفعُ الأزرق سبعاً وعشرين درجةً يُبقي الحرارة
   * ويُذهب الصُّفرة — والمقصودُ أبيضُ دافئ لا لونٌ له اسم.
   */
  key: [255, 233, 205] as const,
  cool: [140, 166, 202] as const,
} as const;

const rgba = (c: readonly [number, number, number], a: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** موضعُ مصدر الضوء — أعلى اليسار كما في المرجع */
export const KEY_LIGHT = { x: 0.13, y: 0.04 } as const;

// --------------------------------------------------
// الفرشاة — تُبنى مرّةً لكلّ نوع
// --------------------------------------------------

/**
 * هالةٌ ناعمة.
 *
 * والانحدارُ ليس خطّياً: محطّاتٌ متقاربةٌ عند المركز ومتباعدةٌ عند
 * الحافّة تعطي تلاشياً يشبه انطفاء الضوء في الهواء، أمّا التدرّج
 * الخطّي فيرسم قرصاً له حدٌّ يُرى.
 */
const glowSprite = (warm: number) => {
  const SIZE = 512;
  const [ctx, canvas] = surface(SIZE);
  const half = SIZE / 2;

  const color = [
    Math.round(PALETTE.key[0] * warm + PALETTE.cool[0] * (1 - warm)),
    Math.round(PALETTE.key[1] * warm + PALETTE.cool[1] * (1 - warm)),
    Math.round(PALETTE.key[2] * warm + PALETTE.cool[2] * (1 - warm)),
  ] as const;

  /*
   * **لا نواةَ للمصدر.**
   *
   * كانت القمّةُ عند شفافيةٍ كاملة ثمّ انحدارٌ سريع، فخرج قرصٌ أبيضُ
   * محترقٌ له حدٌّ يُرى — «شمسٌ» يستطيع الناظر أن يشير إليها. وضوءُ
   * PS5 عكسُ ذلك تماماً: لا يُعرف له مركز، وإنّما منطقةٌ واسعةٌ مضيئةٌ
   * تخفت خفوتاً متّصلاً حتى تذوب في السواد.
   *
   * فالانحدارُ صار مسطّحاً في وسطه: قمّتُه دون النصف، والفرقُ بين
   * المركز وثُلث نصف القطر ضئيل. والسطوعُ يأتي من **اتّساع** المساحة
   * لا من شدّة نقطةٍ فيها — وهو ما يمنع الاحتراق مهما رُفعت الشدّة.
   */
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, rgba(color, 0.46));
  g.addColorStop(0.08, rgba(color, 0.42));
  g.addColorStop(0.18, rgba(color, 0.33));
  g.addColorStop(0.3, rgba(color, 0.22));
  g.addColorStop(0.44, rgba(color, 0.13));
  g.addColorStop(0.6, rgba(color, 0.065));
  g.addColorStop(0.78, rgba(color, 0.022));
  g.addColorStop(0.9, rgba(color, 0.006));
  g.addColorStop(1, rgba(color, 0));

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  return canvas;
};

/**
 * شعاعٌ حجميّ — مستطيلٌ يخفت طولاً وعرضاً.
 *
 * يُبنى بمرورين: تدرّجٌ طوليّ يرسم خفوتَ الشعاع كلّما ابتعد عن مصدره،
 * ثمّ `destination-in` بتدرّجٍ عرضيّ يقضم حافّتيه. والنتيجةُ حزمةٌ بلا
 * حدٍّ مستقيمٍ في أيّ اتجاه — وهو الفرقُ بين ضوءٍ في هواءٍ مغبَّر وبين
 * «شعاع ليزر» ينفي السينمائية كلَّها.
 */
const raySprite = () => {
  const W = 512;
  const H = 256;

  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas === "function"
      ? new OffscreenCanvas(W, H)
      : Object.assign(document.createElement("canvas"), { width: W, height: H });

  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  /*
   * **يخفت في طرفيه لا في طرفٍ واحد.**
   *
   * كان يبدأ عند المنبع بأعلى شفافيته، فرسم المستطيلُ حافّةً عمودية
   * كاملةَ السطوع عند نقطة الأصل — وهي الخطوطُ المستقيمة الحادّة التي
   * ظهرت في أعلى اليسار. والشعاعُ في الهواء لا حدَّ له عند منبعه: يظهر
   * تدريجياً بعد أن يفارق المصدر بقليل، لأنّ ما حول المصدر مغمورٌ
   * بضوئه أصلاً فلا يتميّز عنه.
   */
  const along = ctx.createLinearGradient(0, 0, W, 0);
  along.addColorStop(0, rgba(PALETTE.key, 0));
  along.addColorStop(0.07, rgba(PALETTE.key, 0.2));
  along.addColorStop(0.2, rgba(PALETTE.key, 0.34));
  along.addColorStop(0.42, rgba(PALETTE.key, 0.2));
  along.addColorStop(0.68, rgba(PALETTE.key, 0.07));
  along.addColorStop(0.88, rgba(PALETTE.key, 0.015));
  along.addColorStop(1, rgba(PALETTE.key, 0));

  ctx.fillStyle = along;
  ctx.fillRect(0, 0, W, H);

  /*
   * والمقطعُ العرضيّ جرسيٌّ لا مثلّث.
   *
   * ثلاثُ محطّاتٍ (0 → 1 → 0) تعطي مقطعاً مثلّثاً، ومشتقّتُه تنكسر عند
   * القمّة والطرفين — فتقرأ العينُ ثلاثةَ خطوطٍ مستقيمة. وسبعُ محطّاتٍ
   * تُقرّب منحنى جاوس، ولا انكسارَ فيه في أيّ موضع.
   */
  const across = ctx.createLinearGradient(0, 0, 0, H);
  across.addColorStop(0, "rgba(0,0,0,0)");
  across.addColorStop(0.14, "rgba(0,0,0,0.08)");
  across.addColorStop(0.3, "rgba(0,0,0,0.42)");
  across.addColorStop(0.5, "rgba(0,0,0,1)");
  across.addColorStop(0.7, "rgba(0,0,0,0.42)");
  across.addColorStop(0.86, "rgba(0,0,0,0.08)");
  across.addColorStop(1, "rgba(0,0,0,0)");

  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, W, H);

  return canvas;
};

// --------------------------------------------------
// النظام
// --------------------------------------------------

export class LightingSystem {
  private warmGlow = glowSprite(1);
  private coolGlow = glowSprite(0);
  private ray = raySprite();

  /** القاعُ مخبوءٌ بحجم الشاشة — يُعاد بناؤه عند التحجيم وحده */
  private base: HTMLCanvasElement | OffscreenCanvas | null = null;

  rays: LightRay[] = [];

  /**
   * الأشعّة مبعثرةٌ لا منتظمة.
   *
   * زوايا متساويةٌ ترسم مروحةً تُقرأ فوراً كشكلٍ هندسيّ. والتفاوتُ في
   * الزاوية والعرض والشفافية والسرعة هو ما يجعلها تبدو ضوءاً يتسرّب
   * من فتحةٍ لا رسماً مقصوداً.
   */
  seedRays(count: number, random: () => number) {
    this.rays.length = 0;

    for (let i = 0; i < count; i += 1) {
      const spread = i / Math.max(1, count - 1);

      this.rays.push({
        /* من 18° إلى 62° تحت الأفق — نزولاً إلى أسفل اليمين كما في المرجع */
        angle: (16 + spread * 48 + (random() - 0.5) * 9) * (Math.PI / 180),
        /*
         * عريضةٌ جداً وقليلةُ العدد.
         *
         * ستّةُ أشعّةٍ ضيّقةٍ تتراكب بالجمع الضوئي فتصنع مروحةً مخطّطة.
         * وأربعةٌ عريضةٌ متداخلةٌ تذوب في بعضها فتُقرأ ضوءاً واحداً
         * متفاوتَ الكثافة — وهو ما يُرى في PS5.
         */
        spread: 0.2 + random() * 0.24,
        length: 0.85 + random() * 0.55,
        opacity: 0.07 + random() * 0.1,
        phase: random() * Math.PI * 2,
        /* أبطأ بالثلثين — دورةُ الشعاع تتجاوز الدقيقة فلا يُلتقط تكرارُها */
        speed: 0.018 + random() * 0.032,
      });
    }
  }

  /** يُستدعى عند التحجيم وحده — هنا وحدَه تُبنى تدرّجاتُ الشاشة الكاملة */
  resize(view: Viewport) {
    const w = Math.max(1, Math.round(view.width));
    const h = Math.max(1, Math.round(view.height));

    const canvas: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement("canvas"), { width: w, height: h });

    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    /*
     * الطبقة الأولى — عمقٌ لا لونٌ واحد.
     *
     * التدرّجُ قطريٌّ من الزاوية العلوية اليسرى: الأعلى أفتحُ قليلاً
     * لأنّ الضوء هناك، والزوايا البعيدة أغمقُها. ولولا هذا الفارق
     * لبدت الشاشةُ ورقةً مسطّحة مهما وُضع فوقها.
     */
    /*
     * سُلَّمٌ من خمس محطّات لا ثلاث، ومُزاحٌ إلى الدفء عند منبعه.
     *
     * ثلاثُ محطّاتٍ تعطي انتقالاً يُرى فيه شريطُ الحزّ (banding) على
     * شاشةٍ عريضة، وتُبقي اللونَ واحداً في الجوهر. والخمسُ تمدّ الرحلة
     * من كحليٍّ فيه أثرُ ذهبٍ عند الزاوية المضاءة إلى أسودَ مزرقٍّ عند
     * الزاوية البعيدة — فيحمل **التدرّجُ نفسُه** جزءاً من الدفء، لا
     * هالةُ الضوء وحدها فوقه.
     */
    const depth = ctx.createLinearGradient(0, 0, w * 0.85, h);
    depth.addColorStop(0, "#12100f");
    depth.addColorStop(0.14, "#0d0f16");
    depth.addColorStop(0.38, PALETTE.voidCore);
    depth.addColorStop(0.7, "#05080f");
    depth.addColorStop(1, PALETTE.voidTop);

    ctx.fillStyle = depth;
    ctx.fillRect(0, 0, w, h);

    /* ركامٌ باردٌ في القاع — يوحي بسطحٍ يتلقّى الضوء لا بحافّةٍ تنتهي */
    const floor = ctx.createLinearGradient(0, h * 0.55, 0, h);
    floor.addColorStop(0, "rgba(10,18,32,0)");
    floor.addColorStop(1, "rgba(12,22,38,0.55)");

    ctx.fillStyle = floor;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);

    /*
     * الطبقة الثانية — نواةُ المصدر، مخبوءةٌ لأنّها لا تتحرّك.
     *
     * قطرُها ضِعفا أكبرِ بعدٍ في الشاشة: مصدرٌ أصغرُ من ذلك يُقرأ قرصاً
     * موضوعاً في الزاوية، والمقصودُ ضوءٌ يملأ الحيّز ولا يُرى له حدّ.
     */
    const reach = Math.max(w, h) * 2.45;
    /* خُفّضت 0.62 ← 0.45 مع توسيع المدى: الشدّةُ تنزل والانتشارُ يزيد */
    ctx.globalAlpha = 0.45;
    ctx.drawImage(
      this.warmGlow,
      KEY_LIGHT.x * w - reach / 2,
      KEY_LIGHT.y * h - reach / 2,
      reach,
      reach,
    );
    ctx.globalAlpha = 1;

    this.base = canvas;
  }

  /** القاعُ والمصدر — لقطةٌ واحدة في كلّ إطار */
  drawBase(ctx: CanvasRenderingContext2D, view: Viewport) {
    if (!this.base) return;
    ctx.drawImage(this.base, 0, 0, view.width, view.height);
  }

  /**
   * تنفّسُ المصدر — الطبقةُ الحيّة فوق النواة الساكنة.
   *
   * موجتان بدورين غير متناسبين (0.07 و 0.043): مجموعُهما لا يعود إلى
   * نفسه في مدّةٍ تُلاحَظ، فلا يلتقط الناظرُ نبضاً يتكرّر. والموجةُ
   * الواحدة مهما بطُؤت تُكشَف بعد دقيقة.
   */
  drawKeyLight(ctx: CanvasRenderingContext2D, view: Viewport, t: number, o: SceneOptions) {
    const breath = o.reducedMotion
      ? 0
      : Math.sin(t * 0.07) * 0.5 + Math.sin(t * 0.043 + 1.7) * 0.5;

    const reach = Math.max(view.width, view.height) * 2.35;

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = (0.062 + breath * 0.014) * o.intensity;
    ctx.drawImage(
      this.warmGlow,
      KEY_LIGHT.x * view.width - reach / 2,
      KEY_LIGHT.y * view.height - reach / 2,
      reach,
      reach,
    );
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  /**
   * الطبقة الثالثة — الأشعّة.
   *
   * تُرسم بالجمع الضوئي (`lighter`) لا بالتركيب العادي: الضوءُ يُضاف
   * إلى ما تحته ولا يحجبه، وهو الفرق بين حزمةٍ في الهواء وشريطٍ من
   * الطلاء. وشفافيتُها أقلُّ من أن تُرى مباشرةً — وهذا هو المقصود:
   * تُحسّ ولا تُلاحظ.
   */
  drawRays(ctx: CanvasRenderingContext2D, view: Viewport, t: number, o: SceneOptions) {
    if (this.rays.length === 0) return;

    const ox = KEY_LIGHT.x * view.width;
    const oy = KEY_LIGHT.y * view.height;
    const reach = Math.hypot(view.width, view.height);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const ray of this.rays) {
      const sway = o.reducedMotion ? 0 : Math.sin(t * ray.speed + ray.phase);
      const pulse = o.reducedMotion ? 1 : 0.72 + (Math.sin(t * ray.speed * 1.6 + ray.phase) * 0.5 + 0.5) * 0.56;

      const length = reach * ray.length;
      const width = reach * ray.spread * (1 + sway * 0.12);

      ctx.setTransform(1, 0, 0, 1, ox, oy);
      ctx.rotate(ray.angle + sway * 0.022);
      ctx.globalAlpha = ray.opacity * pulse * o.intensity;
      ctx.drawImage(this.ray, 0, -width / 2, length, width);
    }

    ctx.restore();
  }

  /**
   * الطبقة السادسة — وهجُ القاع.
   *
   * قرصٌ مسطوحٌ بشدّة (ارتفاعُه سُبعُ عرضه) لا شريطٌ أفقيّ: الشريطُ له
   * حافّةٌ عليا تُقرأ خطَّ أرضية، والقرصُ المسطوح يتلاشى في الجانبين
   * فيبقى ضباباً مضاءً لا سطحاً.
   */
  drawFloorGlow(ctx: CanvasRenderingContext2D, view: Viewport, t: number, o: SceneOptions) {
    const drift = o.reducedMotion ? 0 : Math.sin(t * 0.028);
    const swell = o.reducedMotion ? 0 : Math.sin(t * 0.021 + 0.9);

    ctx.globalCompositeOperation = "lighter";

    /*
     * ثلاثُ طبقاتٍ لا واحدة — وهذا ما يصنع «انعكاساً على سطحٍ غير مرئي».
     *
     * الطبقةُ الواحدة مهما ضُبطت تبقى هالةً في الأسفل. والانعكاسُ يُقرأ
     * حين تجتمع: هالةٌ عميقةٌ تحت الحافّة تعطي مصدرَ الإضاءة، وشريطٌ
     * أفقيٌّ مسطوحٌ فوقها يعطي **مستوى** السطح، وضبابةٌ أعرضُ وأخفتُ
     * فوقهما تذيب حدَّ الشريط فلا يُقرأ خطَّ أرضية.
     */

    /* 1 — الهالةُ العميقة: مركزُها تحت الإطار، فلا يُرى منها إلّا أعلاها */
    const deepW = view.width * (2.3 + swell * 0.1);
    const deepH = view.height * 0.62;
    ctx.globalAlpha = (0.2 + swell * 0.028) * o.intensity;
    ctx.drawImage(
      this.coolGlow,
      view.width * (0.52 + drift * 0.025) - deepW / 2,
      view.height * 1.06 - deepH / 2,
      deepW,
      deepH,
    );

    /* 2 — الشريطُ المسطوح: ارتفاعُه عُشرُ عرضه، وهو مستوى «السطح» */
    const bandW = view.width * (1.5 + swell * 0.08);
    const bandH = view.height * 0.17;
    ctx.globalAlpha = (0.16 + swell * 0.03) * o.intensity;
    ctx.drawImage(
      this.coolGlow,
      view.width * (0.46 + drift * 0.04) - bandW / 2,
      view.height * (0.845 + swell * 0.006) - bandH / 2,
      bandW,
      bandH,
    );

    /* 3 — ضبابةٌ دافئةٌ تُذيب الحدّ، ويسارُها أدفأ لأنّ الضوء من هناك */
    const warmW = view.width * 1.1;
    const warmH = view.height * 0.34;
    ctx.globalAlpha = (0.085 + swell * 0.015) * o.intensity;
    ctx.drawImage(
      this.warmGlow,
      view.width * (0.3 - drift * 0.03) - warmW / 2,
      view.height * 0.87 - warmH / 2,
      warmW,
      warmH,
    );

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}
