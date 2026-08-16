import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { MOTION, pageOrder, pageOrderStep } from "./system";

/**
 * تتابع مكوّنات الصفحة (§CONTENT STAGGER).
 *
 * الترتيب دلالي لا تزييني: الترويسة تُثبّت المكان، ثم شريط الأدوات يقول
 * ماذا يمكن فعله، ثم المحتوى. لو ظهرت الثلاثة معاً لضاع هذا المعنى وبدت
 * الصفحة وكأنها «وُمضت» دفعةً واحدة.
 *
 * التتابع 40ms فقط: يكفي لإدراك الترتيب دون أن يُحسّ انتظاراً. الصفحة
 * كلها مكتملة خلال ~440ms.
 */

/**
 * يلفّ قسماً من الصفحة فيدخل في موضعه من التسلسل.
 * لا يغيّر التخطيط: `display: contents` يجعل الغلاف شفّافاً بنيوياً…
 * لكنّه لا يقبل transform، لذا نستعمل غلافاً عادياً بلا أنماط.
 */
type PageSlot = keyof typeof pageOrder;

export function PageSlotGroup({
  slot,
  children,
  className,
}: {
  slot: PageSlot;
  children: ReactNode;
  className?: string;
}) {
  const still = useReducedMotion();
  const delay = pageOrder[slot] * pageOrderStep;

  return (
    <motion.div
      className={className}
      initial={still ? { opacity: 0 } : { opacity: 0, y: MOTION.distance.small }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        still
          ? MOTION.env.utility.transition
          : { duration: MOTION.duration.normal, delay, ease: MOTION.easing.enter }
      }
    >
      {children}
    </motion.div>
  );
}
