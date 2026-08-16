import type { Transition } from "motion/react";
import { MOTION } from "./system";

/**
 * البيئة النفعية — حركة واجهات العمل: الجداول، الحقول، القوائم المنسدلة،
 * المرشِّحات، التلميحات.
 *
 * القاعدة الحاكمة: هذه العناصر **تُستعمل**، لا تُشاهَد. الكاشير يضغط الزر
 * مئة مرة في اليوم؛ أي حركة سينمائية هنا تتحوّل إلى تأخير محسوس. لذلك
 * كل شيء أدناه ≤ 160ms وبلا إزاحات تتجاوز بضعة بكسلات.
 *
 * الرئيسية وحدها هي التي تستحقّ الإيقاع المشهدي.
 */

const U = MOTION.env.utility;

/*
 * ملاحظة: `pressable` و`pressableIcon` و`liftable` و`rowFeedback` تعيش في
 * interactions.ts وهي مستعملة عبر التطبيق — لا تُكرَّر هنا. هذا الملف
 * يضيف ما لم يكن موجوداً فقط.
 */

/** صفّ جدول: تمييز بلا إزاحة — البيانات الكثيفة يجب أن تبقى مستقرّة. */
export const tableRow = {
  whileHover: { backgroundColor: "rgba(255,255,255,0.04)" },
  transition: U.transition as Transition,
} as const;

/**
 * إدراج صفّ جديد. الإزاحة 4px فقط: يكفي أن يلحظ المستخدم أنّ شيئاً أُضيف
 * دون أن يقفز الجدول تحت يده.
 */
export const rowInsert = {
  initial: { opacity: 0, y: -MOTION.distance.micro },
  animate: { opacity: 1, y: 0 },
  transition: { duration: MOTION.duration.fast, ease: MOTION.easing.enter },
} as const;

/** حذف صفّ: الارتفاع ينهار فينساب جيرانه بدل أن يقفزوا. */
export const rowRemove = {
  exit: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 },
  transition: { duration: MOTION.duration.fast, ease: MOTION.easing.exit },
} as const;

/**
 * قائمة منسدلة — أصلها عند الزرّ لا في وسط الشاشة، فتبدو نابعة منه.
 * الأب يحتاج `transformOrigin` مناسباً.
 */
export const dropdown = {
  initial: { opacity: 0, scale: 0.98, y: -MOTION.distance.micro },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: -2 },
  transition: { duration: MOTION.duration.instant, ease: MOTION.easing.enter },
} as const;

/** تلميح — أسرع ما في النظام. */
export const tooltip = {
  initial: { opacity: 0, y: 3 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 2 },
  transition: { duration: 0.1, ease: MOTION.easing.standard },
} as const;

/** فتح/طيّ لوحة المرشِّحات — الارتفاع يُحرَّك، والمحتوى يتلاشى معه. */
export const collapsible = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: MOTION.duration.fast, ease: MOTION.easing.enter },
} as const;

/** حالة فارغة: أيقونة ← عنوان ← إجراء، بتتابع ضئيل لا مسرحي. */
export const emptyState = {
  container: { animate: { transition: { staggerChildren: MOTION.stagger.tight } } },
  item: {
    initial: { opacity: 0, y: MOTION.distance.small },
    animate: { opacity: 1, y: 0, transition: { duration: MOTION.duration.normal, ease: MOTION.easing.enter } },
  },
} as const;
