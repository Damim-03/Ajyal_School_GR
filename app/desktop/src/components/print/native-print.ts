import { invoke } from "@tauri-apps/api/core";

/**
 * الطباعة المباشرة — جسرٌ إلى أوامر Tauri في `src-tauri/src/printing.rs`.
 *
 * الفرق عن `window.print()` ليس في عدد النقرات: حوار ويندوز يطبع
 * بإعداداته هو — يُصغّر الصفحة «لتناسب» ويكتب في الهامش عنوان النافذة
 * والرابط والتاريخ — فتخرج ورقةٌ غير التي عاينها المستخدم. والأمر
 * الأصلي يفرض A4 وتصغيراً 1.0 وهوامش صفر وبلا ترويسة.
 *
 * وخارج Tauri (المتصفّح أثناء التطوير) يُرجَع إلى `window.print()`:
 * الشاشة تعمل في الحالتين، والفرق في جودة المخرَج لا في توفّره.
 */

const inTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const canPrintDirectly = () => inTauri();

const PRINTER_KEY = "ajyal_printer";

/**
 * الطابعة المختارة تُحفظ لهذا الجهاز — كالورق تماماً، لا تخصّ المدرسة.
 *
 * و`scope` لأنّ المكتب الواحد فيه طابعتان لا واحدة: كانون A4 للكشوف،
 * وحرارية 80 مم للإيصالات. فحفظُ اختيارٍ واحد يعني أن يُعاد الاختيار
 * عند كل ورقة — ومن نسي خرج الإيصال على ورقة A4 كاملة، أو خرج الكشف
 * على شريطٍ عرضه ثمانية سنتيمترات.
 *
 * والفارغ يقرأ المفتاح العامّ، فما حُفظ قبل هذا التقسيم لا يضيع.
 */
const keyFor = (scope: string) =>
  scope ? `${PRINTER_KEY}:${scope}` : PRINTER_KEY;

export const readPrinter = (scope = ""): string => {
  try {
    return (
      localStorage.getItem(keyFor(scope)) ??
      localStorage.getItem(PRINTER_KEY) ??
      ""
    );
  } catch {
    return "";
  }
};

export const savePrinter = (name: string, scope = "") => {
  try {
    localStorage.setItem(keyFor(scope), name);
  } catch {
    /* وضع خاص يمنع التخزين — الاختيار يبقى للجلسة */
  }
};

export const listPrinters = async (): Promise<string[]> => {
  if (!inTauri()) return [];

  try {
    return await invoke<string[]>("list_printers");
  } catch {
    return [];
  }
};

export const defaultPrinter = async (): Promise<string> => {
  if (!inTauri()) return "";

  try {
    return (await invoke<string | null>("default_printer")) ?? "";
  } catch {
    return "";
  }
};

/** مقاس الورقة بالبوصة — وحدة `ICoreWebView2PrintSettings` */
export interface PageSize {
  widthIn: number;
  heightIn: number;
}

/** المليمتر إلى البوصة — المقاسات في الواجهة بالمليمتر */
export const mmToIn = (mm: number) => mm / 25.4;

/**
 * يطبع الصفحة المعروضة مباشرةً.
 *
 * و`page` مقاس الورقة: يُترك فارغاً لأوراق A4، ويُعطى للإيصال الحراري
 * لأنّ عرضه 72 أو 80 مم وطولَه بطول ما طُبع — وفرضُ A4 عليه يُخرج
 * شريطاً أكثرُه أبيض.
 *
 * ويرمي رسالةً عربية عند الفشل (طابعة مطفأة، نسخة WebView2 قديمة) —
 * والمستدعي يعرضها ويترك للمستخدم بديلَ حوار النظام.
 */
export const printDirect = async (
  printer: string,
  landscape = true,
  page?: PageSize,
) => {
  if (!inTauri()) {
    window.print();
    return;
  }

  const args = {
    printer: printer.trim() === "" ? null : printer,
    landscape,
  };

  try {
    await invoke("print_sheet", {
      ...args,
      pageWidth: page?.widthIn ?? null,
      pageHeight: page?.heightIn ?? null,
    });
  } catch (err) {
    const text = String((err as { message?: string })?.message ?? err);

    /*
     * نسخةٌ أقدم من الجانب الأصلي لا تعرف مقاس الصفحة.
     *
     * الواجهة تُحدَّث بإعادة تحميل، والجانب الأصلي لا يُحدَّث إلّا
     * بإعادة بناء. فبين التعديل والبناء تكون الواجهة الجديدة أمام
     * ثنائيّةٍ قديمة — وأن يطبع الإيصال بمقاس A4 خيرٌ من ألّا يطبع.
     */
    if (/pageWidth|pageHeight|invalid args|missing required key/i.test(text)) {
      await invoke("print_sheet", args);
      return;
    }

    throw err;
  }
};
