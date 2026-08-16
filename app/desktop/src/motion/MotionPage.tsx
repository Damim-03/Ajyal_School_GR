import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useRouteMotion, routeVariants } from "./route-motion";
import { useMotionPhase } from "./orchestrator";
import { MOTION } from "./system";

/**
 * SemanticPage — دخول صفحة يعرف من أين جاء المستخدم.
 *
 * لا يوجد AnimatePresence على مستوى الراوتر (جُرّب فعطّل التنقّل ووُثّق
 * سبب إزالته في routes/index.tsx)، فالخروج تديره انتقالات الشاشات
 * المخصّصة، وهذا الغلاف مسؤول عن الدخول وحده — وهو الجزء الذي يحمل
 * المعنى: تقدّمتَ؟ رجعتَ؟ انتقلتَ لشقيق؟
 */
export function SemanticPage({
  children,
  className = "",
  /** تجاوز التصنيف التلقائي عند الحاجة. */
  as,
}: {
  children: ReactNode;
  className?: string;
  as?: "forward" | "back" | "sibling" | "none";
}) {
  const still = useReducedMotion();
  const { motion: kind } = useRouteMotion();
  const [settled, setSettled] = useState(false);
  /**
   * **مساحة العمل تنطوي، ولا تُغطَّى فحسب.**
   *
   * كان الخروج حجاباً يُسدَل فوق صفحةٍ ساكنة تماماً: الدخول تحوّلٌ متّصل
   * والخروج ستارة. والمنسّق يعلن `RETURNING` قبل تبديل المسار بلحظة، فلا
   * حاجة إلى حالةٍ جديدة ولا إلى `AnimatePresence` على الراوتر (جُرّب في
   * هذا المشروع فعطّل التنقّل وأُزيل بتوثيق).
   *
   * فتنحسر الصفحة قليلاً وترتفع بينما يتمدّد الحجاب فوقها — يُقرأ انسحاباً
   * إلى العمق لا اختفاءً. والانحسار ملكُ React هنا، فلا يصارع كتابةً
   * يدوية على النمط السطري.
   */
  const leaving = useMotionPhase() === "RETURNING";
  const v = routeVariants[as ?? kind];
  // مع تفضيل تقليل الحركة نُبقي التسلسل الهرمي (تلاشٍ) ونحذف الإزاحة
  const from = still ? { opacity: 0 } : v.from;
  const to = still ? { opacity: 1 } : v.to;
  // لكل نوع انتقاله: العمق بنابض، والرجوع أسرع، والشقيق مدّة ثابتة.
  const transition = still ? MOTION.env.utility.transition : v.transition;

  return (
    <motion.div
      initial={from}
      animate={leaving ? (still ? { opacity: 0.2 } : { opacity: 0.2, scale: 0.985, y: -8 }) : to}
      transition={leaving ? { duration: 0.3, ease: MOTION.easing.exit } : transition}
      onAnimationComplete={() => setSettled(true)}
      /*
       * يُمسح التحويل بعد الاستقرار: أيّ transform على السلف يجعل الأبناء
       * position:fixed تتموضع بالنسبة إليه لا إلى النافذة، فتنكسر النوافذ
       * والأدراج داخل الصفحة. الحركة تحدث ثم تختفي أثرها تماماً.
       */
      /* يُعاد التحويل أثناء الانسحاب: مسحُه بعد الاستقرار يخصّ السكون وحده. */
      style={settled && !leaving ? { transform: "none" } : undefined}
      className={className}
    >
      {children}
    </motion.div>
  );
}
