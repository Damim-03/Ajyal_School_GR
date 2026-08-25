/**
 * تطبيقُ ما اختاره المستخدمُ على التطبيق الحيّ.
 *
 * وهي الطبقةُ التي تُحوّل «حالةً في القاعدة» إلى **أثرٍ يُرى**: اللغةُ
 * تقلب اتجاهَ الصفحة، والمقياسُ يكبّر النصَّ، والنافذةُ تُكبَّر فعلاً.
 * وبلا هذا الملفّ تكون التهيئةُ استمارةً تُملأ وتُحفظ ولا يقع منها
 * شيء (§67).
 *
 * وتُنادى في ثلاثة مواضع:
 *   • عند إقلاع التطبيق — قبل أوّل رسم (`main.tsx`).
 *   • عند كلّ اختيارٍ داخل التهيئة — فيُرى الأثرُ وهو يُختار (§12).
 *   • بعد قراءة الحالة من الخادم — فجهازٌ ثانٍ يلتقط ما ضُبط في الأوّل.
 */

import {
  applyPreferences,
  applyWindowMode,
  savePreferences,
  type Density,
  type PerformanceProfile,
  type UiScale,
  type WindowMode,
} from "../../../core/system/preferences";
import { dictOf, isLanguage, rememberLanguage } from "../i18n";
import type { FirstBootState, Language } from "../types/firstBoot.types";

/**
 * اتجاهُ الصفحة ولغتُها — على `<html>` لا على غلافٍ داخليّ.
 *
 * و`dir` على الجذر هو ما يجعل الاتجاهَ المنطقيَّ يعمل فعلاً: الحشوُ
 * البادئ (`ps-*`) والهوامشُ المنطقيةُ في Tailwind تقرأ اتجاهَ المستند،
 * فتنقلب كلُّها بسطرٍ واحد. ولو وُضع على `<div>` داخليٍّ لبقيت
 * الطبقاتُ المثبَّتة (`fixed`) خارجَه على الاتجاه القديم (§46).
 */
export const applyLanguage = (language: Language) => {
  const dict = dictOf(language);

  document.documentElement.lang = language;
  document.documentElement.dir = dict.meta.dir;

  rememberLanguage(language);
};

/** اتجاهُ التقدّم منطقيٌّ لا يمين/يسار — تقرؤه الانتقالات (§47) */
export const directionFactor = (language: Language): 1 | -1 =>
  dictOf(language).meta.dir === "rtl" ? -1 : 1;

export interface DisplayChoice {
  uiScale: UiScale;
  density: Density;
  windowMode: WindowMode;
}

export const applyDisplay = async (choice: DisplayChoice) => {
  savePreferences({
    uiScale: choice.uiScale,
    density: choice.density,
    windowMode: choice.windowMode,
  });

  await applyWindowMode(choice.windowMode);
};

export const applyPerformance = (profile: PerformanceProfile) => {
  savePreferences({ performance: profile });
};

const asScale = (value: string): UiScale =>
  value === "SMALL" || value === "LARGE" ? value : "DEFAULT";

const asDensity = (value: string): Density =>
  value === "COMPACT" ? "COMPACT" : "COMFORTABLE";

const asWindowMode = (value: string): WindowMode =>
  value === "WINDOWED" || value === "FULLSCREEN" ? value : "MAXIMIZED";

const asProfile = (value: string): PerformanceProfile =>
  value === "PERFORMANCE" || value === "POWER_SAVING" ? value : "BALANCED";

/**
 * مصالحةُ الجهاز مع ما في القاعدة.
 *
 * وهي التي تجعل التهيئةَ **حالةَ مؤسسةٍ لا حالةَ جهاز**: مدرسةٌ ضبطت
 * المقياسَ «كبيراً» على حاسوب الأمانة تجده كبيراً حين تُركّب النافذةَ
 * على حاسوبٍ ثانٍ متّصلٍ بالخادم نفسِه. وما يبقى محلّياً هو عنوانُ
 * الخادم وحدَه — لأنّه صفةُ الجهاز لا صفةُ المؤسسة.
 *
 * ولا تُطبَّق ما لم يُضبط: خطوةُ العرض قد لا تكون مرّت بعد، والقيمُ
 * الفارغة تعني «الافتراضيّ» لا «صفّر ما هو قائم».
 */
export const reconcileFromState = async (state: FirstBootState) => {
  const { answers } = state;

  if (answers.language && isLanguage(answers.language)) {
    applyLanguage(answers.language);
  }

  if (answers.uiScale || answers.density || answers.performance) {
    savePreferences({
      ...(answers.uiScale ? { uiScale: asScale(answers.uiScale) } : {}),
      ...(answers.density ? { density: asDensity(answers.density) } : {}),
      ...(answers.performance
        ? { performance: asProfile(answers.performance) }
        : {}),
    });
  } else {
    applyPreferences();
  }

  if (answers.windowMode) {
    await applyWindowMode(asWindowMode(answers.windowMode));
  }
};

/**
 * سِجلُّ الأعطال المحلّي (§19).
 *
 * وهو الخيارُ الوحيدُ الحقيقيُّ في شاشة الخصوصية — ولذلك هو الوحيدُ
 * المعروض. لا تحليلاتٍ تُرسَل ولا تقاريرَ تُرفع، فلا مفاتيحَ لإطفائها.
 *
 * والسجلُّ **محلّيٌّ حرفياً**: عشرون قيداً في تخزين هذا المتصفّح، لا
 * يخرج منها شيءٌ إلى أيّ خادم. وفائدتُه واحدةٌ ملموسة: مستخدمٌ يقول
 * «تعطّلت الشاشةُ أمس» يجد من يقرأ له ما وقع بدل أن يُطلب منه وصفُه.
 */
const DIAGNOSTICS_KEY = "nexschool_diagnostics";
const DIAGNOSTICS_ENABLED = "nexschool_diagnostics_on";
const MAX_ENTRIES = 20;

export interface DiagnosticEntry {
  at: string;
  message: string;
  stack: string;
}

export const diagnosticsEnabled = (): boolean => {
  try {
    return localStorage.getItem(DIAGNOSTICS_ENABLED) === "1";
  } catch {
    return false;
  }
};

export const setDiagnostics = (enabled: boolean) => {
  try {
    if (enabled) localStorage.setItem(DIAGNOSTICS_ENABLED, "1");
    else {
      localStorage.removeItem(DIAGNOSTICS_ENABLED);
      /* الإطفاءُ يمحو ما جُمع — وإلّا بقي بعد أن سُحب الإذن */
      localStorage.removeItem(DIAGNOSTICS_KEY);
    }
  } catch {
    /* لا شيء يُفعل */
  }
};

export const readDiagnostics = (): DiagnosticEntry[] => {
  try {
    const raw = localStorage.getItem(DIAGNOSTICS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? (parsed as DiagnosticEntry[]) : [];
  } catch {
    return [];
  }
};

const record = (message: string, stack: string) => {
  if (!diagnosticsEnabled()) return;

  try {
    const entries = readDiagnostics();

    entries.unshift({
      at: new Date().toISOString(),
      message: message.slice(0, 500),
      stack: stack.slice(0, 2000),
    });

    localStorage.setItem(
      DIAGNOSTICS_KEY,
      JSON.stringify(entries.slice(0, MAX_ENTRIES)),
    );
  } catch {
    /* امتلأ التخزين — يُسقط القيد ولا يُسقط التطبيق */
  }
};

let listening = false;

/** يُركَّب مرّةً عند الإقلاع. ويقرأ الإذنَ عند كلّ عطبٍ لا عند التركيب */
export const installDiagnostics = () => {
  if (listening || typeof window === "undefined") return;

  listening = true;

  window.addEventListener("error", (event) => {
    record(event.message, event.error?.stack ?? "");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { message?: string; stack?: string };

    record(reason?.message ?? String(event.reason), reason?.stack ?? "");
  });
};
