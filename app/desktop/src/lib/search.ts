/**
 * مطابقةُ نصٍّ عربيٍّ كما يكتبه المستخدم لا كما خُزّن.
 *
 * البحث الحرفي يفشل في العربية لأسبابٍ لا يد للكاتب فيها: الاسم مخزَّن
 * «إسماعيل» ويُكتب «اسماعيل»، و«فاطمة» تُكتب «فاطمه»، و«يحيى» تُكتب
 * «يحيي». فتُوحَّد الهمزات والألف المقصورة والتاء المربوطة، وتُسقط
 * الحركاتُ والتطويل، قبل المقارنة.
 *
 * والاستعلام يُقسَّم كلماتٍ يجب أن تَرِد كلُّها — بأيّ ترتيب. فالجدول
 * يعرض «اللقب ثمّ الاسم» بينما يبحث المستخدم بالاسم أوّلاً عادةً.
 */

const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

export function normalizeArabic(text: string): string {
  return text
    .replace(DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** هل يحوي النصُّ كلَّ كلمات الاستعلام؟ استعلامٌ فارغ يطابق كلَّ شيء. */
export function matchesQuery(haystack: string, query: string): boolean {
  const needle = normalizeArabic(query);
  if (!needle) return true;

  const hay = normalizeArabic(haystack);
  return needle.split(" ").every((word) => hay.includes(word));
}
