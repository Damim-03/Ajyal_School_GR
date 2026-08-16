/**
 * Interactions — تغذية راجعة قابلة لإعادة الاستعمال (تحويم/ضغط/تحديد).
 * تُمرَّر كـprops جاهزة بدل إنشاء مكوّنات غلاف بلا معنى:
 *   <motion.button {...pressable}>حفظ</motion.button>
 */
import { MOTION } from "./system";

/** زر: ضغط محسوس فوري + إضاءة خفيفة عند التحويم. */
export const pressable = {
  whileHover: { filter: "brightness(1.06)" },
  whileTap: { scale: MOTION.scale.press },
  transition: MOTION.spring.press,
} as const;

/** أيقونة تفاعلية: ضغط أسرع وأعمق قليلاً. */
export const pressableIcon = {
  whileHover: { scale: 1.06 },
  whileTap: { scale: MOTION.scale.pressIcon },
  transition: MOTION.spring.press,
} as const;

/** بطاقة قابلة للنقر: ارتفاع خفيف — لا تُستعمل لكل حاوية. */
export const liftable = {
  whileHover: { y: -3, scale: MOTION.scale.hover },
  whileTap: { scale: MOTION.scale.pressCard },
  transition: MOTION.spring.tile,
} as const;

/** صفّ جدول: تغذية راجعة خفيفة جداً (الجداول أسطح إنتاجية لا مسرح). */
export const rowFeedback = {
  whileTap: { scale: MOTION.scale.pressRow },
  transition: MOTION.env.utility.transition,
} as const;
