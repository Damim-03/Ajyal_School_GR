import { LAYER } from "../../motion/layers";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEnvironment, PULSE_MS } from "./environment.store";
import { MOTION } from "../../motion/system";

/**
 * طبقة الإضاءة البيئية — تُركَّب مرّة واحدة عالمياً فوق كل الشاشات.
 *
 * ثلاث استجابات فقط، كلها مقيَّدة عمداً:
 *   • فتح نافذة → تعتيم خفيف للمحيط (الانتباه انتقل لطبقة أعلى)
 *   • نجاح      → نبضة ضوء باردة تمرّ وتخبو
 *   • خطأ       → دفء طفيف في الجوّ
 *
 * `pointer-events: none` مطلق: هذه الطبقة تُرى ولا تُلمس أبداً، فلا يمكن
 * أن تحجب نقرة مهما كانت حالتها.
 */
export function EnvironmentLight() {
  const still = useReducedMotion();
  const pulse = useEnvironment((s) => s.pulse);
  const dimmed = useEnvironment((s) => s.overlays > 0);

  return (
    <>
      {/* تعتيم عند وجود طبقة أعلى — z تحت النوافذ وفوق المحتوى */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-50 bg-[#04060c]"
        initial={false}
        animate={{ opacity: dimmed ? 0.22 : 0 }}
        transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.standard }}
      />

      <AnimatePresence>
        {pulse && (
          <motion.div
            key={pulse}
            aria-hidden
            className="pointer-events-none fixed inset-0"
            style={{
              zIndex: LAYER.ambientLight,
              background:
                pulse === "success"
                  // ضوء بارد يهبط من الأعلى — لا وميض أخضر
                  ? "radial-gradient(ellipse at 50% 0%, rgba(186,230,253,0.16), transparent 62%)"
                  // دفء خافت من الأسفل — لا أحمر صارخ
                  : "radial-gradient(ellipse at 50% 100%, rgba(253,186,164,0.13), transparent 58%)",
            }}
            initial={{ opacity: 0 }}
            /* صعود سريع ثم خبوّ أطول: تُلمَح ولا تُقاطع */
            animate={still ? { opacity: 0.6 } : { opacity: [0, 1, 0.85, 0] }}
            exit={{ opacity: 0 }}
            transition={{
              duration: PULSE_MS[pulse] / 1000,
              times: [0, 0.18, 0.4, 1],
              ease: MOTION.easing.standard,
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
