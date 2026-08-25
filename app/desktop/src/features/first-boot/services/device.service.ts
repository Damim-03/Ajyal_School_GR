/**
 * اكتشافُ الأجهزة — **يُسأل النظامُ ولا يُفترض شيء** (§29).
 *
 * وكلُّ ما هنا يمرّ بجسورٍ قائمةٍ في المشروع منذ قبل التهيئة:
 *   • الطابعات   → `invoke("list_printers")` (‏`src-tauri/src/printing.rs`)
 *   • الحرارية   → `invoke("list_usb_printers")` و`thermal_ready`
 *   • الماسح     → `invoke("list_scanners")` (‏WIA)
 * فلا شيءَ يُخترع لأجل هذه الشاشة، ولا شيءَ يُعرض «متوفّراً» إلّا وقد
 * ردّ به نظامُ التشغيل.
 *
 * **ولوحةُ المفاتيح والفأرة لا تُسردان — تُجرَّبان.** لا واجهةَ في
 * ويندوز تقول «هل ثمّة لوحةُ مفاتيح» جواباً يُعتمد عليه (فكلُّ حاسوبٍ
 * يُبلغ عن واحدةٍ ولو كانت مقطوعة). والدليلُ الوحيدُ الصادق أن يضغط
 * المستخدمُ مفتاحاً ويحرّك الفأرة — وهو دليلٌ تامّ: ما وصلت الضغطةُ
 * إلّا وقد عمل الجهاز.
 *
 * **وقارئُ الباركود لوحةُ مفاتيحَ في نظر النظام** فلا يُسرَد أبداً؛
 * والتجربةُ الوحيدة أن يُقرأ به رمزٌ فعلاً.
 */

import { invoke } from "@tauri-apps/api/core";

import type { DeviceEntry, DeviceKind } from "../types/firstBoot.types";

const inTauri = () =>
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>);

export const canDetectHardware = () => inTauri();

/**
 * ما يُفحص وبأيّ إلزام (§37).
 *
 * ولوحةُ المفاتيح وحدَها `REQUIRED`: بلا كتابةٍ لا يُنشأ حسابٌ ولا
 * يُسجَّل طالب. والفأرةُ اختياريةٌ عمداً — التنقّلُ في هذا التطبيق
 * يعمل بالمفاتيح كاملاً، ومن يعمل على حاسوبٍ محمولٍ بلوحةِ لمسٍ
 * معطّلة يجب أن يمرّ.
 */
export const DEVICE_PLAN: { kind: DeviceKind; requirement: "REQUIRED" | "OPTIONAL" }[] =
  [
    { kind: "KEYBOARD", requirement: "REQUIRED" },
    { kind: "POINTER", requirement: "OPTIONAL" },
    { kind: "DOCUMENT_PRINTER", requirement: "OPTIONAL" },
    { kind: "RECEIPT_PRINTER", requirement: "OPTIONAL" },
    { kind: "SCANNER", requirement: "OPTIONAL" },
    { kind: "BARCODE_SCANNER", requirement: "OPTIONAL" },
  ];

const entry = (
  kind: DeviceKind,
  name: string,
  detected: boolean,
  verified = false,
): DeviceEntry => ({
  kind,
  name,
  requirement:
    DEVICE_PLAN.find((plan) => plan.kind === kind)?.requirement ?? "OPTIONAL",
  detected,
  verified,
});

interface Scanner {
  id: string;
  name: string;
}

/**
 * سؤالُ النظام عن الأجهزة المسرودة.
 *
 * وتُنادى الجسورُ الثلاثةُ معاً لا تباعاً: سردُ الماسحات عبر WIA يأخذ
 * ثانيةً أو أكثر على بعض المشغّلات، وتسلسلُها يجعل الشاشةَ تنتظر
 * مجموعَها.
 */
export const detectListedDevices = async (): Promise<DeviceEntry[]> => {
  if (!inTauri()) return [];

  const [printers, usbPrinters, scanners] = await Promise.all([
    invoke<string[]>("list_printers").catch(() => [] as string[]),
    invoke<string[]>("list_usb_printers").catch(() => [] as string[]),
    invoke<Scanner[]>("list_scanners").catch(() => [] as Scanner[]),
  ]);

  const found: DeviceEntry[] = [];

  if (printers.length > 0) {
    found.push(entry("DOCUMENT_PRINTER", printers[0]!, true));
  }

  /*
   * الطابعةُ الحرارية تُعرف من منفذها لا من اسمها في ويندوز: كثيرٌ
   * منها يُسجَّل باسمٍ عامّ («POS-80») لا يميّزه شيء، و`list_usb_printers`
   * تسرد ما يُكتب إليه مباشرةً — وهو ما تستعمله الإيصالاتُ فعلاً.
   */
  if (usbPrinters.length > 0) {
    found.push(entry("RECEIPT_PRINTER", usbPrinters[0]!, true));
  }

  if (scanners.length > 0) {
    found.push(entry("SCANNER", scanners[0]!.name, true));
  }

  return found;
};

/** الطابعةُ الحرارية جاهزةٌ للكتابة؟ — أدقُّ من مجرّد وجودها في القائمة */
export const thermalReady = async (): Promise<boolean> => {
  if (!inTauri()) return false;

  try {
    return await invoke<boolean>("thermal_ready");
  } catch {
    return false;
  }
};

/**
 * طبعةُ اختبارٍ حقيقية — على الحرارية وحدها.
 *
 * **ولا زرَّ اختبارٍ لطابعة الوثائق هنا**، وهذا مقصود: أمرُ الطباعة
 * الأصليَّ في هذا المشروع (`print_sheet`) يطبع **محتوى النافذة نفسِها**
 * لا صفحةً تُمرَّر إليه — فتشغيلُه من هنا كان سيُخرج ورقةً عليها شاشةُ
 * التهيئة. وزرٌّ يفعل غيرَ ما يقوله أسوأُ من زرٍّ لا يوجد (§29). وطابعةُ
 * الوثائق تُجرَّب من «الإعدادات ← اختبار الطباعة» حيث المعاينةُ مبنيّة.
 *
 * والحراريةُ لها طريقٌ خامّ: `print_usb` تكتب بايتاتِ ESC/POS إلى
 * المنفذ مباشرةً — فالورقةُ تخرج فعلاً أو يعود خطأُ المنفذ كما هو.
 */
export const testReceiptPrint = async (device?: string): Promise<boolean> => {
  if (!inTauri()) return false;

  const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");

  /*
   * ASCII وحده — لا عربية.
   *
   * الطابعةُ الحرارية تطبع بصفحةِ رموزها هي، والعربيةُ تخرج منها
   * رموزاً مبعثرة ما لم تُنقَّط صورةً (وذلك ما تفعله الإيصالات
   * الحقيقية عبر `rasterizeReceipt`). وهذه طبعةُ حياةٍ لا إيصال:
   * غرضُها أن يخرج ورقٌ، فيكفيها أبسطُ ما يُطبع.
   */
  const text =
    "\x1b@" + // تهيئة
    "\x1ba\x01" + // توسيط
    "NexSchool\n" +
    "Printer test\n" +
    `${stamp}\n` +
    "\n\n\n" +
    "\x1dV\x00"; // قصّ

  const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  try {
    await invoke<string>("print_usb", {
      device: device ?? null,
      data: btoa(binary),
    });

    return true;
  } catch {
    return false;
  }
};

/** ما يُبنى منه الطلب — يشمل ما لم يُكتشف، فالخادمُ يسجّل الغياب أيضاً */
export const buildDeviceReport = (
  listed: DeviceEntry[],
  verified: Partial<Record<DeviceKind, boolean>>,
  names: Partial<Record<DeviceKind, string>> = {},
): DeviceEntry[] =>
  DEVICE_PLAN.map((plan) => {
    const found = listed.find((device) => device.kind === plan.kind);
    const isVerified = verified[plan.kind] === true;

    return {
      kind: plan.kind,
      name: names[plan.kind] ?? found?.name ?? "",
      requirement: plan.requirement,
      /*
       * المُجرَّبُ مكتشَفٌ ولو لم يُسرَد — وهذا هو حالُ لوحة المفاتيح
       * وقارئ الباركود: لا يظهران في أيّ قائمة، والضغطةُ عليهما دليلٌ
       * أقوى من أيّ سردٍ يذكرهما.
       */
      detected: Boolean(found) || isVerified,
      verified: isVerified,
    };
  });
