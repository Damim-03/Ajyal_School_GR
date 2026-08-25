/**
 * عنوانُ الخادم — **يُضبط زمنَ التشغيل لا زمنَ البناء**.
 *
 * كان `VITE_API_URL` يُخبَز في الحزمة، فمؤسسةٌ خادمُها على جهاز
 * الإدارة (`192.168.1.20`) لا سبيل لها إلّا أن يُعاد بناءُ التطبيق
 * لها وحدها. وشاشةُ «الشبكة» في التهيئة (§11/§35) تسأل عن هذا
 * العنوان بالضبط — فلو بقي مخبوزاً لكانت الشاشةُ نموذجاً يُملأ ولا
 * يقع منه شيء (§67).
 *
 * **ويُحفظ في الجهاز لا في القاعدة.** وهذا ليس اختصاراً: هو طريقُ
 * هذا الجهاز **إلى** القاعدة، وحفظُه فيها دَورٌ مغلق — لتقرأه يجب أن
 * تصل، ولتصل يجب أن تقرأه. ثمّ إنّه يختلف باختلاف الجهاز على الشبكة
 * الواحدة، فهو تفضيلُ جهازٍ لا تفضيلُ مؤسسة (كما `ajyal_printer`).
 */

const STORAGE_KEY = "nexschool_api_url";

/** ما بُني به التطبيق — الافتراضيُّ حين لا يُضبط شيء */
const BUILT_IN =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3001/api";

/**
 * تطبيعُ ما يكتبه المستخدم إلى عنوانٍ صالح.
 *
 * فهو يكتب `192.168.1.20:3001` أو `http://192.168.1.20:3001/` أو
 * العنوانَ كاملاً ببادئة `/api`. والثلاثةُ يقصد بها شيئاً واحداً،
 * ورفضُ اثنين منها بحجّة الصيغة عطبٌ في الواجهة لا في الإدخال.
 */
export const normalizeApiUrl = (raw: string): string => {
  const trimmed = raw.trim();

  if (!trimmed) return "";

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  let url: URL;

  try {
    url = new URL(withScheme);
  } catch {
    return "";
  }

  /* المسارُ يُنظَّف ثمّ تُضاف `/api` مرّةً واحدة — لا `/api/api` */
  const path = url.pathname.replace(/\/+$/, "");
  const base = path.endsWith("/api") ? path : `${path}/api`;

  return `${url.protocol}//${url.host}${base}`;
};

/** بناءُ عنوانٍ من مضيفٍ ومنفذ — ما تكتبه شاشةُ الشبكة */
export const buildApiUrl = (host: string, port: number | string): string =>
  normalizeApiUrl(`${host}:${port}`);

const readStored = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    /* وضعٌ خاصٌّ يمنع التخزين — يُعمل بالمخبوز */
    return "";
  }
};

/**
 * العنوانُ الفعّالُ الآن.
 *
 * ويُقرأ في كلّ نداءٍ لا مرّةً عند التحميل: تبديلُ الخادم من شاشة
 * الشبكة يجب أن يسري على الطلب التالي مباشرةً، لا بعد إعادةِ تشغيل
 * التطبيق — وإلّا صار زرُّ «فحص الاتصال» يفحص الخادمَ القديم ويقول
 * إنّ الجديد يعمل.
 */
export const apiBaseUrl = (): string => readStored() || BUILT_IN;

export const isCustomApiUrl = (): boolean => readStored().length > 0;

export const builtInApiUrl = (): string => BUILT_IN;

export const saveApiUrl = (url: string) => {
  const normalized = normalizeApiUrl(url);

  try {
    if (!normalized || normalized === BUILT_IN) {
      localStorage.removeItem(STORAGE_KEY);
      return BUILT_IN;
    }

    localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    /* لا تخزين — يبقى العنوانُ للجلسة عبر `apiClient.defaults` */
  }

  return normalized || BUILT_IN;
};

export const clearApiUrl = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* لا شيء يُفعل */
  }
};
