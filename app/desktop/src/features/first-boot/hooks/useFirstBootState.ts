/**
 * قرّاءُ الحالة — اشتراكاتٌ ضيّقةٌ لا كائنٌ كامل.
 *
 * وسببُ التضييق أداءٌ لا أناقة: شاشةُ «الأجهزة» تُعيد بناءَ قائمتها
 * كلَّما تبدّل أيُّ حقلٍ في المتجر لو اشتركت في الكائن كلِّه — والفحصُ
 * يجري كلَّ ثانيةٍ فيها. فكلُّ خطّافٍ هنا يقرأ ما يحتاجه وحده.
 */

import { useFirstBootStore } from "../store/firstBoot.store";
import { dictOf } from "../i18n";
import type { Dict } from "../i18n";
import type { FirstBootAnswers, Language } from "../types/firstBoot.types";

/** القاموسُ الحيّ — يتبدّل مع اللغة فتُعاد ترجمةُ الشاشة فوراً (§9) */
export const useT = (): Dict =>
  useFirstBootStore((store) => dictOf(store.language));

export const useLanguage = (): Language =>
  useFirstBootStore((store) => store.language);

export const useIsRtl = (): boolean =>
  useFirstBootStore((store) => dictOf(store.language).meta.dir === "rtl");

export const usePhase = () => useFirstBootStore((store) => store.phase);

export const useSubmitting = () =>
  useFirstBootStore((store) => store.submitting);

export const useBootError = () => useFirstBootStore((store) => store.bootError);

export const useStepError = () => useFirstBootStore((store) => store.error);

export const useFieldErrors = () =>
  useFirstBootStore((store) => store.fieldErrors);

export const useVerification = () =>
  useFirstBootStore((store) => store.verification);

export const useResumed = () => useFirstBootStore((store) => store.resumed);

/**
 * ما حُفظ سابقاً.
 *
 * وهي التي تجعل الرجوعَ نافعاً: من رجع إلى «المنطقة» يجد اختيارَه
 * معروضاً لا حقولاً فارغة. والافتراضُ الفارغُ حين لا حالةَ بعد —
 * أوّلُ رسمٍ يسبق وصولَ الردّ.
 */
const EMPTY_ANSWERS: FirstBootAnswers = {
  language: "",
  country: "",
  timezone: "",
  dateFormat: "",
  networkMode: "",
  uiScale: "",
  density: "",
  windowMode: "",
  performance: "",
  termsVersion: "",
  termsAcceptedAt: "",
  updateChannel: "",
  appVersion: "",
  diagnostics: false,
  recoveryPhone: "",
  institution: {
    name: "",
    nameEn: "",
    shortName: "",
    phone: "",
    email: "",
    address: "",
    logoPath: "",
  },
  academicYear: null,
};

export const useAnswers = (): FirstBootAnswers =>
  useFirstBootStore((store) => store.state?.answers ?? EMPTY_ANSWERS);

export const useTermsVersion = (): string =>
  useFirstBootStore((store) => store.state?.termsVersion ?? "1.0");
