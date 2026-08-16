import { invoke } from "@tauri-apps/api/core";
import { toCanvas } from "html-to-image";

import {
  canvasToRaster,
  compactBlankRuns,
  rasterToEscPos,
  PRINT_DOTS,
  type Raster,
  type ThermalWidth,
} from "./escpos";

/**
 * الطباعة الحرارية الفورية — ESC/POS إلى منفذ الطابعة مباشرةً.
 *
 * **مسارٌ ثانٍ لا بديل.** في المشروع طريقان للطباعة:
 *
 *   `native-print` — WebView2 يرسم الصفحة ويسلّمها لمخزن ويندوز فالسائق.
 *                    صحيحُ المخرَج ويعمل على كل طابعة، وزمنُه ثانيةٌ أو
 *                    ثانيتان. وهو طريق أوراق A4 والكشوف.
 *   `thermal-print` — الإيصال يُنقَّط هنا ويُرسل بايتاتٍ إلى الطابعة
 *                    رأساً. لا مخزنَ ولا سائق: الورقة تتحرّك أثناء وصول
 *                    البايتات. وهو طريق الإيصال الحراري وحده.
 *
 * **والتنقيط مفصولٌ عن الإرسال عمداً.** التنقيط هو المرحلة الثقيلة
 * (نصف ثانية على إيصالٍ كامل)، وفصلُه يتيح تنفيذه **قبل** أن يضغط
 * المستخدم الزرّ — بينما هو ينظر إلى المعاينة — فلا يبقى للضغطة إلّا
 * الإرسال. هذا هو ما يجعلها «فورية» لا سرعةُ السلك.
 */

const inTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export class ThermalError extends Error {}

/**
 * هل تعرف هذه الثنائيّة أوامر الطباعة الحرارية أصلاً؟
 *
 * يفصل «التطبيق قديم لم يُعد بناؤه» عن كل عطلٍ آخر. بلا هذا الفصل يظهر
 * السببان بنفس العرَض — لا شيء يحدث — فيذهب البحث في الاتجاه الخطأ.
 */
export const thermalReady = async (): Promise<boolean> => {
  if (!inTauri()) return false;

  try {
    return await invoke<boolean>("thermal_ready");
  } catch {
    return false;
  }
};

/** أجهزة الطابعات المفتوحة للكتابة المباشرة. فارغةٌ خارج Tauri. */
export const listUsbPrinters = async (): Promise<string[]> => {
  if (!inTauri()) return [];

  try {
    return await invoke<string[]>("list_usb_printers");
  } catch {
    return [];
  }
};

/** يحوّل البايتات إلى base64 على دفعات (`apply` ينهار على المصفوفات الضخمة) */
const toBase64 = (bytes: Uint8Array): string => {
  let s = "";
  const CHUNK = 0x8000;

  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }

  return btoa(s);
};

/** يرمي إن تجاوز الوعد المهلة — فلا يتعلّق الزرّ إلى الأبد بلا تفسير */
const withTimeout = <T>(p: Promise<T>, ms: number, what: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new ThermalError(`${what}: تجاوز ${ms / 1000} ثانية`)),
        ms,
      ),
    ),
  ]);

/**
 * يحوّل عنصر الإيصال إلى رسمٍ نقطي جاهز للإرسال — **بلا طابعة**.
 *
 * والتنقيط بعرض الطابعة بالضبط لا بعرض الشاشة: `canvasWidth` يجعل
 * html-to-image يرسم بمقياسٍ يبلغ به العنصرُ العرضَ المطلوب. ولو
 * نُقِّط بعرض الشاشة ثمّ حُجِّمت الصورة، لمرّت الحروف بإعادة تشكيلٍ
 * ثانية وخرجت مهترئة على ورقٍ لا يملك تدرّجاً رمادياً أصلاً —
 * فالطابعة الحرارية ثنائية: نقطة أو لا نقطة.
 */
export const rasterizeReceipt = async (
  el: HTMLElement,
  width: ThermalWidth = "80mm",
): Promise<Raster> => {
  const dots = PRINT_DOTS[width];
  const rect = el.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    throw new ThermalError("تعذّر قياس الإيصال — الورقة غير معروضة");
  }

  const scale = dots / rect.width;

  const canvas = await withTimeout(
    toCanvas(el, {
      canvasWidth: dots,
      canvasHeight: Math.round(rect.height * scale),
      pixelRatio: 1,
      // خلفية بيضاء صريحة: الشفاف يصير أسود صمّاء عند التحويل الثنائي
      backgroundColor: "#ffffff",
      /*
       * تخطّي تضمين الخطوط — ليس تحسيناً بل إزالة نقطة فشل.
       *
       * تُضمّن المكتبة الخطوطَ بالمرور على `document.styleSheets` وجلب
       * كلّ ما تشير إليه. والإيصال لا يستعمل إلّا `Tahoma`/`Arial` —
       * خطّان في النظام لا يُجلبان أصلاً. فالجلب عملٌ بلا ثمرة، ويرمي
       * إن تعذّر الوصول إلى ورقة أنماط فيسقط التنقيط كلّه معه.
       */
      skipFonts: true,
      style: { margin: "0" },
    }),
    15000,
    "تنقيط الإيصال",
  );

  if (!canvas.width || !canvas.height) {
    throw new ThermalError("خرج الإيصال بمقاس صفر — تعذّر قياس العنصر");
  }

  return canvasToRaster(canvas, 200);
};

/**
 * يرسل رسماً نقطياً محضَّراً إلى الطابعة — الجزء السريع وحده.
 *
 * هذه كلُّ ما تفعله الضغطة حين يكون التنقيط قد تمّ مسبقاً: ترميزٌ
 * ثمّ نداءٌ واحد عبر الجسر.
 */
export const sendRaster = async (
  raster: Raster,
  device?: string,
): Promise<string> => {
  /*
   * الضغط قبل الترميز: يقلّ ما يعبر السلك وما يخرج من ورق معاً، ولا
   * يمسّ بنية الأوامر — يُغيّر محتوى الصورة لا شكل ما يُرسَل.
   */
  const bytes = rasterToEscPos(compactBlankRuns(raster), { feed: 4, cut: true });

  try {
    return await withTimeout(
      invoke<string>("print_usb", {
        device: device ?? null,
        data: toBase64(bytes),
      }),
      60000,
      "الإرسال إلى الطابعة",
    );
  } catch (err) {
    if (err instanceof ThermalError) throw err;

    throw new ThermalError(
      typeof err === "string" ? err : `الإرسال إلى الطابعة: ${err}`,
    );
  }
};

/** المسار الكامل — تنقيطٌ ثمّ إرسال. يُستعمل حين لا تحضير جاهز. */
export const printThermal = async (
  el: HTMLElement,
  width: ThermalWidth = "80mm",
  device?: string,
): Promise<string> => sendRaster(await rasterizeReceipt(el, width), device);
