import { DESTINATIONS, type Destination } from "./destinations";

/**
 * **مطابقةُ العربية — والسببُ أنّ `includes` وحدها لا تكفي.**
 *
 * ثلاثةُ أشياءَ تجعل المستخدم يكتب كلمةً صحيحةً فلا يجد شيئاً:
 *
 * ① **الهمزات.** «الاساتذة» و«الأساتذة» و«الإسناد» و«الاسناد» — والقارئُ
 *   العربيّ يكتب أيَّها اتّفق، ولوحاتُ المفاتيح تختلف في أيّها أسهل.
 *
 * ② **التاء المربوطة والألف المقصورة.** «مدرسة/مدرسه»، «علي/على».
 *
 * ③ **التشكيل.** أسماءُ الشاشات في هذا المشروع مشكولةٌ في مواضع
 *   («حقوقُ الشهر»، «مستحقُّ الأستاذ»)، والمستخدم لا يكتب الضمّة. فبلا
 *   تجريدٍ لا يطابق ما كُتب ما هو معروض — وهو عطلٌ لا يُخمَّن سببُه.
 *
 * فيُطبَّع الطرفان قبل المقارنة. والتطبيعُ لا يُعرض: ما يراه المستخدم
 * يبقى كما كُتب بتشكيله.
 */

/* التشكيل والتطويل — يسقطان تماماً. */
const MARKS = /[ً-ْٰـ]/g;

const FOLD: Record<string, string> = {
  "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
  "ى": "ي", "ئ": "ي",
  "ؤ": "و",
  "ة": "ه",
};

/** يُطبَّع للمقارنة وحدها — لا يُخزَّن ولا يُعرض. */
export const fold = (text: string): string =>
  text
    .toLowerCase()
    .replace(MARKS, "")
    .replace(/[أإآٱىئؤة]/g, (ch) => FOLD[ch] ?? ch)
    .replace(/\s+/g, " ")
    .trim();

export interface Scored<T> {
  item: T;
  score: number;
}

/**
 * درجةُ تطابقٍ بين استعلامٍ وحقل.
 *
 * والترتيبُ يخدم غرضاً واحداً: **أن يكون أوّلُ صفٍّ هو المقصود**. فبدايةُ
 * الاسم تسبق وسطَه، والاسمُ يسبق الوصف، والكلماتُ الخفيّة آخراً — من
 * كتب «طلبة» يريد قسم الطلبة لا تقريراً يذكرهم في وصفه.
 *
 * وصفرٌ يعني «لا يطابق»، فلا يُعرض.
 */
const scoreField = (folded: string, needle: string, weight: number): number => {
  if (!folded) return 0;

  const at = folded.indexOf(needle);

  if (at < 0) return 0;
  /* بدايةُ الحقل أقوى من بدايةِ كلمةٍ فيه، وهي أقوى من وسطها. */
  if (at === 0) return weight * 3;
  if (folded[at - 1] === " ") return weight * 2;

  return weight;
};

/** يُحسب مرّةً لكلّ وجهة، لا مرّةً لكلّ ضغطة مفتاح. */
const INDEX = DESTINATIONS.map((d) => ({
  d,
  title: fold(d.title),
  detail: fold(d.detail ?? ""),
  keywords: (d.keywords ?? []).map(fold),
}));

/**
 * البحثُ في وجهات التطبيق.
 *
 * **وكلُّ كلمةٍ في الاستعلام يجب أن تُصيب** (‏AND لا OR): من كتب «كشف
 * الأستاذ» يريد ما فيه الاثنان، ولو كفت واحدةٌ لغرقت النتيجةُ في كلّ ما
 * يذكر «كشف». والكلماتُ قد تُصيب حقولاً مختلفة — «تقرير» في العنوان
 * و«حضور» في الوصف — وذلك مقبول.
 */
export function searchDestinations(query: string, limit = 8): Destination[] {
  const q = fold(query);
  if (!q) return [];

  const words = q.split(" ").filter(Boolean);
  const out: Scored<Destination>[] = [];

  for (const entry of INDEX) {
    let total = 0;

    for (const w of words) {
      const best = Math.max(
        scoreField(entry.title, w, 10),
        scoreField(entry.detail, w, 3),
        ...entry.keywords.map((k) => scoreField(k, w, 6)),
      );

      /* كلمةٌ لم تُصب شيئاً ⇒ الوجهةُ كلُّها خارج النتيجة. */
      if (best === 0) {
        total = 0;
        break;
      }

      total += best;
    }

    if (total > 0) out.push({ item: entry.d, score: total });
  }

  /*
   * الفرزُ بالدرجة، ثمّ بطول العنوان عند التعادل.
   *
   * الأقصرُ أعمّ: «الطلبة» و«قائمة الطلبة» يتساويان في الدرجة، والأوّلُ
   * هو القسم — وهو ما يريده من كتب كلمةً واحدة. ولولا هذا الفاصل لتبدّل
   * الترتيبُ بين تشغيلٍ وآخر بحسب ترتيب البناء.
   */
  out.sort((a, b) => b.score - a.score || a.item.title.length - b.item.title.length);

  return out.slice(0, limit).map((s) => s.item);
}
