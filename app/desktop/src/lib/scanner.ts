import { invoke } from "@tauri-apps/api/core";

/**
 * الماسح الضوئي — جسرٌ إلى أوامر Tauri في `src-tauri/src/scanner.rs`.
 *
 * وخارج Tauri (المتصفّح أثناء التطوير) لا ماسحَ ولا خطأ: `canScan()`
 * تُرجع false فتُخفي الواجهة الخيار كلَّه. زرٌّ يظهر ثمّ يعتذر عند الضغط
 * أسوأ من زرٍّ لا يظهر.
 */

const inTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const canScan = () => inTauri();

export interface Scanner {
  id: string;
  name: string;
}

/** درجة الألوان — بمصطلح المستخدم لا بأرقام WIA */
export type ScanColor = "color" | "gray" | "text";

export const SCAN_COLORS: { value: ScanColor; label: string; hint: string }[] = [
  { value: "color", label: "ألوان", hint: "للصور الشخصية والوثائق الملوّنة" },
  { value: "gray", label: "رمادي", hint: "لوثيقةٍ مطبوعة — ملفٌّ أخفّ" },
  { value: "text", label: "نصّ", hint: "أبيض وأسود حادّ — للنصّ وحده" },
];

/**
 * الدقّات المعروضة — لا حقلٌ حرّ.
 *
 * 200 تكفي لوثيقةٍ تُقرأ على الشاشة، و300 معيار الوثائق الرسمية، و600
 * لصورةٍ ستُكبَّر. وما فوقها يُخرج ملفّاتٍ بعشرات الميغابايت لا تُضيف
 * تفصيلاً يراه أحد، ويُبطئ الماسح دقائق.
 */
export const SCAN_RESOLUTIONS = [
  { value: 200, label: "200 نقطة", hint: "سريع — وثيقة تُقرأ" },
  { value: 300, label: "300 نقطة", hint: "المعتاد للوثائق الرسمية" },
  { value: 600, label: "600 نقطة", hint: "بطيء — صورة ستُكبَّر" },
];

export const listScanners = async (): Promise<Scanner[]> => {
  if (!inTauri()) return [];
  return invoke<Scanner[]>("list_scanners");
};

interface ScannedPage {
  base64: string;
  mime: string;
  width: number;
  height: number;
}

/** نوع المحتوى ← الامتداد المكتوب في اسم الملف */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/tiff": "tif",
  "image/gif": "gif",
  "image/bmp": "bmp",
};

/**
 * يمسح صفحةً ويُعيدها ملفّاً جاهزاً للمحرّر ثمّ للرفع.
 *
 * **والصيغة تأتي من الماسح لا تُفترض**: الخادم يطلب JPEG، لكنّ بعض
 * المشغّلات ترفض تحويلَ WIA فتخرج الصفحة BMP. وتسميتُها `.jpg` كانت
 * تُنتج ملفّاً يكذب على قارئه — ولا ضير في الصيغة الأصلية أصلاً، لأنّ
 * المحرّر يُعيد ترميز كل شيء JPEG عند الحفظ.
 *
 * والاسم يحمل ختم الوقت: الخادم يحفظ باسمٍ من عنده، لكنّ هذا الاسم هو
 * ما يظهر في خانة الوثيقة — و«مسح» ثلاث مرّات لا يميّز شيئاً.
 */
export const scanPage = async (options: {
  device?: string;
  dpi?: number;
  color?: ScanColor;
}): Promise<File> => {
  const page = await invoke<ScannedPage>("scan_page", {
    device: options.device || null,
    dpi: options.dpi ?? 300,
    color: options.color ?? "color",
  });

  /* base64 → بايتات → Blob: `fetch` على data: يعمل، لكنّه يمرّ بطبقة
     شبكةٍ كاملة لملفٍّ بعشرة ميغابايت هو أصلاً في الذاكرة */
  const binary = atob(page.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const mime = page.mime || "image/bmp";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  return new File([bytes], `مسح-${stamp}.${EXTENSIONS[mime] ?? "bmp"}`, {
    type: mime,
  });
};
