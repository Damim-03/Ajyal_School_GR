/**
 * زرُّ الطاقة — أسفل الوسط.
 *
 * سطحٌ دائريٌّ شفّافٌ وحدٌّ رفيع، بلا ظلٍّ ثقيلٍ ولا امتلاءٍ لونيّ.
 * وهو مقصودٌ أن يُرى ولا يُنادى: من يبحث عنه يجده، ومن لا يبحث لا
 * يشدّه عن الوجوه في الوسط.
 */

import { motion } from "motion/react";
import { Power } from "lucide-react";

import { MOTION } from "../../motion/system";

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
      className="grid h-12 w-12 cursor-pointer place-items-center rounded-full border outline-none"
      style={{ boxShadow: "inset 0 1px 16px rgba(255,255,255,0.05)" }}
    >
      <Power
        className="h-4.5 w-4.5 text-white"
        strokeWidth={1.4}
        style={{ opacity: focused ? 0.85 : 0.45 }}
      />
    </motion.button>
  );
}
