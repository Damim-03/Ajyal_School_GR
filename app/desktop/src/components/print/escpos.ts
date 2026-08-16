/**
 * تنقيط الإيصال وترميزه ESC/POS — لغة طابعات الإيصالات الحرارية.
 *
 * **منقولٌ عن SKK-GR** بعد أن أثبت نفسه على عتادٍ أعند (طابعة ملصقات لا
 * تفهم ESC/POS أصلاً). وطابعة هذا المركز `Xprinter XP-P301G` طابعةُ
 * إيصالاتٍ تتكلّمها أصلاً، فسقط منه ما كان لأجل تلك — وبقي جوهرُه.
 *
 * **لماذا صورة لا نصّاً.** أوامر الطباعة النصّية تمرّ بصفحات ترميز
 * الطابعة، والعربية فيها بابُ وجعٍ معروف: تحتاج صفحة 864 أو ما يقابلها،
 * ولا تُشكِّل الحروف ولا تصلها، وتختلف من طراز لآخر. فالنصّ العربي يخرج
 * حروفاً منفصلة مقلوبة الترتيب أو مربّعات.
 *
 * والمتصفّح يعرف كيف يُشكّل العربية ويصلها ويرتّبها — فعلها في المعاينة
 * أمام عينيك. فبدل أن نعيد بناء ذلك في الطابعة، **نُنقّط ما رسمه
 * المتصفّح** ونرسله رسماً نقطياً. والنتيجة أنّ المطبوع مطابق للمعاينة
 * بالضرورة لا بالمصادفة: مصدرهما واحد. والباركود يخرج معه صورةً كذلك،
 * فيُمسح كما يُمسح المطبوع بالسائق.
 */

/** عرض الطباعة بالنقاط. الطابعات الحرارية 203dpi = 8 نقاط/مم. */
export const PRINT_DOTS = {
  /** ورق 80mm: المساحة القابلة للطباعة 72mm = 576 نقطة (الأشيع). */
  "80mm": 576,
  /** ورق 72mm: المساحة نفسها عملياً. */
  "72mm": 576,
} as const;

export type ThermalWidth = keyof typeof PRINT_DOTS;

/** رسمٌ نقطي أحادي البتّ — التمثيل الوسيط بين الشاشة والطابعة. */
export interface Raster {
  width: number;
  height: number;
  /** `ceil(width/8)` بايت للصفّ، بلا حشو. البتّ المضبوط = حبر. */
  bytesPerRow: number;
  bits: Uint8Array;
}

/**
 * يحوّل لوحة رسم إلى رسمٍ نقطي أحادي البتّ.
 *
 * مفصولٌ عن الترميز عمداً: التنقيط هو المرحلة الثقيلة، وفصلُه يتيح
 * تنفيذه **قبل** ضغطة الطباعة — بينما ينظر المستخدم إلى المعاينة.
 */
export function canvasToRaster(canvas: HTMLCanvasElement, threshold = 200): Raster {
  const w = canvas.width;
  const h = canvas.height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("تعذّر قراءة لوحة الرسم");
  const img = ctx.getImageData(0, 0, w, h);

  /*
   * قراءة البكسل ككلمة 32-بت واحدة، لا أربع قراءات منفصلة.
   *
   * الإيصال 576×2000 نحو 1.2 مليون بكسل، وكلٌّ كان يُقرأ أربع مرّات من
   * `Uint8ClampedArray`. القراءة الواحدة تُسقط ثلاثة أرباعها،
   * والاستخراج بعدها إزاحاتٌ على مسجّل — أرخص من الفهرسة بمراحل.
   *
   * والترتيب داخل الكلمة ترتيبُ النظام (little-endian على x86/ARM):
   * R في البايت الأدنى وA في الأعلى.
   */
  const px32 = new Uint32Array(img.data.buffer, img.data.byteOffset, w * h);
  // العتبة مضروبة مسبقاً: نقارن مجموعاً موزوناً بلا قسمة داخل الحلقة.
  const cut = threshold * 1000;

  /*
   * بايتٌ لكل ثماني نقاط أفقية، والعرض مُدوَّر لأعلى مع ترك الفائض
   * أبيض — القصّ كان سيبتر آخر أعمدة الجدول.
   */
  const bytesPerRow = Math.ceil(w / 8);
  const bits = new Uint8Array(bytesPerRow * h);

  for (let y = 0; y < h; y++) {
    const rowStart = y * w;
    const outRow = y * bytesPerRow;

    for (let x = 0; x < w; x++) {
      const v = px32[rowStart + x];

      /*
       * الشفاف يُعامَل أبيض. لولا ذلك لخرجت خلفية الإيصال سوداء صمّاء
       * حين تكون اللوحة بلا لون أساس — وهو أوّل ما يقع فيه هذا التحويل.
       */
      if ((v & 0xff00_0000) === 0) continue;

      const lum =
        (v & 0xff) * 299 + ((v >>> 8) & 0xff) * 587 + ((v >>> 16) & 0xff) * 114;

      // أعلى بتّ في البايت هو أقصى اليسار.
      if (lum < cut) bits[outRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }

  return { width: w, height: h, bytesPerRow, bits };
}

/**
 * يضغط الفجوات البيضاء الطويلة — أقلُّ بايتاتٍ وأقلُّ ورقاً.
 *
 * كلّ صفٍّ يُحذف يوفّر 72 بايتاً على السلك ومليمترَ ورقٍ في كل إيصال.
 * والحدّ يُبقي الفصل بين الأقسام مرئياً: يُقصّ ما زاد عن `maxRun` لا
 * كلّ الفراغ، فالإيصال يخرج أضيق تباعداً لا مُلتصقاً.
 */
export function compactBlankRuns(r: Raster, maxRun = 12): Raster {
  const keep: number[] = [];
  let run = 0;

  for (let y = 0; y < r.height; y++) {
    let blank = true;
    const s = y * r.bytesPerRow;

    for (let i = 0; i < r.bytesPerRow; i++) {
      if (r.bits[s + i] !== 0) {
        blank = false;
        break;
      }
    }

    if (blank) {
      if (++run <= maxRun) keep.push(y);
    } else {
      run = 0;
      keep.push(y);
    }
  }

  if (keep.length === r.height) return r;

  const bits = new Uint8Array(r.bytesPerRow * keep.length);

  for (let k = 0; k < keep.length; k++) {
    bits.set(
      r.bits.subarray(keep[k] * r.bytesPerRow, (keep[k] + 1) * r.bytesPerRow),
      k * r.bytesPerRow,
    );
  }

  return { width: r.width, height: keep.length, bytesPerRow: r.bytesPerRow, bits };
}

/**
 * يبني بايتات ESC/POS من رسمٍ نقطي.
 *
 * وجوهرُ المكسب أنّ ESC/POS **يطبع أثناء الاستقبال**: كل شريحة
 * `GS v 0` تُطبع فور وصولها. فالورقة تتحرّك من الثانية الأولى ولا
 * تتوقّف، ولا حدّ لطولها. وهذا ما يجعلها «فورية» بالمعنى الذي يهمّ —
 * بخلاف المرور بالسائق حيث تُبنى الصفحة كاملةً قبل أن تتحرّك البكرة.
 */
export function rasterToEscPos(
  r: Raster,
  opts: { feed?: number; cut?: boolean; band?: number } = {},
): Uint8Array {
  /*
   * `band` — أسطر أمر `GS v 0` الواحد.
   *
   * 128 سطراً (16مم) قيمة محافظة: أصغر من مخزن أيّ طراز، وكبيرة بما
   * يكفي كي لا تُثقل الترويسات. وهي مصدر الانسياب: الطابعة تطبع
   * الشريحة الأولى بينما الثانية في السلك.
   */
  const { feed = 4, cut = true, band = 128 } = opts;
  const ESC = 0x1b;
  const GS = 0x1d;

  const parts: Uint8Array[] = [];
  // تهيئة تمسح حالة إيصالٍ سابق، ثمّ توسيط.
  parts.push(Uint8Array.from([ESC, 0x40, ESC, 0x61, 0x01]));

  for (let top = 0; top < r.height; top += band) {
    const rows = Math.min(band, r.height - top);

    /*
     * `GS v 0 m xL xH yL yH` — العرض بالبايتات والارتفاع بالأسطر،
     * كلاهما بالبايت الأصغر أولاً. و`m = 0` وضعٌ عادي بلا مضاعفة.
     *
     * ولا عكس للبتّات هنا: في ESC/POS البتّ المضبوط نقطةٌ مطبوعة —
     * وهو فرقٌ يُخرج إيصالاً أسودَ صمّاء إن أُغفل.
     */
    parts.push(
      Uint8Array.from([
        GS, 0x76, 0x30, 0x00,
        r.bytesPerRow & 0xff, (r.bytesPerRow >> 8) & 0xff,
        rows & 0xff, (rows >> 8) & 0xff,
      ]),
    );

    parts.push(r.bits.subarray(top * r.bytesPerRow, (top + rows) * r.bytesPerRow));
  }

  const tail: number[] = [];
  for (let i = 0; i < feed; i++) tail.push(0x0a);
  // قطع جزئي يترك وصلة صغيرة فلا يسقط الإيصال.
  if (cut) tail.push(GS, 0x56, 0x42, 0x00);
  parts.push(Uint8Array.from(tail));

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;

  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }

  return out;
}
