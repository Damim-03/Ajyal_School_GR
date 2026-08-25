/**
 * زرُّ النظام — أسفل الزاوية.
 *
 * سطحٌ دائريٌّ شفّافٌ وحدٌّ رفيع، بلا ظلٍّ ثقيلٍ ولا امتلاءٍ لونيّ.
 * وهو مقصودٌ أن يُرى ولا يُنادى: من يبحث عنه يجده، ومن لا يبحث لا
 * يشدّه عن الوجوه في الوسط.
 *
 * ## ولمَ الشعارُ لا أيقونةٌ رمزية
 *
 * كان `Power` فصار `RotateCcw` فصار الشعار. وكلُّ أيقونةٍ رمزيةٍ هنا
 * تكذب نصفَ كذبة: رمزُ الطاقة يَعِد بإطفاء **الجهاز** وهذا البرنامجُ
 * لا يُطفئ جهازاً، وسهمُ الإعادة يسمّي فعلاً واحداً من اثنين فيُخفي
 * الآخر. والشعارُ لا يسمّي فعلاً أصلاً — يسمّي **صاحبَ الأفعال**:
 * «هنا يُتحكَّم في NexSchool نفسِه». وما تحته قائمةٌ تقول البقيّة.
 *
 * ## العلامةُ وحدها لا القفلُ كلُّه
 *
 * ملفُّ الشعار قفلٌ كامل: العلامةُ فوق، وكلمةُ «NexSchool» تحتها. مسحتُ
 * قناةَ الشفافية سطراً سطراً فإذا هما شريطان منفصلان — العلامةُ من
 * السطر 220 إلى 803، والكلمةُ من 872 إلى 966، وبينهما 68 سطراً خالية.
 *
 * والكلمةُ تسقط هنا. لأنّ الدائرةَ 56px، فالقفلُ كلُّه فيها يجعل ارتفاعَ
 * الكلمة ثمانيةَ بكسلات: لطخةٌ لا تُقرأ، تسرق نصفَ المساحة من العلامة
 * التي تُقرأ. وهذا ما تفعله كلُّ أنظمة التشغيل بأيقوناتها الصغيرة.
 *
 * ## والقياسُ من الملفّ لا من التقدير
 *
 * كلُّ الأرقام هنا مقروءةٌ من قناة الشفافية: صندوقُ العلامة
 * (318, 220) → (966, 804) في صورةٍ ضلعُها 1254. فتُقصّ الصورةُ عند هذا
 * الصندوق بالضبط وتُوسَّط نافذتُه في الدائرة — بلا إزاحاتٍ بصريةٍ
 * تُقدَّر، وبلا اعتمادٍ على ما يفعله المحرّكُ بابنٍ يفيض عن أبيه
 * (‏`place-items: center` لا توسّط الفائض: قِستُه على الشاشة الحيّة
 * فوجدتُ العلامةَ تبعد عن المركز 9.7px، لاصقةً الحافّةَ ومقصوصة).
 */

import { motion } from "motion/react";

import nexschoolLogo from "../../assets/nexschool/nexschool.png";
import { MOTION } from "../../motion/system";

/** قطرُ الزرّ — أكبرُ قليلاً من ذي الأيقونة: العلامةُ تحتاج مكاناً. */
const SIZE = 56;

/**
 * صندوقُ العلامة داخل الصورة — بالبكسل في ملفٍّ ضلعُه 1254.
 * مقيسٌ من قناة الشفافية، لا مقدَّرٌ بالعين.
 */
const SRC = 1254;
const GLYPH = { x: 318, y: 220, w: 648, h: 584 } as const;

/** كم من الدائرة تملأ العلامة — دونَ الحافّة بهامشٍ تتنفّس فيه. */
const FILL = 0.64;

/** ضلعُ الصورة الذي يجعل أطولَ بُعدٍ في العلامة يبلغ الحصّةَ المطلوبة. */
const BOX = (SIZE * FILL * SRC) / Math.max(GLYPH.w, GLYPH.h);

/** نافذةُ القصّ — بمقاس العلامة وحدَها. */
const WIN_W = (GLYPH.w / SRC) * BOX;
const WIN_H = (GLYPH.h / SRC) * BOX;

export function PowerButton({
  focused,
  title,
  onActivate,
}: {
  focused: boolean;
  title: string;
  onActivate: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onActivate}
      title={title}
      aria-label={title}
      animate={{
        scale: focused ? 1.08 : 1,
        borderColor: focused ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.13)",
        backgroundColor: focused ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.025)",
      }}
      transition={MOTION.spring.icon}
      className="relative cursor-pointer overflow-hidden rounded-full border outline-none"
      style={{
        width: SIZE,
        height: SIZE,
        boxShadow: "inset 0 1px 16px rgba(255,255,255,0.05)",
      }}
    >
      {/*
        نافذةٌ بمقاس العلامة، الصورةُ تنزلق تحتها.

        وهي التي تُسقط الكلمة — لا مجرّدُ تصغيرٍ يأمل أن تخرج من
        الدائرة. جرّبتُ ذلك أوّلاً فقِستُه: بقيت الكلمةُ داخل الدائرة
        عند y=47..52، لطخةً في أسفلها. والقصُّ الصريحُ لا يترك الأمرَ
        لحسابٍ قد ينحرف إن تبدّل القطرُ يوماً.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 block overflow-hidden"
        style={{
          width: WIN_W,
          height: WIN_H,
          transform: "translate(-50%, -50%)",
          /*
           * خافتٌ ما لم يُطلب.
           *
           * الشعارُ ملوَّنٌ والشاشةُ حولَه رماديةٌ هادئة، فلونٌ كاملٌ في
           * الزاوية يسحب العينَ عن الوجوه — وهي ما جاء المستخدمُ لأجله.
           * وخفضُ التشبّع يُبقيه معروفاً ولا يجعله نداءً؛ ويعود كاملاً
           * حين يقع عليه التركيز، فيكون رجوعُ اللون هو الإشارة.
           */
          opacity: focused ? 1 : 0.62,
          filter: focused ? "none" : "saturate(0.65)",
          transition: "opacity 220ms ease-out, filter 220ms ease-out",
        }}
      >
        <img
          src={nexschoolLogo}
          alt=""
          draggable={false}
          className="max-w-none select-none"
          style={{
            width: BOX,
            height: BOX,
            marginInlineStart: -(GLYPH.x / SRC) * BOX,
            marginBlockStart: -(GLYPH.y / SRC) * BOX,
            display: "block",
          }}
        />
      </span>
    </motion.button>
  );
}
