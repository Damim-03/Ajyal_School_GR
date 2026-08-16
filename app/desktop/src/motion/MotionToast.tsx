import { AnimatePresence, motion } from "motion/react";
import { LAYER } from "./layers";
import { toastVariants } from "./variants";
import { MOTION } from "./system";

export type ToastTone = "info" | "success" | "error";
export interface ToastItem {
  id: number;
  text: string;
  tone?: ToastTone;
}

const TONE: Record<ToastTone, string> = {
  info: "bg-slate-900/90 text-white",
  success: "bg-green-600/95 text-white",
  error: "bg-red-600/95 text-white",
};

/**
 * MotionToastStack — إشعارات تدخل وتخرج بنعومة، وتُعيد ترتيب نفسها تلقائياً
 * عبر layout animation عند دخول/خروج إشعار (لا قفزات).
 *
 * **أسفل الشاشة عمداً.** هذا الطابور تغذيةٌ راجعة فورية لعمل المستخدم
 * («القائمة فارغة»)، وموضعه قرب يده وأزراره. أمّا أحداث النظام — ومنها
 * الطباعة — فلها `components/notify`: كبسولة أعلى الشاشة بأسلوب
 * الكونسول. والفصل بينهما مقصود ومُوثَّق في `notify.store`.
 */
export function MotionToastStack({ items }: { items: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2" style={{ zIndex: LAYER.toast }}>
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            variants={toastVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={MOTION.spring.tile}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto rounded-xl px-5 py-2.5 text-sm font-bold shadow-lg ${TONE[t.tone ?? "info"]}`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
