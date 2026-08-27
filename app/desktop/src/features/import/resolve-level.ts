import { normalizeArabic } from "../../lib/search";

/**
 * **من «متوسط» و«الأولى» إلى `levelId`.**
 *
 * الملفُّ يكتبه إنسانٌ بأسماء، والخادمُ ينتظر معرّفاً. وبينهما هذه
 * الوحدة — وهي **تطابق ولا تُنشئ**: مستوًى غيرُ موجودٍ يردّ سطرَه.
 * وإنشاؤه تلقائياً يُفسد البنية الدراسية بمستوياتٍ وُلدت من أخطاءٍ
 * مطبعية، ولا يعرف أحدٌ بعدها أيُّها مقصودٌ وأيُّها زلّةُ إصبع.
 *
 * والطورُ يلزم مع المستوى حين يلتبس: `Level` فريدٌ بـ(الطور + الاسم)،
 * فـ«الأولى» في المتوسط وفي الثانوي مستويان. واشتراطُه دائماً تشدّدٌ
 * بلا داع — فيُشترط عند الالتباس وحده.
 */

export interface LevelRef {
  readonly id: string;
  readonly name: string;
  readonly isActive?: boolean;
  readonly educationStage?: { readonly id: string; readonly name: string };
}

export type LevelResolution =
  | { readonly ok: true; readonly levelId: string | null }
  | { readonly ok: false; readonly error: string };

const eq = (a: string, b: string) => normalizeArabic(a) === normalizeArabic(b);

export const resolveLevel = (
  stageName: unknown,
  levelName: unknown,
  levels: readonly LevelRef[],
): LevelResolution => {
  const stage = typeof stageName === "string" ? stageName.trim() : "";
  const level = typeof levelName === "string" ? levelName.trim() : "";

  /* لا مستوى: الطورُ وحده لا يُحفظ على الطالب فيُتجاهَل بلا شكوى */
  if (!level) return { ok: true, levelId: null };

  let candidates = levels.filter((l) => eq(l.name, level));

  if (stage) {
    const inStage = candidates.filter(
      (l) => l.educationStage && eq(l.educationStage.name, stage),
    );

    if (inStage.length === 0) {
      const known = levels.some((l) => l.educationStage && eq(l.educationStage.name, stage));

      return {
        ok: false,
        error: known
          ? `لا مستوى باسم «${level}» في طور «${stage}»`
          : `لا طور باسم «${stage}» في البنية الدراسية`,
      };
    }

    candidates = inStage;
  }

  if (candidates.length === 0) {
    return { ok: false, error: `لا مستوى باسم «${level}» في البنية الدراسية` };
  }

  /*
   * التباسٌ لا يُحلّ بالترجيح: اختيارُ الأوّل يضع الطالبَ في طورٍ
   * لم يقصده أحد، ولا يظهر ذلك إلّا في بطاقته المطبوعة.
   */
  if (candidates.length > 1) {
    const stages = candidates
      .map((l) => l.educationStage?.name)
      .filter(Boolean)
      .join(" و");

    return {
      ok: false,
      error: `«${level}» موجودٌ في ${stages} — اكتب الطور في عموده`,
    };
  }

  const match = candidates[0];

  /* الخادمُ يرفض المعطَّل، فيُردّ هنا برسالةٍ تقول السبب */
  if (match.isActive === false) {
    return { ok: false, error: `المستوى «${match.name}» معطَّل في البنية الدراسية` };
  }

  return { ok: true, levelId: match.id };
};
