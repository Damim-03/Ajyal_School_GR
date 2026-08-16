/**
 * Variants — لغة الحركة المشتركة. مكوّنان يؤدّيان التفاعل نفسه يجب أن
 * يستعملا نفس الـvariant.
 *
 * كل قيمة هنا تأتي من MOTION في system.ts. سابقاً كانت تأتي من نظام رموز
 * ثانٍ (tokens.ts) وطبقة انتقالات ثالثة (transitions.ts) لا يعرف أيّهما
 * الآخر — فكان للنافذة فيزياء وللشريط أخرى وللإشعار ثالثة، وأي ضبط في
 * أحدها لا يصل إلى البقيّة. مالك واحد فقط الآن (§64/§65).
 */
import type { Variants } from "motion/react";
import { MOTION } from "./system";

const enter = { duration: MOTION.duration.fast, ease: MOTION.easing.enter };
const fade = { duration: MOTION.duration.fast, ease: MOTION.easing.standard };
/** الخروج أسرع من الدخول عمداً: الإغلاق يجب أن يبدو حاسماً. */
const leave = { duration: MOTION.duration.instant, ease: MOTION.easing.exit };

/** عنصر يُكشف صعوداً — للعناوين وأقسام الصفحة. */
export const revealUp: Variants = {
  initial: { opacity: 0, y: MOTION.distance.small },
  animate: { opacity: 1, y: 0, transition: enter },
  exit: { opacity: 0, transition: fade },
};

/* ===== طبقات (نوافذ/أدراج) ===== */

/** حجاب النافذة: تعتيم + ضبابية متزامنان مع اللوح. */
export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: fade },
  exit: { opacity: 0, transition: { ...fade, duration: 0.14 } },
};

/** لوح النافذة — دخول هادئ بلا «قفزة»، بنابض طبقات العمق نفسه. */
export const dialogVariants: Variants = {
  initial: { opacity: 0, scale: MOTION.scale.dialogIn, y: MOTION.distance.small },
  animate: { opacity: 1, scale: 1, y: 0, transition: MOTION.spring.overlay },
  exit: { opacity: 0, scale: MOTION.scale.dialogIn, y: MOTION.distance.micro, transition: leave },
};

/* ===== قوائم ===== */

/** حاوية قائمة بتتابع ضيّق. */
export const listStagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: MOTION.stagger.tight } },
  exit: {},
};

/** عنصر قائمة/بطاقة. */
export const listItem: Variants = {
  initial: { opacity: 0, y: MOTION.distance.micro },
  animate: { opacity: 1, y: 0, transition: enter },
  exit: { opacity: 0, transition: { duration: MOTION.duration.instant } },
};

/* ===== إشعارات ===== */

/** Toast — دخول من الأسفل، خروج بتقلّص خفيف. */
/** يصعد من الحافّة السفلى التي يسكنها الطابور. */
export const toastVariants: Variants = {
  initial: { opacity: 0, y: 18, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1, transition: MOTION.spring.tile },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.16, ease: MOTION.easing.exit } },
};
