import { appConfig } from "../core/config/app.config";

/** أصل الخادم بلا /api — لخدمة /uploads الثابتة */
const SERVER_ORIGIN = appConfig.API_URL.replace(/\/api\/?$/, "");

/**
 * يحوّل المسار المخزَّن إلى رابط قابل للعرض.
 *
 * ‏"/uploads/x.png" → رابط الخادم الكامل، والرابط الكامل يمرّ كما هو،
 * وما عداهما `undefined` — فمسارٌ لا يُعرض أصدق من صورة مكسورة.
 */
export function assetUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/uploads")) return SERVER_ORIGIN + value;
  return undefined;
}
