import { assetUrl } from "../../lib/asset-url";
import { avatarGradient, avatarSilhouette, type AvatarGender } from "../../lib/identity";

/**
 * صورة الشخص — مع بديلٍ لا يُخجل.
 *
 * أغلب الطلبة لن يكون لهم صورة، فالبديل ليس حالةً استثنائية بل الحالة
 * الغالبة. كان البديل حرفاً أوّل، فكان صفُّ «كير» كلُّه دوائرَ «ك»
 * متطابقة. صار **ظلَّ شخصٍ بحسب جنسه** كما يفعل فيسبوك بحسابٍ جديد:
 * يُقرأ قبل السطر لا بعده.
 *
 * والتدرّج تحته يبقى مشتقّاً من الاسم — فيثبت للشخص نفسه عبر الشاشات
 * ويختلف بين شخصين، والظلّ يقول الجنس. اللونُ هويةٌ والشكلُ جنس، ولا
 * يحمل أحدهما عبء الآخر.
 */
export function Avatar({
  src,
  name,
  gender,
  size = 40,
  ring,
}: {
  src?: string | null;
  name: string;
  /** غيابه يعني «غير معروف» فيُرسم الشكل المحايد — لا علامةَ نقص */
  gender?: AvatarGender | null;
  size?: number;
  ring?: string;
}) {
  const url = assetUrl(src);

  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: url ? "transparent" : avatarGradient(name),
        border: ring ? `2px solid ${ring}` : "1px solid rgba(255,255,255,0.14)",
      }}
      title={name}
    >
      {url ? (
        <img
          src={url}
          alt={name}
          className="h-full w-full object-cover"
          /*
           * الصورة المكسورة تُخفي نفسها فيظهر التدرّج تحتها — أفضل من
           * أيقونة «صورة مفقودة» في منتصف جدول.
           */
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <GenderGlyph gender={gender} size={size} />
      )}
    </span>
  );
}

/**
 * الظلّ نفسه بلا إطارٍ ولا خلفية — لمن يريد تركيبه في شكلٍ آخر.
 *
 * يملأ الدائرة كاملةً (`h-full w-full`) لأنّ الكتفين في المخطَّط
 * يبلغان حافّته السفلى: أيُّ حشوةٍ حولهما تُعلّق الصدر في الهواء.
 */
export function GenderGlyph({
  gender,
  size = 40,
  fill,
}: {
  gender?: AvatarGender | null;
  size?: number;
  /**
   * لونُ الظلّ — بياضٌ خافت افتراضاً لأنّ موضعه المعتاد تدرّجٌ داكن.
   *
   * وتحتاج البطاقةُ غيرَه: خلفيتها بيضاء تُطبع، والأبيض عليها فراغ.
   */
  fill?: string;
}) {
  const { head, hair, shoulders } = avatarSilhouette(gender);

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      /*
       * بياضٌ خافت لا ناصع: الظلُّ خلفيةٌ للاسم لا منافسٌ له، والناصعُ
       * فوق تدرّجٍ داكن يسحب العين من السطر الذي يجب أن تقرأه.
       */
      fill={fill ?? "rgba(255,255,255,0.82)"}
      className="h-full w-full"
    >
      {hair && <path d={hair} />}
      <circle cx={head.cx} cy={head.cy} r={head.r} />
      <path d={shoulders} />
    </svg>
  );
}
