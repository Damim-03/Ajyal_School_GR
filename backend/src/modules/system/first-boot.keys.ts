/**
 * مفاتيحُ إعدادات النظام — أسماءٌ في مكانٍ واحد.
 *
 * ولا جدولَ جديد: `Setting` مفتاحٌ/قيمةٌ موجودٌ ويخدم هويةَ المدرسة
 * منذ البداية، وإضافةُ جدولٍ لأربعةَ عشرَ تفضيلاً كانت ستعني migration
 * وعموداً لكلّ خيارٍ يُضاف لاحقاً. والقيمةُ نصٌّ دائماً — تُفسَّر عند
 * القراءة كما في `school.schema.ts`.
 *
 * **وحدُّ المفتاح 64 محرفاً** (`@db.VarChar(64)`)، وكلُّ ما هنا دونه.
 *
 * وبادئةُ `system.` تفصلها عن `school.`: تلك تصف **المؤسسة** فتُطبع
 * على الإيصالات، وهذه تصف **التركيب** فلا تخرج من الجهاز.
 */

export const SYSTEM_KEYS = {
  // --- حالةُ التهيئة نفسِها ---
  status: "system.first_boot.status",
  step: "system.first_boot.step",
  /** مصفوفةُ الخطوات المتمّة، JSON — وهي الحقيقةُ التي تُشتقّ منها الخطوة */
  done: "system.first_boot.done",
  version: "system.first_boot.version",
  startedAt: "system.first_boot.started_at",
  completedAt: "system.first_boot.completed_at",
  /**
   * تركيبٌ سابقٌ للتهيئة، اعتُرف به لا مرّ بها.
   *
   * مؤسّساتٌ تعمل اليوم رُكّبت بالسكربت قبل وجود هذه الشاشات. وحملُها
   * على المرور بها كان سيقفل تطبيقاً يعمل خلف شاشةِ «مرحباً» ويطلب
   * إنشاءَ مديرٍ ثانٍ. فتُقرأ حالتُها من الواقع مرّةً وتُختم (§58).
   */
  adopted: "system.first_boot.adopted",

  // --- ما تكتبه الخطوات ---
  language: "system.language",
  country: "system.region.country",
  timezone: "system.region.timezone",
  dateFormat: "system.region.date_format",
  networkMode: "system.network.mode",
  uiScale: "system.display.ui_scale",
  density: "system.display.density",
  windowMode: "system.display.window_mode",
  performance: "system.performance.profile",
  termsVersion: "system.terms.version",
  termsAcceptedAt: "system.terms.accepted_at",
  termsAcceptedBy: "system.terms.accepted_by",
  updateChannel: "system.update.channel",
  updateCheckedAt: "system.update.checked_at",
  appVersion: "system.update.app_version",
  /** ملخّصُ ما وُجد من أجهزة، JSON — لا تُخزَّن الأجهزةُ صفوفاً */
  devices: "system.devices.summary",
  diagnostics: "system.privacy.diagnostics",
  recoveryPhone: "system.recovery.phone",

  /** لوحةُ «ابنِ مؤسستك» بعد الدخول — تُطوى بيد المستخدم (§65) */
  onboardingDismissed: "system.onboarding.dismissed",
} as const;

export type SystemKey = (typeof SYSTEM_KEYS)[keyof typeof SYSTEM_KEYS];

// --------------------------------------------------
// القيمُ المسموحة — تُقرأ في المخطّطات وفي الواجهة
// --------------------------------------------------

export const LANGUAGES = ["ar", "en", "fr"] as const;
export type Language = (typeof LANGUAGES)[number];

export const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;

/**
 * نمطُ التشغيل — محلّيٌّ أو خادمٌ على الشبكة (§35).
 *
 * وليست هذه «واي‑فاي»: التطبيقُ يعمل على المكتب مع خادمٍ وقاعدةٍ قد
 * يكونان على الجهاز نفسِه أو على جهازِ الإدارة. **والإنترنت ليس شرطاً
 * في الحالين** — لا شيء في NexSchool يخرج من الشبكة المحلّية.
 */
export const NETWORK_MODES = ["LOCAL", "SERVER"] as const;

export const UI_SCALES = ["SMALL", "DEFAULT", "LARGE"] as const;
export const DENSITIES = ["COMFORTABLE", "COMPACT"] as const;
export const WINDOW_MODES = ["WINDOWED", "MAXIMIZED", "FULLSCREEN"] as const;
export const PERFORMANCE_PROFILES = [
  "BALANCED",
  "PERFORMANCE",
  "POWER_SAVING",
] as const;

export type PerformanceProfile = (typeof PERFORMANCE_PROFILES)[number];
