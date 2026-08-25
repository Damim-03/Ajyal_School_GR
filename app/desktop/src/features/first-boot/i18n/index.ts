/**
 * لغاتُ التهيئة — ثلاثٌ، بلا مكتبة.
 *
 * ولا i18n في المشروع أصلاً: التطبيقُ عربيٌّ بالكامل ونصوصُه مكتوبةٌ
 * في مكانها. وإدخالُ `i18next` لأجل هذه الشاشات كان سيعني تبعيةً
 * وملفّاتِ موارد ومزوِّداً حول الشجرة كلِّها — لأربعةَ عشرَ شاشةً
 * تُعرض مرّةً في عمر التركيب.
 *
 * فالبديلُ قاموسٌ مكتوبٌ بالأنواع: `Dict` يُشتقّ من العربية، والأخريان
 * تُصرَّحان به فيرفض المصرِّفُ أيَّ نقص. و**النصُّ يُقرأ بالنقطة**
 * (`t.region.title`) لا بمسارٍ نصّيّ — فلا مفتاحَ خامٌّ يظهر في شاشة.
 *
 * ولا يُغني هذا عن i18n للتطبيق كلِّه حين يُترجَم؛ لكنّه يجعل التهيئةَ
 * ثلاثيةَ اللسان اليومَ بلا أن تُفرض بنيةٌ على ما لم يُترجم بعد.
 */

import { ar, type Dict } from "./ar";
import { en } from "./en";
import { fr } from "./fr";
import type { Language } from "../types/firstBoot.types";

export type { Dict };

export const DICTS: Record<Language, Dict> = { ar, en, fr };

export const LANGUAGES: { code: Language; label: string; english: string }[] = [
  { code: "ar", label: "العربية", english: "Arabic" },
  { code: "en", label: "English", english: "English" },
  { code: "fr", label: "Français", english: "French" },
];

export const dictOf = (language: Language): Dict => DICTS[language] ?? ar;

export const isLanguage = (value: string): value is Language =>
  value === "ar" || value === "en" || value === "fr";

/**
 * لغةُ البدء — قبل أن يختار المستخدمُ شيئاً.
 *
 * وترتيبُ المصادر: ما حُفظ محلياً (فالخادمُ قد لا يُبلَغ بعد)، ثمّ لغةُ
 * النظام، ثمّ العربية. والوسطُ مهمّ: جهازٌ فرنسيُّ اللسان يجد الشاشةَ
 * الأولى بالفرنسية، فيكون أوّلُ ما يقرؤه مفهوماً — وهو نصفُ ما تعنيه
 * شاشةُ اختيار اللغة أصلاً.
 */
const STORAGE_KEY = "nexschool_language";

export const initialLanguage = (): Language => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isLanguage(saved)) return saved;
  } catch {
    /* تخزينٌ ممنوع — يُكمَل إلى لغة النظام */
  }

  const system = (navigator.language || "ar").slice(0, 2).toLowerCase();

  return isLanguage(system) ? system : "ar";
};

export const rememberLanguage = (language: Language) => {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* تبقى للجلسة */
  }
};
