/**
 * تلميحاتُ الأزرار — أسفل اليمين.
 *
 * تتبع الحالة: ما يُعرض في الاختيار غيرُ ما يُعرض عند كتابة كلمة
 * المرور. وثباتُها على نصٍّ واحد يجعلها زخرفةً تُقرأ مرّةً ثمّ تُهمل،
 * وتغيّرُها يجعلها الموضعَ الذي تُسأل فيه «وماذا الآن؟».
 */

import { motion } from "motion/react";

import { MOTION } from "../../motion/system";

export interface Hint {
  /** رمزُ المفتاح كما يُطبع على لوحة المفاتيح — `Enter`، `Esc`، `←→` */
  key: string;
  label: string;
}

export function ControllerHints({ hints }: { hints: Hint[] }) {
  return (
    <div dir="ltr" className="flex items-center gap-5">
      {hints.map((hint) => (
        <motion.span
          key={hint.key + hint.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: MOTION.duration.fast, ease: MOTION.easing.standard }}
          className="flex items-center gap-2 text-[11px] font-light tracking-wide text-white/40"
        >
          <span className="grid h-6 min-w-6 place-items-center rounded-md border border-white/20 px-1.5 text-[10px] text-white/60">
            {hint.key}
          </span>
          {hint.label}
        </motion.span>
      ))}
    </div>
  );
}
