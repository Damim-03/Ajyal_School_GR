/**
 * «إضافة مستخدم» — عنصرٌ في الصفّ لا زرٌّ خارجه.
 *
 * يفترق عن بطاقة الحساب في مادّته: سطحٌ داكنٌ شفّاف وحدٌّ رفيع بدل
 * صورةٍ محشوّة. فيُعرف أنّه ليس شخصاً قبل قراءة كلمةٍ تحته، ويبقى
 * مع ذلك من أهل الصفّ يمرّ عليه السهمُ كما يمرّ على غيره — وبالمقياس
 * نفسِه الذي تكبر به البطاقاتُ وتصغر، فلا ينشزّ عن الصفّ.
 */

import { motion } from "motion/react";
import { Plus } from "lucide-react";

import { MOTION } from "../../motion/system";
import { opacityFor, scaleFor } from "./UserItem";

export function AddUserItem({
  distance,
  focused,
  size,
  label,
  onActivate,
}: {
  distance: number;
  focused: boolean;
  size: number;
  label: string;
  onActivate: () => void;
}) {
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
        <motion.span
          aria-hidden
          animate={{ opacity: focused ? 1 : 0, scale: focused ? 1 : 0.86 }}
          transition={MOTION.spring.focus}
          className="pointer-events-none absolute rounded-full"
          style={{
            width: size * 1.75,
            height: size * 1.75,
            background:
              "radial-gradient(circle, rgba(255,240,222,0.07) 0%, rgba(255,240,222,0.026) 42%, rgba(255,240,222,0) 70%)",
          }}
        />

        <motion.span
          aria-hidden
          initial={false}
          animate={{ opacity: focused ? 1 : 0, scale: focused ? 1 : 0.82 }}
          transition={MOTION.spring.focus}
          className="pointer-events-none absolute rounded-full border"
          style={{
            width: size * 1.24,
            height: size * 1.24,
            borderColor: "rgba(255,255,255,0.16)",
          }}
        />

        <motion.span
          animate={{
            borderColor: focused ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.13)",
            backgroundColor: focused ? "rgba(255,255,255,0.065)" : "rgba(255,255,255,0.022)",
          }}
          transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.standard }}
          className="grid place-items-center rounded-full border"
          style={{
            width: size,
            height: size,
            /* توهّجٌ داخليٌّ خافت — عمقُ السطح لا لمعانُه */
            boxShadow: "inset 0 1px 22px rgba(255,255,255,0.05)",
          }}
        >
          <Plus
            className="text-white"
            style={{ width: size * 0.3, height: size * 0.3, opacity: focused ? 0.85 : 0.45 }}
            strokeWidth={1.25}
          />
        </motion.span>
      </span>

      <motion.span
        animate={{ opacity: focused ? 0.95 : 0.4 }}
        transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.standard }}
        className="max-w-full truncate text-center text-[15px] font-light tracking-wide text-white"
      >
        {label}
      </motion.span>
    </motion.button>
  );
}
