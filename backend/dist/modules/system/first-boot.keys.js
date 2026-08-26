"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERFORMANCE_PROFILES = exports.WINDOW_MODES = exports.DENSITIES = exports.UI_SCALES = exports.NETWORK_MODES = exports.DATE_FORMATS = exports.LANGUAGES = exports.SYSTEM_KEYS = void 0;
exports.SYSTEM_KEYS = {
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
};
// --------------------------------------------------
// القيمُ المسموحة — تُقرأ في المخطّطات وفي الواجهة
// --------------------------------------------------
exports.LANGUAGES = ["ar", "en", "fr"];
exports.DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];
/**
 * نمطُ التشغيل — محلّيٌّ أو خادمٌ على الشبكة (§35).
 *
 * وليست هذه «واي‑فاي»: التطبيقُ يعمل على المكتب مع خادمٍ وقاعدةٍ قد
 * يكونان على الجهاز نفسِه أو على جهازِ الإدارة. **والإنترنت ليس شرطاً
 * في الحالين** — لا شيء في NexSchool يخرج من الشبكة المحلّية.
 */
exports.NETWORK_MODES = ["LOCAL", "SERVER"];
exports.UI_SCALES = ["SMALL", "DEFAULT", "LARGE"];
exports.DENSITIES = ["COMFORTABLE", "COMPACT"];
exports.WINDOW_MODES = ["WINDOWED", "MAXIMIZED", "FULLSCREEN"];
exports.PERFORMANCE_PROFILES = [
    "BALANCED",
    "PERFORMANCE",
    "POWER_SAVING",
];
//# sourceMappingURL=first-boot.keys.js.map