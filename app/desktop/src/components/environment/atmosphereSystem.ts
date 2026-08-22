/**
 * الغلافُ الجوّي — الطبقة الرابعة.
 *
 * كتلُ ضبابٍ منخفضةُ التردّد تنجرف وتتنفّس. وهي ما يفصل «فضاءً أسود
 * فيه نقاط» عن «غرفةٍ مظلمة فيها هواء»: النقاطُ وحدها تسبح في فراغ،
 * والضبابةُ تعطيها وسطاً تُرى من خلاله.
 *
 * وهي إهليلجياتٌ مائلة لا دوائر — والدائرةُ تُقرأ شكلاً مقصوداً، أمّا
 * الإهليلج المائل المتراكب فيُقرأ توزّعاً عشوائياً للهواء. وتُرسم كلُّها
 * من فرشاةٍ واحدة تُبنى مرّةً، فلا تدرّجَ داخل الحلقة.
 */

import type { HazeBlob, SceneOptions, Viewport } from "./types";
import { PALETTE } from "./lightingSystem";

/**
 * فرشاةُ الضباب — بدرجةِ دفءٍ محدَّدة.
 *
 * كان `warmth` يُحسب لكلّ كتلةٍ عند البذر ثمّ **لا يُستعمل**: الفرشاةُ
 * بيضاءُ واحدة، والرسمُ يضبط الشفافية وحدها. فخرج الضبابُ رمادياً في
 * الإطار كلِّه ولو كانت الكتلةُ ملاصقةً للمصباح. وثلاثُ درجاتٍ تكفي —
 * الضبابةُ مساحةٌ واسعةٌ خافتة، والعينُ لا تقرأ فيها تدرّجاً أدقّ.
 */
const hazeSprite = (warmth: number) => {
  const SIZE = 256;

  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas === "function"
      ? new OffscreenCanvas(SIZE, SIZE)
      : Object.assign(document.createElement("canvas"), { width: SIZE, height: SIZE });

  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const half = SIZE / 2;

  const c = [
    Math.round(PALETTE.key[0] * warmth + PALETTE.cool[0] * (1 - warmth)),
    Math.round(PALETTE.key[1] * warmth + PALETTE.cool[1] * (1 - warmth)),
    Math.round(PALETTE.key[2] * warmth + PALETTE.cool[2] * (1 - warmth)),
  ];

  /*
   * انحدارٌ أبطأُ من هالة الضوء: الضبابةُ ليس لها نواةٌ مضيئة بل كثافةٌ
   * تتناقص. فمحطّاتُها موزّعةٌ بانتظامٍ أقربَ إلى الخطّي، ولو أُعطيت
   * نواةً لصارت مصدرَ ضوءٍ ثانياً يُربك تركيبَ المشهد.
   */
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.5)`);
  g.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},0.28)`);
  g.addColorStop(0.65, `rgba(${c[0]},${c[1]},${c[2]},0.09)`);
  g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  return canvas;
};

export class AtmosphereSystem {
  /** ثلاثُ درجاتِ دفء — تُبنى مرّةً ويُختار منها بحسب الكتلة */
  private sprites = [hazeSprite(0), hazeSprite(0.5), hazeSprite(1)];
  blobs: HazeBlob[] = [];

  /**
   * البذر — والتوزيعُ مقصودٌ لا عشوائيّ بالكامل.
   *
   * الثلثُ الأعلى يبقى شبه خالٍ ليحتفظ المشهد بفراغه السالب، والكتلُ
   * تتجمّع في الوسط والأسفل حيث الضبابةُ تُغني عن الفراغ ولا تزاحم
   * الواجهة — النصُّ والزرّ يقعان في الوسط العلويّ.
   */
  seed(count: number, random: () => number) {
    this.blobs.length = 0;

    for (let i = 0; i < count; i += 1) {
      const lower = i / Math.max(1, count - 1);

      const x = 0.08 + random() * 0.88;
      /* منحازةٌ إلى الأسفل: `0.34 + …` يُبقي الأعلى نظيفاً */
      const y = 0.34 + lower * 0.5 + (random() - 0.5) * 0.16;

      this.blobs.push({
        x,
        y,
        radiusX: 0.36 + random() * 0.5,
        radiusY: 0.14 + random() * 0.24,
        opacity: 0.024 + random() * 0.05,
        angle: (random() - 0.5) * 0.7,
        phase: random() * Math.PI * 2,
        /* أبطأُ ممّا كانت — دورةٌ كاملة تتجاوز الدقيقتين فلا يُلتقط تكرارُها */
        speed: 0.008 + random() * 0.015,
        drift: (random() - 0.5) * 0.01,
        /**
         * الدفءُ بالمسافة من المصباح لا بالارتفاع.
         *
         * كان يُشتقّ من `lower` — أي من ترتيب الكتلة في الحلقة — فكانت
         * كتلةٌ في أعلى اليمين تُعدّ دافئةً لأنّها بُذرت أوّلاً، وأخرى
         * ملاصقةٌ للمصباح تُعدّ باردةً لأنّها بُذرت آخِراً. والمقياسُ
         * الصحيح واحدٌ في المشهد كلِّه: القربُ من مصدر الضوء.
         */
        warmth: Math.min(1, 0.15 + Math.max(0, 1 - Math.hypot(x - 0.13, y - 0.04) * 0.85) * 0.95),
      });
    }
  }

  /**
   * الرسم — بالجمع الضوئي وبشفافيةٍ لا تكاد تُذكر.
   *
   * سقفُ الشفافية هنا منخفضٌ عمداً (أقلُّ من 7%): الضبابةُ إن رُئيت
   * صارت غيمةً مرسومة، وإن أُحسّت وحدها أعطت العمق. وهي فوق كلّ شيء
   * ملزمةٌ بألّا تحجب الواجهة — والحجبُ يبدأ حيث تُرى.
   */
  draw(ctx: CanvasRenderingContext2D, view: Viewport, t: number, o: SceneOptions) {
    if (this.blobs.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const blob of this.blobs) {
      const wave = o.reducedMotion ? 0 : Math.sin(t * blob.speed + blob.phase);
      const wave2 = o.reducedMotion ? 0 : Math.cos(t * blob.speed * 0.63 + blob.phase);

      /* الانجرافُ أفقيٌّ أساساً — الهواءُ في غرفةٍ ساكنة يزحف ولا يهبط */
      const cx = (blob.x + (o.reducedMotion ? 0 : Math.sin(t * blob.drift + blob.phase) * 0.05)) * view.width;
      const cy = (blob.y + wave2 * 0.012) * view.height;

      const w = blob.radiusX * view.width * (1 + wave * 0.09);
      const h = blob.radiusY * view.height * (1 + wave2 * 0.11);

      ctx.setTransform(1, 0, 0, 1, cx, cy);
      ctx.rotate(blob.angle + wave * 0.05);
      ctx.globalAlpha = blob.opacity * (0.78 + wave * 0.22) * o.intensity;
      ctx.drawImage(
        this.sprites[Math.min(2, Math.max(0, Math.round(blob.warmth * 2)))]!,
        -w / 2,
        -h / 2,
        w,
        h,
      );
    }

    ctx.restore();
  }

  /**
   * لمسةُ لونٍ باردةٌ على الضباب السفليّ.
   *
   * تُرسم بعد الجسيمات لا قبلها: هواءٌ بين العين والغبار يخفت ما وراءه
   * قليلاً — وهو المنظورُ الجوّي نفسُه الذي يُطبَّق على الجسيم الواحد،
   * لكن على المشهد كلِّه.
   */
  drawVeil(ctx: CanvasRenderingContext2D, view: Viewport, t: number, o: SceneOptions) {
    const swell = o.reducedMotion ? 0 : Math.sin(t * 0.03);

    const g = ctx.createLinearGradient(0, view.height * 0.62, 0, view.height);
    g.addColorStop(0, `rgba(${PALETTE.cool[0]},${PALETTE.cool[1]},${PALETTE.cool[2]},0)`);
    g.addColorStop(1, `rgba(${PALETTE.cool[0]},${PALETTE.cool[1]},${PALETTE.cool[2]},${(0.035 + swell * 0.008) * o.intensity})`);

    ctx.fillStyle = g;
    ctx.fillRect(0, view.height * 0.62, view.width, view.height * 0.38);
  }
}
