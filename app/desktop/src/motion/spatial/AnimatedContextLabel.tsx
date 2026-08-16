import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { durations, delays, reduced, springs } from "./tokens";

/**
 * العنوان تحت البلاطة المركَّزة.
 *
 * **مرساته البلاطة لا الصفحة.** كان يقف عند حافّة الصفحة الثابتة بينما
 * تنزلق البلاطة المركَّزة تحت الشريط — فيُقرأ كعنوانِ صفحةٍ يصف ما يجري،
 * لا كاسمٍ يخصّ ذلك الجسم بعينه. الآن يتّبع موضع استقرارها (يبلّغه الصفّ
 * نفسه، فلا هندسة مكرَّرة في مكانين)، فيبدو منبثقاً منها.
 *
 * **النصّ يتحرّك بموضعه فقط: شفافية وإزاحة.** لا تمويه ولا تباعد حروف.
 *
 * كان هنا `blur(2px)` و`letterSpacing` يُستوفيان مع كل تبدّل، وسقطا لسببين:
 *
 * ① **قابلية القراءة.** المرجع يُبقي النصّ حادّاً دائماً؛ الحرف الذي يصل
 *    مموّهاً أو مفكّك التباعد يُقرأ عيباً في العرض لا حركةً مقصودة. وشاشة
 *    نقاط البيع تُقرأ من مسافة، فأيّ تليينٍ للحروف خسارةٌ صافية.
 *
 * ② **التعليق السابق كان مخطئاً في الحقيقة التقنية.** زعم أنّ العوامل
 *    الثلاثة «على مستوى الرسم لا التخطيط» — و`letter-spacing` **خاصّية
 *    تخطيط**: تُعيد قياس النصّ وتدفّقه في كل إطار. أي أنّه تجنّب
 *    `font-size` ثمّ وقع في المحظور نفسه من باب آخر. و`filter: blur` على
 *    نصّ يفرض طبقة رسم مستقلّة ويُفسد تنعيم الحواف الفرعية.
 *
 * الباقي — الشفافية والإزاحة — يعمل على المُركِّب وحده، وهو ما يوصي به
 * المرجع للنصّ حرفياً: «تلاشٍ خفيف مع إزاحة 5–10px، لا غير».
 *
 * `mode="popLayout"` يُبقي الخارج والداخل متراكبين لحظةً بلا قفزة ارتفاع؛
 * وارتفاع الحاوية محجوز مسبقاً كي لا يزيح اختلافُ طول النصوص ما تحته.
 */
export function AnimatedContextLabel({
  id, title, subtitle, direction, anchor = 0, className,
}: {
  /** يتغيّر عند تبدّل العنصر المركَّز. */
  id: string | number;
  title: string;
  subtitle?: string;
  /** اتجاه التنقّل: +1 للأمام، -1 للخلف — إزاحة أفقية طفيفة فقط. */
  direction: number;
  /** إزاحة بداية النصّ لتحاذي البلاطة المركَّزة (بالبكسل). */
  anchor?: number;
  className?: string;
}) {
  const still = useReducedMotion();
  const dx = still ? 0 : direction * 6;

  return (
    <div className={`relative ${className ?? ""}`}>
      {/*
        الملاحقة بنابض الصفّ نفسه: العنوان والشريط يصلان معاً كجسم واحد.
        نابضٌ أسرع كان سيجعله يسبق البلاطة، وأبطأ يجعله يُجَرّ خلفها.
      */}
      <motion.div
        initial={false}
        animate={{ marginInlineStart: anchor }}
        transition={still ? reduced.transition : springs.navigation}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={id}
            initial={still ? { opacity: 0 } : { opacity: 0, y: 6, x: dx }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            /* القديم ينسحب هابطاً بينما الجديد يصعد — لا استبدال، وبلا تمويه */
            exit={
              still
                ? { opacity: 0 }
                : { opacity: 0, y: 5, x: -dx, transition: { duration: durations.labelOut } }
            }
            transition={
              still
                ? reduced.transition
                : { duration: durations.labelIn, delay: delays.labelIn, ease: [0.22, 1, 0.36, 1] }
            }
          >
            {/* `will-change` غائب عمداً: النصّ يُرقّى للمعالج الرسومي أثناء
                الحركة فقط، وترقيته الدائمة تُفسد تنعيم الحواف الفرعية. */}
            {/*
              وزن الخطّ هو ما يصنع الشبه بالمرجع، لا حجمه.

              كان `font-black` — أي وزن 900، أثقل ما في العائلة. واسم اللعبة
              في واجهة الكونسول يُكتب بوزنٍ **عاديّ** (‏400–500): سطرُ تسمية
              هادئ يخدم البلاطة فوقه ولا ينافسها. الوزن الأسود كان يجعله
              يقرأ عنواناً مستقلّاً.

              والحجم نزل درجةً (18px ← 15px) فصار أقرب إلى نسبة المرجع.

              (خطّ الكونسول نفسه — SST — مملوك ولا يُشحن. والشبه يأتي من
               الوزن والحجم لا من العائلة؛ `Segoe UI` العربي أقربها شكلاً.)
            */}
            <div className="truncate text-[15px] font-medium leading-tight">{title}</div>
            {subtitle && (
              <motion.div
                className="truncate text-[12px] text-white/55"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  still
                    ? reduced.transition
                    : { duration: durations.secondary, delay: delays.labelIn + delays.secondary }
                }
              >
                {subtitle}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
