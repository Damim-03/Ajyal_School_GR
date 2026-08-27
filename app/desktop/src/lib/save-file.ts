/**
 * **حفظُ ملفٍّ حيث يختار المستخدم — لا حيث يقرّر المتصفّح.**
 *
 * الوسمُ `<a download>` لا يسأل: يُلقي الملفَّ في مجلّد التنزيلات
 * ويمضي. وهذا سلوكُ متصفّحٍ لا سلوكُ برنامجٍ على سطح المكتب — ومن
 * ضغط «نزّل النموذج» يريد أن يعرف أين وضعه ليفتحه.
 *
 * فداخل Tauri يُفتح حوارُ «حفظ باسم» الأصليّ، ثمّ تُكتب البايتات
 * بأمرِ `save_file` في `src-tauri/src/files.rs`. **ولا إضافةَ `fs`**:
 * المسارُ يجيء من الحوار — أي من المستخدم — فلا يُفتح القرصُ كلُّه
 * للواجهة لأجل ملفٍّ واحد.
 *
 * وخارجه (‏`npm run dev` في متصفّح) يرتدّ إلى الوسم، فلا تتعطّل
 * التجربةُ أثناء التطوير.
 */

import { invoke } from "@tauri-apps/api/core";

/** داخل نافذة Tauri؟ — نفسُ الفحص المستعمل في `native-print` */
const inTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * البايتات إلى base64 على دفعات.
 *
 * `String.fromCharCode(...bytes)` ينهار على المصفوفات الضخمة — تجاوزُ
 * حدّ الوسائط في المكدّس. والتقطيعُ يجعلها تعمل مهما كبر الملفّ.
 */
const toBase64 = (bytes: Uint8Array): string => {
  const CHUNK = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }

  return btoa(binary);
};

export interface SaveOptions {
  /** الاسم المقترح في الحوار */
  readonly suggestedName: string;
  /** وصفُ النوع وامتداداته — «مصنّف Excel» و`xlsx` */
  readonly filterName: string;
  readonly extensions: readonly string[];
}

export type SaveResult = "saved" | "cancelled";

/**
 * يحفظ الملفّ ويُعيد ما فعله المستخدم.
 *
 * و`cancelled` ليست خطأً: من أغلق الحوار قصد ذلك، فلا تُرفع له رسالةُ
 * فشل. أمّا تعذّرُ الكتابة فيُرمى ليُعرض.
 */
export const saveFile = async (
  blob: Blob,
  options: SaveOptions,
): Promise<SaveResult> => {
  if (!inTauri()) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = options.suggestedName;
    link.click();

    URL.revokeObjectURL(url);

    return "saved";
  }

  /*
   * الحوارُ وحده يُستورَد ديناميكياً — و`invoke` في الحزمة أصلاً
   * (يستورده `native-print` ثابتاً)، فتأجيلُه لا يوفّر شيئاً.
   */
  const { save } = await import("@tauri-apps/plugin-dialog");

  const path = await save({
    defaultPath: options.suggestedName,
    filters: [{ name: options.filterName, extensions: [...options.extensions] }],
  });

  if (!path) return "cancelled";

  await invoke("save_file", {
    path,
    data: toBase64(new Uint8Array(await blob.arrayBuffer())),
  });

  return "saved";
};

/** مصنّف Excel — أكثرُ ما يُحفظ في هذا التطبيق */
export const XLSX_FILTER = {
  filterName: "مصنّف Excel",
  extensions: ["xlsx"],
} as const;
