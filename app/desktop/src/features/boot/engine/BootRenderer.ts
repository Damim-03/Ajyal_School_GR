import {
  BIRTH_FLOOR, BLUE, COUNT, FLOW, GOLD, GOLD_WHITE, GROUND, LAYERS,
  MAX_DPR, OPTICS,
} from "./boot.config";
import {
  BLUR_FRAG, BRIGHT_FRAG, COMPOSITE_FRAG, FULLSCREEN_VERT,
  PARTICLE_FRAG, PARTICLE_VERT,
} from "./shaders";
import type { BootFrame } from "./BootTimeline";

export type Quality = "low" | "medium" | "high";

/**
 * **المُصيِّر — يملك السياق الرسوميّ والحلقة، وخارج React تماماً.**
 *
 * ولا يعرف شيئاً عن الزمن ولا عن الأطوار: يُعطى `BootFrame` جاهزاً في
 * كلّ إطارٍ فيرسمه. فالجدولُ يقرّر **ماذا**، وهذا يقرّر **كيف** — ولا
 * يتسرّب أحدهما إلى الآخر.
 *
 * ## تمريراتُ الرسم
 *
 *   ① الجسيمات  → مخزنٌ خارجيّ بدقّةٍ كاملة، جمعٌ ضوئيّ
 *   ② الإشراق   → نصفُ الدقّة، ما فوق العتبة وحده
 *   ③ تمويهٌ أفقيّ  ┐ غاوسيّةٌ منفصلة على نصف الدقّة
 *   ④ تمويهٌ رأسيّ  ┘
 *   ⑤ التركيب   → الشاشة: مشهدٌ + وهجٌ + جوٌّ + ظلمةُ أطراف + جاما
 *
 * والوهجُ على **نصف** الدقّة لا كاملها: التمويهُ يقرأ من النسيج مراراً،
 * وربعُ البكسلات يعني ربعَ الكلفة — والنتيجةُ لا تُميَّز لأنّ المطلوب
 * أصلاً ضوءٌ منتشر.
 *
 * ## ما لا يقع في الإطار
 *
 * لا تخصيصَ، ولا إنشاءَ مخزنٍ أو نسيجٍ أو مُظلِّل، ولا رفعَ بيانات، ولا
 * حلقةَ على الجسيمات في المعالج المركزيّ (§26). كلُّ ذلك يقع مرّةً في
 * `constructor`. وما يقع في الإطار: خمسُ تمريراتٍ ونحو عشرين قيمةً
 * موحّدة.
 */
export class BootRenderer {
  private gl: WebGL2RenderingContext;
  private raf = 0;
  private running = false;

  /* البرامج */
  private pParticles: WebGLProgram;
  private pBright: WebGLProgram;
  private pBlur: WebGLProgram;
  private pComposite: WebGLProgram;

  /* الهندسة */
  private vao: WebGLVertexArrayObject;
  private emptyVao: WebGLVertexArrayObject;
  private buffers: WebGLBuffer[] = [];

  /* الأهداف */
  private fboScene: WebGLFramebuffer | null = null;
  private texScene: WebGLTexture | null = null;
  private fboA: WebGLFramebuffer | null = null;
  private texA: WebGLTexture | null = null;
  private fboB: WebGLFramebuffer | null = null;
  private texB: WebGLTexture | null = null;

  private count: number;
  private dprCap: number;
  private w = 1;
  private h = 1;
  private dpr = 1;

  /** يُملأ من الخارج في كلّ إطار — ولا يُخصَّص كائنٌ جديد. */
  frame: BootFrame | null = null;
  /** «تقليل الحركة» يخمد الاضطراب ولا يوقف المشهد. */
  still = false;

  private uni: Record<string, Map<string, WebGLUniformLocation | null>> = {};

  /*
   * حقلٌ معلَنٌ صراحةً لا خاصّيةُ معامِل.
   *
   * المشروعُ يبني بـ`erasableSyntaxOnly`: كلُّ ما في TypeScript يجب أن
   * يُمحى بلا تحويل. وخاصّيةُ المعامِل (`constructor(private x)`) تُولّد
   * إسناداً في وقت التشغيل، فهي بناءٌ لا نوع — ولذلك تُرفض.
   */
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
    this.canvas = canvas;

    /*
     * **`alpha: true` — واللوحةُ فوق التطبيق كلِّه، فوجب أن يكون فشلُها
     * شفّافاً.**
     *
     * كانت `false`. ومعناها أنّ ذاكرةَ الرسم **مُعتِمة**: ما لم يُكتب
     * فيها يُركَّب لوناً صلباً لا فراغاً. وهذه اللوحةُ `absolute inset-0`
     * فوق شاشة الإقلاع واختيارِ المستخدم — فحين فشل البناءُ مرّةً
     * ولم يُرسم فيها إطارٌ واحد، ركّبها المتصفّحُ **بيضاءَ ملءَ
     * الشاشة**: اختفت الخلفيةُ الداكنة، وصار كلُّ نصٍّ أبيضَ فوق أبيض،
     * ولم يبقَ مرئياً إلّا الصورُ الرمزيّة. أي أنّ عطلاً في مشهدٍ
     * تزيينيٍّ أسقط الواجهةَ كلَّها.
     *
     * ومُظلِّلُ التركيب يكتب `vec4(c, 1.0)` في كلّ إطار، فالشفافيةُ لا
     * تغيّر شيئاً ما دام يرسم — وتُنقذ كلَّ شيءٍ حين لا يرسم.
     */
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });

    if (!gl) throw new Error("WebGL2 unavailable");

    this.gl = gl;
    this.count = COUNT[quality];
    this.dprCap = MAX_DPR[quality];

    this.pParticles = this.link(PARTICLE_VERT, PARTICLE_FRAG, "particles");
    this.pBright = this.link(FULLSCREEN_VERT, BRIGHT_FRAG, "bright");
    this.pBlur = this.link(FULLSCREEN_VERT, BLUR_FRAG, "blur");
    this.pComposite = this.link(FULLSCREEN_VERT, COMPOSITE_FRAG, "composite");

    this.vao = this.buildParticles();
    this.emptyVao = gl.createVertexArray()!;

    this.resize();
  }

  /* ============================================================
   * البناء
   * ============================================================ */

  private compile(src: string, type: number, tag: string): WebGLShader {
    const gl = this.gl;
    const sh = gl.createShader(type)!;

    gl.shaderSource(sh, src);
    gl.compileShader(sh);

    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(`[boot:${tag}] ${log}`);
    }

    return sh;
  }

  private link(vs: string, fs: string, tag: string): WebGLProgram {
    const gl = this.gl;
    const v = this.compile(vs, gl.VERTEX_SHADER, `${tag}.vert`);
    const f = this.compile(fs, gl.FRAGMENT_SHADER, `${tag}.frag`);
    const p = gl.createProgram()!;

    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    /* المُظلِّلاتُ تُحذف بعد الربط — البرنامجُ يحتفظ بما يلزمه. */
    gl.deleteShader(v);
    gl.deleteShader(f);

    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error(`[boot:${tag}] ${log}`);
    }

    this.uni[tag] = new Map();

    return p;
  }

  /**
   * مواضعُ القيم الموحّدة — تُستعلَم مرّةً وتُحفظ.
   *
   * `getUniformLocation` استعلامٌ عن سلسلةٍ نصّية في كلّ نداء، وخمسٌ
   * وعشرون منها في كلّ إطارٍ عملٌ لا مقابلَ له.
   */
  private u(tag: string, program: WebGLProgram, name: string) {
    const cache = this.uni[tag];
    let loc = cache.get(name);

    if (loc === undefined) {
      loc = this.gl.getUniformLocation(program, name);
      cache.set(name, loc);
    }

    return loc;
  }

  /**
   * **مخازنُ الجسيمات — تُرفع مرّةً ولا تُلمس بعدها.**
   *
   * ولا `Math.random` مباشر: مولّدٌ ببذرةٍ ثابتة، فالتركيبُ الذي ضُبط
   * بالعين هو الذي يُرى في كلّ إقلاع (§35). وعشوائيّةٌ حرّة قد تُخرج
   * تجمّعاً في غير موضعه أو فراغاً حيث ينبغي أن يكون ثقل.
   */
  private buildParticles(): WebGLVertexArrayObject {
    const gl = this.gl;
    const n = this.count;

    let s = 0x9e3779b9 >>> 0;
    const rnd = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let x = Math.imul(s ^ (s >>> 15), 1 | s);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };

    const seed = new Float32Array(n * 3);
    const trait = new Float32Array(n * 4);
    const meta = new Float32Array(n * 4);

    /* حدودُ الطبقات كنِسَبٍ تراكمية — تُقسَم بها الجسيمات. */
    const edges: number[] = [];
    let acc = 0;
    for (const l of LAYERS) {
      acc += l.share;
      edges.push(acc);
    }

    for (let i = 0; i < n; i++) {
      const t = rnd() * acc;
      const li = t < edges[0] ? 0 : t < edges[1] ? 1 : 2;
      const layer = LAYERS[li];

      /*
       * التوزيعُ **غاوسيٌّ لا منتظم** (§9).
       *
       * المنتظمُ يملأ المستطيل بكثافةٍ واحدة فيُقرأ شبكةً؛ والغاوسيُّ
       * يكثّف القلبَ ويُخفّ الأطراف، فيُقرأ **سحابة**. ومجموعُ ثلاث
       * عشوائيّاتٍ يقارب الجرس (نظريةُ الحدّ المركزيّ) بثمنٍ لا شيء.
       */
      const g = () => (rnd() + rnd() + rnd()) / 1.5 - 1;

      /* أعرضُ من ارتفاعه: المشهدُ أفقيٌّ منذ نشأته. */
      seed[i * 3 + 0] = g() * 0.95;
      seed[i * 3 + 1] = g() * 0.52;
      seed[i * 3 + 2] = g() * 0.8;

      const sz = layer.size[0] + rnd() * (layer.size[1] - layer.size[0]);
      const br = layer.bright[0] + rnd() * (layer.bright[1] - layer.bright[0]);

      trait[i * 4 + 0] = sz;
      trait[i * 4 + 1] = br;
      trait[i * 4 + 2] = layer.soft;
      /*
       * ميلُ الجسيم إلى الذهب — ورتبتُه في التذهّب.
       *
       * والقريبةُ الكبيرةُ تتذهّب أوّلاً (‏−0.18): الذهبُ يجب أن يُرى
       * حين يبدأ، ولو بدأ في الطبقة البعيدة الخافتة لمرّ بلا أن يُلاحَظ.
       */
      trait[i * 4 + 3] = Math.min(0.97, Math.max(0.02, rnd() * 0.95 - layer.soft * 0.18));

      meta[i * 4 + 0] = layer.flow;
      /*
       * رتبةُ الولادة: الجسيمُ صفر بالضبط هو **البذرة** (§8) — يُزرع في
       * المركز ويُولد وحده. والبقيّةُ تتوزّع بعده.
       */
      meta[i * 4 + 1] = i === 0 ? 0 : BIRTH_FLOOR + (i / n) * (1 - BIRTH_FLOOR);
      meta[i * 4 + 2] = rnd();
      meta[i * 4 + 3] = rnd();

      if (i === 0) {
        seed[0] = 0;
        seed[1] = 0;
        seed[2] = 0;
        trait[2] = 1;
        trait[0] = LAYERS[2].size[1];
        trait[1] = 1;
        trait[3] = 0.99;
      }
    }

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);

    const attach = (data: Float32Array, loc: number, size: number) => {
      const buf = gl.createBuffer()!;
      this.buffers.push(buf);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      /* `STATIC_DRAW`: تُكتب مرّةً وتُقرأ ملايينَ المرّات. */
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };

    attach(seed, gl.getAttribLocation(this.pParticles, "aSeed"), 3);
    attach(trait, gl.getAttribLocation(this.pParticles, "aTrait"), 4);
    attach(meta, gl.getAttribLocation(this.pParticles, "aMeta"), 4);

    gl.bindVertexArray(null);

    return vao;
  }

  /* ============================================================
   * الأهداف
   * ============================================================ */

  private target(w: number, h: number): [WebGLFramebuffer, WebGLTexture] {
    const gl = this.gl;
    const tex = gl.createTexture()!;

    gl.bindTexture(gl.TEXTURE_2D, tex);
    /*
     * `RGBA16F` حين يُتاح — والمشهدُ **يتجاوز الواحد** عند الذروة:
     * جمعُ مئات الجسيمات المضيئة يبلغ 3 أو 4، وبثمانِ بتّاتٍ يُقصّ ذلك
     * إلى أبيضَ مسطّح قبل أن يصل إلى مرشِّح الإشراق — فلا يبقى للوهج
     * ما يميّزه. والقصُّ يقع بعد ترسيم النطاق لا قبله.
     */
    const float = gl.getExtension("EXT_color_buffer_float");
    const internal = float ? gl.RGBA16F : gl.RGBA8;
    const type = float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return [fbo, tex];
  }

  private freeTargets() {
    const gl = this.gl;

    for (const f of [this.fboScene, this.fboA, this.fboB]) if (f) gl.deleteFramebuffer(f);
    for (const t of [this.texScene, this.texA, this.texB]) if (t) gl.deleteTexture(t);

    this.fboScene = this.fboA = this.fboB = null;
    this.texScene = this.texA = this.texB = null;
  }

  /**
   * إعادةُ القياس — **وتُعاد الأهدافُ لا الجسيمات** (§28).
   *
   * مخازنُ الجسيمات مستقلّةٌ عن الدقّة تماماً (مواضعُها في فضاءٍ
   * معياريّ)، فتغييرُ حجم النافذة لا يمسّها. وأهدافُ الرسم وحدها
   * تُخصَّص من جديد — وتُحرَّر القديمةُ قبلها فلا تتسرّب ذاكرةٌ رسومية
   * مع كلّ سحبةِ حافّة.
   */
  resize() {
    const gl = this.gl;
    const rect = this.canvas.getBoundingClientRect();

    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));

    if (w === this.w && h === this.h && dpr === this.dpr && this.fboScene) return;

    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = w;
    this.canvas.height = h;

    this.freeTargets();

    [this.fboScene, this.texScene] = this.target(w, h);

    const bw = Math.max(1, w >> 1);
    const bh = Math.max(1, h >> 1);
    [this.fboA, this.texA] = this.target(bw, bh);
    [this.fboB, this.texB] = this.target(bw, bh);

    gl.viewport(0, 0, w, h);
  }

  /* ============================================================
   * الحلقة
   * ============================================================ */

  start() {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private quad() {
    const gl = this.gl;
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * تصييرُ إطارٍ واحدٍ **متزامناً** — بلا حلقة.
   *
   * ووجودُها ليس لأجل الاختبار وحده: مسارُ «الإقلاع سبق في هذه الجلسة»
   * يحتاج أن يُرسم المشهدُ المستقرُّ مرّةً ثمّ يسكن، فتشغيلُ حلقةٍ كاملةٍ
   * لصورةٍ لا تتغيّر إهدارٌ صريح.
   *
   * وهي أيضاً ما يجعل المحرّكَ قابلاً للقياس: يُضبط الإطارُ على لحظةٍ
   * بعينها فتُقرأ بكسلاتُها — بلا انتظارِ `requestAnimationFrame` الذي
   * يتوقّف أصلاً في نافذةٍ لا تُعرض.
   */
  renderOnce() {
    this.draw();
  }

  private draw() {
    const gl = this.gl;
    const f = this.frame;

    if (!f || !this.fboScene || !this.fboA || !this.fboB) return;

    const still = this.still ? 0.28 : 1;

    /* ---------- ① الجسيمات ---------- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboScene);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    /*
     * جمعٌ ضوئيّ (‏ONE, ONE) — والضوءُ يُجمع ولا يحجب بعضُه بعضاً.
     * ومزجُ الشفافية المعتاد كان سيجعل جسيماً أمام آخر **يطمسه**، وهو
     * نقيضُ ما يفعله الضوء.
     */
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.useProgram(this.pParticles);
    const P = (n: string) => this.u("particles", this.pParticles, n);

    gl.uniform1f(P("uTime"), f.time);
    gl.uniform2f(P("uRes"), this.w, this.h);
    gl.uniform1f(P("uDpr"), this.dpr);
    gl.uniform1f(P("uEmerge"), f.emerge);
    gl.uniform1f(P("uSpread"), f.spread);
    gl.uniform1f(P("uGold"), f.gold);
    gl.uniform1f(P("uBloom"), f.bloom);
    gl.uniform1f(P("uDisperse"), f.disperse);
    gl.uniform1f(P("uIntensity"), f.intensity);
    gl.uniform1f(P("uStill"), still);
    gl.uniform3fv(P("uBlue"), BLUE as unknown as Float32List);
    gl.uniform3fv(P("uGoldC"), GOLD as unknown as Float32List);
    gl.uniform3fv(P("uGoldWhite"), GOLD_WHITE as unknown as Float32List);
    gl.uniform1f(P("uFlowScale"), FLOW.scale);
    gl.uniform1f(P("uFlowEvolve"), FLOW.evolve);
    gl.uniform1f(P("uFlowStrength"), FLOW.strength);
    gl.uniform1f(P("uFlowDrift"), FLOW.drift);
    gl.uniform1f(P("uCore"), OPTICS.core);
    gl.uniform1f(P("uHalo"), OPTICS.halo);
    gl.uniform1f(P("uHaloMix"), OPTICS.haloMix);

    gl.bindVertexArray(this.vao);
    /* **نداءُ رسمٍ واحدٌ لآلاف الجسيمات** (§3). */
    gl.drawArrays(gl.POINTS, 0, this.count);

    gl.disable(gl.BLEND);

    /* ---------- ② الإشراق ---------- */
    const bw = Math.max(1, this.w >> 1);
    const bh = Math.max(1, this.h >> 1);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA);
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(this.pBright);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texScene);
    gl.uniform1i(this.u("bright", this.pBright, "uScene"), 0);
    gl.uniform1f(this.u("bright", this.pBright, "uThreshold"), OPTICS.bloomThreshold);
    this.quad();

    /* ---------- ③④ التمويه المنفصل ---------- */
    const r = OPTICS.bloomRadius;
    gl.useProgram(this.pBlur);
    const B = (n: string) => this.u("blur", this.pBlur, n);
    gl.uniform1i(B("uTex"), 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
    gl.bindTexture(gl.TEXTURE_2D, this.texA);
    gl.uniform2f(B("uDir"), r / bw, 0);
    this.quad();

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA);
    gl.bindTexture(gl.TEXTURE_2D, this.texB);
    gl.uniform2f(B("uDir"), 0, r / bh);
    this.quad();

    /* ---------- ⑤ التركيب ---------- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.pComposite);
    const C = (n: string) => this.u("composite", this.pComposite, n);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texScene);
    gl.uniform1i(C("uScene"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texA);
    gl.uniform1i(C("uBloom"), 1);

    gl.uniform3fv(C("uGround"), GROUND as unknown as Float32List);
    gl.uniform3fv(C("uBlue"), BLUE as unknown as Float32List);
    gl.uniform3fv(C("uGoldWhite"), GOLD_WHITE as unknown as Float32List);
    gl.uniform1f(C("uBloomStrength"), OPTICS.bloomStrength * (1 + f.bloom * 0.7));
    gl.uniform1f(C("uVignette"), OPTICS.vignette);
    gl.uniform1f(C("uHaze"), OPTICS.haze);
    gl.uniform1f(C("uIntensity"), f.intensity);
    gl.uniform1f(C("uWarm"), f.gold);
    gl.uniform1f(C("uTime"), f.time);
    gl.uniform1f(C("uEmerge"), f.emerge);

    this.quad();
  }

  /**
   * التحرير — **كلُّ ما خُصِّص يُحرَّر** (§26).
   *
   * و`lose_context` آخرَ شيء: بلا ذلك يبقى السياقُ حيّاً في الطبقة
   * السفلى حتى يجمعه الجامع، وعددُ السياقات محدودٌ في المتصفّح — فتُفتح
   * الشاشةُ وتُغلق بضعَ مرّاتٍ فيُفقد أقدمُها صامتاً.
   */
  destroy() {
    this.stop();

    const gl = this.gl;

    this.freeTargets();
    for (const b of this.buffers) gl.deleteBuffer(b);
    this.buffers = [];

    gl.deleteVertexArray(this.vao);
    gl.deleteVertexArray(this.emptyVao);

    for (const p of [this.pParticles, this.pBright, this.pBlur, this.pComposite]) {
      gl.deleteProgram(p);
    }

    /*
     * **ولا `loseContext()` هنا.**
     *
     * كان يُنادى لتحرير ذاكرة الوحدة الرسومية فوراً. ونتيجتُه أنّ
     * اللوحةَ نفسَها تُسمَّم: السياقُ المفقودُ يلتصق بعنصر `canvas` لا
     * بهذا الكائن، فأيُّ `getContext` تالٍ على العنصر نفسِه يُعيد
     * سياقاً ميّتاً — كلُّ `getShaderParameter` فيه `null`، فتفشل أوّلُ
     * ترجمةٍ برسالةٍ لا تدلّ على شيء (`[boot:particles.vert] null`).
     *
     * ويقع ذلك في كلّ تشغيلٍ للتطوير: `StrictMode` يُجري الأثرَ، ثمّ
     * يُنظّف، ثمّ يُجريه ثانيةً — **على عنصر اللوحة نفسِه**. فالتنظيفُ
     * الأوّلُ يقتل ما سيحتاجه التركيبُ الثاني.
     *
     * والسياقُ يُجمع مع عنصره حين يُزال من الشجرة، فما اشتراه هذا
     * السطرُ كان تعجيلاً لا أكثر — بثمن أنّ المشهدَ لا يعمل مرّتين.
     */
  }
}

/**
 * جودةٌ تُقدَّر من قدرة الجهاز — **قبليّاً لا بقياس الإطارات**.
 *
 * وقياسُ المعدّل ثمّ الخفضُ عند التعثّر يُري المستخدم ثوانيَ متلعثمةً
 * في أوّل ما يفتح البرنامج، وأوّلُ انطباعٍ في شاشة إقلاعٍ لا يُصلَح
 * بعده. (والمنطقُ نفسُه المستعمل في `components/environment/scene.ts`،
 * فلا تقديران متنافسان في التطبيق الواحد.)
 */
export const detectQuality = (): Quality => {
  const cores = navigator.hardwareConcurrency ?? 4;
  const dpr = window.devicePixelRatio ?? 1;
  const pixels = window.screen.width * window.screen.height * dpr * dpr;

  if (cores <= 2 || pixels > 12_000_000) return "low";
  if (cores <= 4 || pixels > 6_000_000) return "medium";

  return "high";
};
