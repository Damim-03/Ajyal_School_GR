import { LAYER } from "./layers";
import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { backdropVariants, dialogVariants } from "./variants";
import { useEnvironment } from "../components/ambient/environment.store";
import { materialStyle } from "./materials";

/** عناصر يمكن للوحة المفاتيح الوصول إليها داخل اللوح. */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * MotionDialog — سلوك النوافذ الموحّد لكل التطبيق (طبقة عمق واحدة لا 8 قيم مختلفة):
 *   الخلفية تتراجع (تعتيم + ضبابية) واللوح يدخل بتكبير/انزياح خفيف، والخروج يعكس الدخول.
 *
 * الاستعمال — التركيب الشرطي يبقى بيد الأب (فلا يتغيّر توقيت جلب البيانات)،
 * والأب يلفّه بـ<AnimatePresence> ليعمل الخروج:
 *
 *   <AnimatePresence>
 *     {open && <SearchModal onClose={close} />}
 *   </AnimatePresence>
 */
export function MotionDialog({
  onClose,
  children,
  className = "",
  /** يُخفي النافذة مع إبقاء حالتها (عند فتح طبقة فوقها). */
  hidden = false,
  closeOnBackdrop = true,
  zIndex = LAYER.dialog,
  labelledBy,
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  hidden?: boolean;
  closeOnBackdrop?: boolean;
  zIndex?: number;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  /*
   * تسجيل الطبقة (§10): المحيط يتراجع بالتعتيم ما دامت نافذة مفتوحة.
   * العدّاد يتعامل مع التداخل — إغلاق الأعلى لا يُعيد الإضاءة إن بقيت
   * واحدة مفتوحة تحته.
   */
  const pushOverlay = useEnvironment((s) => s.pushOverlay);
  const popOverlay = useEnvironment((s) => s.popOverlay);
  useEffect(() => {
    pushOverlay();
    return popOverlay;
  }, [pushOverlay, popOverlay]);

  /*
   * إدارة التركيز (§36) — كانت غائبة تماماً: عند فتح نافذة كان تركيز
   * لوحة المفاتيح يبقى على الصفحة تحتها، فيمكن التنقّل بـTab إلى عناصر
   * محجوبة بصرياً، ولا يعود التركيز إلى ما فتح النافذة عند إغلاقها.
   */
  useEffect(() => {
    if (hidden) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // أول عنصر قابل للتركيز، وإلا اللوح نفسه
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus({ preventScroll: true });
    return () => opener?.focus?.({ preventScroll: true }); // يُعاد التركيز لمصدره
  }, [hidden]);

  /** حبس التنقّل داخل اللوح + Escape للإغلاق. */
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab") return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!items || items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      // اللفّ عند الطرفين يمنع خروج التركيز إلى الصفحة المحجوبة
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    },
    [onClose],
  );

  return (
    <motion.div
      variants={backdropVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={closeOnBackdrop ? onClose : undefined}
      className={`fixed inset-0 flex items-center justify-center p-4 ${hidden ? "hidden" : ""}`}
      /* المادة من نظام واحد لا قيم مكتوبة في كل نافذة */
      style={{
        ...materialStyle("overlay"),
        zIndex,
      }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        variants={dialogVariants}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        tabIndex={-1}
        className={className}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
