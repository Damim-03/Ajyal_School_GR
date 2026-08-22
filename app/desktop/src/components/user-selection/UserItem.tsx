/**
 * بطاقةُ حسابٍ في الكاروسيل.
 *
 * التركيزُ لا يُعلَن بحدٍّ أبيض. خمسُ صفاتٍ تتحرّك معاً — المقياس،
 * والسطوع، والشفافية، والهالة، وحلقةٌ تنبثق عند الوصول — فيُقرأ
 * العنصرُ المختار **أقربَ إلى العين** لا مؤشَّراً عليه.
 *
 * والمقياسُ هو حاملُ الرسالة الأكبر: المختارُ يتجاوز حجمَه الطبيعيّ،
 * والباقي يتراجع دونه. ولو تساوى الجميعُ في الحجم لاحتاج التمييزُ إلى
 * لونٍ أو حدٍّ — وتلك لغةُ النماذج لا لغةُ الفضاء.
 */

import { motion } from "motion/react";

import { Avatar } from "../shared/Avatar";
import { MOTION } from "../../motion/system";
import type { Profile } from "./types";

/**
 * مقياسُ العنصر بحسب بُعده عن المركز.
 *
 * المختارُ فوق الواحد، وأوّلُ جارٍ يقفز إلى ما دون التسعين بالمئة —
 * والفجوةُ بينهما (‏1.14 ← 0.88) هي ما يجعل التركيز يُرى من طرف العين
 * بلا قراءة. ثمّ يتناقص التراجع، فلا يتلاشى البعيدُ في صفٍّ طويل.
 */
export const scaleFor = (distance: number, focused: boolean) =>
  focused ? 1.14 : Math.max(0.78, 0.9 - (distance - 1) * 0.055);

export const opacityFor = (distance: number, focused: boolean) =>
  focused ? 1 : Math.max(0.42, 0.74 - (distance - 1) * 0.12);

export function UserItem({
  profile,
  distance,
  focused,
  size,
  onActivate,
}: {
  profile: Profile;
  /** بُعدُه عن المركز بعدد الخانات — صفرٌ للمختار */
  distance: number;
  focused: boolean;
  size: number;
  onActivate: () => void;
}) {
  const name = `${profile.firstName} ${profile.lastName}`.trim();

  return (
    <motion.button
      type="button"
      onClick={onActivate}
      animate={{
        scale: scaleFor(distance, focused),
        opacity: opacityFor(distance, focused),
      }}
      transition={MOTION.spring.tile}
      className="flex shrink-0 cursor-pointer flex-col items-center gap-4 outline-none"
      style={{ width: size * 1.9 }}
    >
      <span className="relative grid place-items-center">
        {/*
          الهالة — ضوءٌ يمسّ حافّة الصورة لا إطارٌ نيونيّ حولها.
        */}
        <motion.span
          aria-hidden
          animate={{ opacity: focused ? 1 : 0, scale: focused ? 1 : 0.86 }}
          transition={MOTION.spring.focus}
          className="pointer-events-none absolute rounded-full"
          style={{
            width: size * 1.75,
            height: size * 1.75,
            background:
              "radial-gradient(circle, rgba(255,240,222,0.085) 0%, rgba(255,240,222,0.03) 42%, rgba(255,240,222,0) 70%)",
          }}
        />

        {/*
          حلقةٌ تنبثق عند وصول التركيز ثمّ تسكن.

          وهي التي تُشعر بأنّ شيئاً **وقع** لا أنّ حالةً تبدّلت: تبدأ
          أضيقَ من الصورة وتتّسع إلى ما بعد حافّتها بقليل، فتُقرأ موجةً
          خرجت من العنصر. والنابضُ `focus` أليَنُ من نابض البطاقة، فتصل
          الحلقةُ بعد الحجم بقدرٍ غير محسوس — وهو ما يمنع الحركتين من
          أن تُقرآ حركةً واحدةً صلبة.
        */}
        <motion.span
          aria-hidden
          initial={false}
          animate={{
            opacity: focused ? 1 : 0,
            scale: focused ? 1 : 0.82,
          }}
          transition={MOTION.spring.focus}
          className="pointer-events-none absolute rounded-full border"
          style={{
            width: size * 1.24,
            height: size * 1.24,
            borderColor: "rgba(255,255,255,0.16)",
          }}
        />

        <motion.span
          animate={{ filter: `brightness(${focused ? 1.06 : 0.78})` }}
          transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.standard }}
          className="relative grid place-items-center rounded-full"
        >
          <Avatar
            src={profile.avatar}
            name={name}
            gender={profile.gender}
            size={size}
            ring={focused ? "rgba(255,255,255,0.34)" : undefined}
          />
        </motion.span>
      </span>

      <motion.span
        animate={{ opacity: focused ? 0.95 : 0.4 }}
        transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.standard }}
        className="max-w-full truncate text-center text-[15px] font-light tracking-wide text-white"
      >
        {name}
      </motion.span>
    </motion.button>
  );
}
