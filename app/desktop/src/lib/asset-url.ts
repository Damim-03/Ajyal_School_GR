import { apiBaseUrl } from "../core/api/base-url";

/**
 * أصل الخادم بلا `/api` — لخدمة `/uploads` الثابتة.
 *
 * **يُحسب عند كلّ نداء لا مرّةً عند تحميل الوحدة.**
 *
 * كان يُشتقّ من `appConfig.API_URL` أي من `VITE_API_URL` المخبوز في
 * الحزمة. وعنوانُ الخادم صار يُضبط زمنَ التشغيل من شاشة «الشبكة»
 * (`core/api/base-url.ts`)، فكانت النتيجة انشقاقاً صامتاً: الطلبات
 * تذهب إلى الخادم الذي اختاره الموظّف، والصورُ وحدها تُطلب من
 * العنوان المخبوز — صورةُ كلّ طالبٍ وأستاذٍ وشعارُ المؤسسة.
 *
 * ولا يظهر ذلك على جهاز البناء لأنّ العنوانين واحد. يظهر على كلّ
 * جهازٍ آخر: مؤسسةٌ خادمُها في الشبكة المحلّية بلا إنترنت تفتح
 * التطبيق فيعمل كلُّ شيءٍ إلّا الصور، بلا رسالةِ خطأ.
 */
const serverOrigin = (): string => apiBaseUrl().replace(/\/api\/?$/, "");

/**
 * يحوّل المسار المخزَّن إلى رابط قابل للعرض.
 *
 * ‏"/uploads/x.png" → رابط الخادم الكامل، والرابط الكامل يمرّ كما هو،
 * وما عداهما `undefined` — فمسارٌ لا يُعرض أصدق من صورة مكسورة.
 */
export function assetUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/uploads")) return serverOrigin() + value;
  return undefined;
}
