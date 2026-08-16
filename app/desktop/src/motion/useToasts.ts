import { useCallback, useRef, useState } from "react";
import type { ToastItem, ToastTone } from "./MotionToast";

/**
 * useToasts — طابور إشعارات بسيط يحلّ محلّ حالة `toast` المفردة.
 * يحافظ على نفس واجهة الاستدعاء القديمة: flash("نصّ").
 */
export function useToasts(timeout = 2400) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const flash = useCallback(
    (text: string, tone: ToastTone = "info") => {
      const id = ++seq.current;
      setItems((prev) => [...prev.slice(-2), { id, text, tone }]); // 3 كحدّ أقصى
      window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), timeout);
    },
    [timeout],
  );

  return { toasts: items, flash };
}
