/**
 * تفضيلاتُ النظام — **وهي تفعل ما تقوله** (§12/§13/§29).
 *
 * كلُّ خيارٍ في شاشتَي «العرض» و«الأداء» يمرّ من هنا إلى أثرٍ حقيقيّ
 * في التطبيق. ولا خيارَ يُعرض ليس له في هذا الملفّ سطرٌ يُنفّذه — وهذا
 * هو الفرقُ بين تهيئةٍ وشاشةِ إعداداتٍ مزيَّنة.
 *
 * وأينَ تُطبَّق:
 *
 *   مقياسُ الواجهة  → `font-size` على الجذر. وTailwind v4 يقيس بالـrem،
 *                     فالنصُّ والمسافاتُ والارتفاعاتُ تتبع الجذرَ كلُّها.
 *   الكثافة        → `--spacing` — المتغيّرُ الذي تشتقّ منه كلُّ أدوات
 *                     المسافة في Tailwind v4 (`p-4` = `--spacing × 4`).
 *                     سطرٌ واحدٌ يُضيّق التطبيقَ كلَّه أو يُوسّعه.
 *   وضعُ النافذة    → نافذةُ Tauri فعلاً (تكبيرٌ/ملءُ شاشة).
 *   ملمحُ الأداء    → سكونُ الحركة، وإيقاعُ استجلاب البيانات.
 *
 * **وتُحفظ محلياً** لأنّها تُطبَّق قبل أوّل طلبٍ إلى الخادم: أوّلُ إطارٍ
 * يُرسم يجب أن يكون بالمقياس الذي اختاره المستخدم لا بالافتراضيّ ثمّ
 * يقفز. والخادمُ يبقى المرجع، وهذه نسخةٌ منه تُحدَّث عند كل قراءةٍ
 * للحالة.
 */

export type UiScale = "SMALL" | "DEFAULT" | "LARGE";
export type Density = "COMFORTABLE" | "COMPACT";
export type WindowMode = "WINDOWED" | "MAXIMIZED" | "FULLSCREEN";
export type PerformanceProfile = "BALANCED" | "PERFORMANCE" | "POWER_SAVING";

export interface SystemPreferences {
  uiScale: UiScale;
  density: Density;
  windowMode: WindowMode;
  performance: PerformanceProfile;
}

export const DEFAULT_PREFERENCES: SystemPreferences = {
  uiScale: "DEFAULT",
  density: "COMFORTABLE",
  windowMode: "MAXIMIZED",
  performance: "BALANCED",
};

const STORAGE_KEY = "nexschool_system_prefs";

// --------------------------------------------------
// القيمُ المطبَّقة
// --------------------------------------------------

/**
 * جذرُ القياس بالبكسل.
 *
 * والمدى ضيّقٌ عمداً — 14 إلى 18: ما دون ذلك يُنتج نصّاً لا يُقرأ على
 * شاشةٍ بعيدة، وما فوقه يكسر التخطيطاتِ ذاتَ العمودين على حاسوبٍ
 * محمول. و«افتراضي» 16 هو ما بُني عليه التطبيق كلُّه.
 */
const ROOT_FONT_PX: Record<UiScale, number> = {
  SMALL: 14,
  DEFAULT: 16,
  LARGE: 18,
};

/** `--spacing` في Tailwind v4 — الافتراضيّ 0.25rem */
const SPACING_REM: Record<Density, string> = {
  COMFORTABLE: "0.25rem",
  COMPACT: "0.215rem",
};

// --------------------------------------------------
// الحفظ والقراءة
// --------------------------------------------------

const isScale = (value: unknown): value is UiScale =>
  value === "SMALL" || value === "DEFAULT" || value === "LARGE";

const isDensity = (value: unknown): value is Density =>
  value === "COMFORTABLE" || value === "COMPACT";

const isWindowMode = (value: unknown): value is WindowMode =>
  value === "WINDOWED" || value === "MAXIMIZED" || value === "FULLSCREEN";

const isProfile = (value: unknown): value is PerformanceProfile =>
  value === "BALANCED" || value === "PERFORMANCE" || value === "POWER_SAVING";

let cached: SystemPreferences | null = null;

export const readPreferences = (): SystemPreferences => {
  if (cached) return cached;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;

    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;

      cached = {
        uiScale: isScale(record.uiScale) ? record.uiScale : DEFAULT_PREFERENCES.uiScale,
        density: isDensity(record.density)
          ? record.density
          : DEFAULT_PREFERENCES.density,
        windowMode: isWindowMode(record.windowMode)
          ? record.windowMode
          : DEFAULT_PREFERENCES.windowMode,
        performance: isProfile(record.performance)
          ? record.performance
          : DEFAULT_PREFERENCES.performance,
      };

      return cached;
    }
  } catch {
    /* تخزينٌ ممنوع أو قيمةٌ تالفة — يُعمل بالافتراضيّ */
  }

  cached = DEFAULT_PREFERENCES;
  return cached;
};

export const savePreferences = (patch: Partial<SystemPreferences>) => {
  const next = { ...readPreferences(), ...patch };

  cached = next;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* تبقى للجلسة */
  }

  applyPreferences(next);

  return next;
};

// --------------------------------------------------
// التطبيق
// --------------------------------------------------

/**
 * الحركةُ ساكنة؟
 *
 * ومصدرانِ لا واحد: تفضيلُ النظام (§50) **و**ملمحُ «توفير الطاقة».
 * وقراءتُهما من دالّةٍ واحدة هي التي تجعل الخيارَ حقيقياً: المشهدُ
 * السينمائيّ والدخولُ إلى الرئيسية وكشفُ الحضور كلُّها تسأل هنا،
 * فيسري الاختيارُ عليها جميعاً بلا أن يعلم أيٌّ منها بوجود الشاشة.
 */
export const prefersStillMotion = (): boolean => {
  if (readPreferences().performance === "POWER_SAVING") return true;

  if (typeof window === "undefined" || !window.matchMedia) return false;

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/**
 * إيقاعُ البيانات — يقرؤه `QueryClient` (§13).
 *
 *   أداء      → يُعاد الجلبُ عند العودة إلى النافذة وبعد دقيقة.
 *   متوازن    → خمسُ دقائق، وهو ما كان عليه التطبيق.
 *   توفير     → ربعُ ساعةٍ ولا استجلابَ في الخلفية.
 *
 * وليست أرقاماً تُزيّن: مؤسسةٌ على حاسوبٍ ضعيفٍ بشبكةٍ بطيئة تشعر
 * بالفرق في كل شاشةٍ فيها جدول.
 */
export const queryTuning = () => {
  switch (readPreferences().performance) {
    case "PERFORMANCE":
      return { staleTime: 60_000, refetchOnWindowFocus: true };
    case "POWER_SAVING":
      return { staleTime: 15 * 60_000, refetchOnWindowFocus: false };
    default:
      return { staleTime: 5 * 60_000, refetchOnWindowFocus: false };
  }
};

/**
 * كتابةُ التفضيلات على المستند.
 *
 * وتُنادى مرّتين: عند إقلاع التطبيق (‏`main.tsx`) قبل أوّل رسم، وعند
 * كل تبديلٍ في شاشة العرض — فيرى المستخدمُ أثرَ اختياره وهو يختار،
 * لا بعد أن يُنهي التهيئة (§12).
 */
export const applyPreferences = (prefs: SystemPreferences = readPreferences()) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  root.style.fontSize = `${ROOT_FONT_PX[prefs.uiScale]}px`;
  root.style.setProperty("--spacing", SPACING_REM[prefs.density]);

  root.dataset.uiScale = prefs.uiScale.toLowerCase();
  root.dataset.density = prefs.density.toLowerCase();

  /*
   * `data-motion="still"` يُطفئ الانتقالاتِ المكتوبةَ بـCSS خام —
   * وهي التي لا تمرّ بـ`motion` فلا يبلغها `prefersStillMotion`.
   * القاعدةُ نفسُها في `index.css` مع استعلام تفضيل النظام.
   */
  root.dataset.motion = prefersStillMotion() ? "still" : "full";
};

/**
 * وضعُ النافذة — عبر Tauri، وبلا أثرٍ في المتصفّح.
 *
 * والاستيرادُ ديناميٌّ كما في `lib/app-window.ts`: الواجهةُ تُطوَّر على
 * 5173 حيث لا Tauri، واستيرادٌ ساكنٌ كان يُسقط الوحدةَ هناك.
 */
export const applyWindowMode = async (mode: WindowMode) => {
  const hasTauri =
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>);

  if (!hasTauri) return false;

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();

    if (mode === "FULLSCREEN") {
      await win.setFullscreen(true);
      return true;
    }

    await win.setFullscreen(false);

    if (mode === "MAXIMIZED") await win.maximize();
    else await win.unmaximize();

    return true;
  } catch {
    /* صلاحيةٌ ناقصة في `capabilities` — لا شيء يُكسر */
    return false;
  }
};
