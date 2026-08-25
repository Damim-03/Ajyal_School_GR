/**
 * التحديث — **ولا يُخترع مُحدِّثٌ لا وجود له** (§15/§36).
 *
 * الحقيقةُ في هذا المشروع اليوم: لا `tauri-plugin-updater` في
 * `Cargo.toml` ولا `plugins.updater` في `tauri.conf.json`. فالشاشةُ
 * التي تقول «جارٍ التحميل… ✓ اكتمل التحديث» كانت ستكذب كذبةً كاملة —
 * شريطَ تقدّمٍ لا يقابله بايتٌ واحد.
 *
 * فما الذي يبقى صادقاً؟ **مصالحةُ النسختين**. هذا التطبيقُ نصفُه على
 * المكتب ونصفُه خادمٌ يعمل إلى جانبه، وأكثرُ ما يُعطب هذه التركيبةَ
 * أن تُحدَّث النافذةُ ويبقى الخادمُ قديماً (أو العكس) — فتُنادى مساراتٌ
 * لا توجد وتُقرأ حقولٌ لم تُضف بعد. وهذا فحصٌ **حقيقيٌّ ونافع**،
 * ونتيجتُه تُعرض كما هي.
 *
 * ومتى أُضيف المُحدِّثُ فعلاً، فمكانُه `checkTauriUpdater` أدناه: تُبدَّل
 * الدالّةُ وحدها ويبقى ما حولها.
 */

import axios from "axios";

import { apiBaseUrl } from "../../../core/api/base-url";
import { appConfig } from "../../../core/config/app.config";
import type { UpdateChannel } from "../types/firstBoot.types";

export interface UpdateReport {
  channel: UpdateChannel;
  appVersion: string;
  /** نسخةُ الخادم — فارغةٌ إن لم يُبلَغ */
  serverVersion: string;
  /** هل النافذةُ والخادمُ على نسخةٍ واحدة؟ */
  aligned: boolean;
  /** هل تعذّر بلوغُ الخادم أصلاً؟ */
  serverUnreachable: boolean;
  /** تحديثٌ متاحٌ عبر المُحدِّث الأصلي — `null` إن لم يكن مُعدّاً */
  available: { version: string; notes: string } | null;
}

/**
 * هل ثمّة مُحدِّثٌ أصليٌّ مُعَدّ؟
 *
 * والسؤالُ يُطرح على البيئة لا على قائمةٍ مكتوبة: يُحاول استيرادُ
 * اللاحقة، فإن لم تكن مثبَّتةً سقط الاستيرادُ وعُلم الجواب. وهذا
 * يجعل الشاشةَ تصير صادقةً من نفسها يومَ تُضاف اللاحقة — بلا تعديلِ
 * سطرٍ هنا.
 */
const checkTauriUpdater = async (): Promise<UpdateReport["available"] | "absent"> => {
  const hasTauri =
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>);

  if (!hasTauri) return "absent";

  try {
    /*
     * المُعرِّفُ في متغيّرٍ لا في السلسلة مباشرةً — وهذا مقصودٌ لا
     * التفافٌ على أداة.
     *
     * فالحزمةُ ليست في `package.json`، وسلسلةٌ حرفيّةٌ في `import()`
     * يحلّها المصرِّفُ ساكناً فيسقط البناءُ كلُّه بـ«وحدةٌ غير موجودة»
     * — أي أنّ التطبيقَ لا يُبنى لأجل مسارٍ **يُعرف** أنّه قد لا يوجد
     * وقد كُتب له معالجُ فشلٍ صريح.
     *
     * والنتيجةُ أنّ الشاشةَ تصير صادقةً من نفسها يومَ تُضاف اللاحقة:
     * يُثبَّت `@tauri-apps/plugin-updater` فينجح الاستيرادُ ويظهر
     * التحديثُ — بلا تعديل سطرٍ هنا.
     */
    const specifier = "@tauri-apps/plugin-updater";

    const updater = (await import(/* @vite-ignore */ specifier)) as {
      check?: () => Promise<{ version: string; body?: string } | null>;
    };

    if (typeof updater.check !== "function") return "absent";

    const update = await updater.check();

    if (!update) return null;

    return { version: update.version, notes: update.body ?? "" };
  } catch {
    return "absent";
  }
};

/** نسخةُ الخادم — من فحص الصحّة، وهو مسارٌ عامٌّ يعمل قبل التهيئة */
const fetchServerVersion = async (): Promise<string | null> => {
  try {
    const { data } = await axios.get(`${apiBaseUrl()}/health`, {
      timeout: 8000,
    });

    return typeof data?.version === "string" ? data.version : "";
  } catch {
    return null;
  }
};

export const checkForUpdates = async (): Promise<UpdateReport> => {
  const appVersion = appConfig.APP_VERSION;

  const [native, serverVersion] = await Promise.all([
    checkTauriUpdater(),
    fetchServerVersion(),
  ]);

  const channel: UpdateChannel =
    native === "absent" ? "MANUAL" : "TAURI";

  const unreachable = serverVersion === null;

  return {
    channel,
    appVersion,
    serverVersion: serverVersion ?? "",
    /*
     * خادمٌ لا يُبلغ نسخته (‏تركيبٌ أقدمُ من حقل `version` في
     * `/health`) لا يُعدّ متعارضاً: الغيابُ ليس اختلافاً.
     */
    aligned:
      unreachable || !serverVersion ? true : serverVersion === appVersion,
    serverUnreachable: unreachable,
    available: native === "absent" ? null : native,
  };
};
