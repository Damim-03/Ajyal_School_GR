/**
 * الصوت — واجهة صامتة.
 *
 * النظام البصري المنقول من SKK يستدعي الصوت في مواضع كثيرة (الإقلاع،
 * الدخول، التنقّل بين البلاطات). أُبقيت هذه الاستدعاءات كما هي وجُعلت
 * الواجهة صامتة بدل نزعها من الشيفرة: نزعُها يعني تفكيك تسلسل الحركة
 * ثم إعادة بنائه إن أُضيف الصوت لاحقاً.
 *
 * لتشغيل الصوت فعلياً: ضع الملفات في assets/sounds واستبدل هذا الملف
 * بنسخة SKK — لا شيء آخر يتغيّر في التطبيق.
 */

/* الأسماء مطابقة لنظام SKK حرفياً — استبدال هذا الملف بنسخته يعمل بلا تعديل */
const SFX = {
  boot: "",
  firstStartup: "",
  focus: "",
  enter: "",
  cancel: "",
  openDialog: "",
  closeDialog: "",
  openDrawer: "",
  closeDrawer: "",
  openHome: "",
  error: "",
  success: "",
  logout: "",
  passcode: "",
  notify: "",
  homeLoad: "",
} as const;

export type SfxName = keyof typeof SFX;

/** مدد المؤثّرات — يستعملها المنسّق لمزامنة الحركة مع الصوت */
export const SFX_DURATION_MS: Partial<Record<SfxName, number>> = {};

const AMBIENT = {
  select: "",
  home: "",
} as const;

export type AmbientTrack = keyof typeof AMBIENT;

/* eslint-disable @typescript-eslint/no-unused-vars */

export function sfx(_name: SfxName, _volume = 0.5, _queueIfBlocked = false) {}

export function warmupSfx(..._names: SfxName[]) {}

export function preloadAmbient(_track: AmbientTrack) {}

export function playAmbient(_track: AmbientTrack, _fadeMs = 900) {}

export function duckAmbient(_holdMs = 1400, _depth = 0.4) {}

export function stopAmbient(_fadeMs = 500) {}
