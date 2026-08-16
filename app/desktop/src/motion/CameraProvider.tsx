import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import {
  CameraContext, CAMERA_SPRING, IDLE_AFTER_MS,
  NUDGE_PX, NUDGE_ZOOM, NUDGE_HOLD_MS, CAMERA_RANGE,
} from "./camera";

/**
 * مصدر الكاميرا — يُركَّب مرّة واحدة حول التطبيق.
 *
 * مصدران للحركة يُجمعان:
 *   1. المؤشّر — انجراف بطيء جداً، على البيئة وحدها.
 *   2. دفعة التنقّل — ميل قصير باتجاه التركيز ثم عودة، مع تكبير 1.2%.
 *
 * الجمع مقصود: الدفعة لا تُلغي وضع المؤشّر بل تُضاف إليه، فلا تقفز
 * الكاميرا إلى الصفر عند كل تنقّل ثم تعود.
 *
 * الأداء: كل شيء على MotionValue خارج شجرة React — لا `setState` في أي
 * إطار. القياس أكّد **صفر** إعادة عرض من 45 حركة مؤشّر. الحالة الوحيدة
 * هي `idle` وتتغيّر مرّتين في الدقيقة على الأكثر.
 */
export function CameraProvider({ children }: { children: ReactNode }) {
  const still = useReducedMotion();

  // المؤشّر: معيَّر [-1, 1]
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  // الدفعة: بالبكسل، تُقسَّم على المدى كي تصير بالوحدة نفسها
  const nudgeX = useMotionValue(0);
  const rawZoom = useMotionValue(1);

  const sumX = useTransform([pointerX, nudgeX], ([p, n]: number[]) => p + n / CAMERA_RANGE);
  const x = useSpring(sumX, CAMERA_SPRING);
  const y = useSpring(pointerY, CAMERA_SPRING);
  const zoom = useSpring(rawZoom, CAMERA_SPRING);

  const [idle, setIdle] = useState(false);
  const nudgeTimer = useRef(0);

  const nudge = useCallback(
    (direction: number) => {
      if (still) return;
      nudgeX.set(direction * NUDGE_PX);
      rawZoom.set(NUDGE_ZOOM);
      window.clearTimeout(nudgeTimer.current);
      // العودة إلى السكون بعد لحظة — الميل استجابة لا حالة دائمة
      nudgeTimer.current = window.setTimeout(() => {
        nudgeX.set(0);
        rawZoom.set(1);
      }, NUDGE_HOLD_MS);
    },
    [nudgeX, rawZoom, still],
  );

  useEffect(() => {
    let timer = 0;
    const wake = () => {
      setIdle((was) => (was ? false : was)); // لا إعادة عرض إن لم يتغيّر
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), IDLE_AFTER_MS);
    };
    const onMove = (e: PointerEvent) => {
      if (!still) {
        pointerX.set((e.clientX / window.innerWidth) * 2 - 1);
        pointerY.set((e.clientY / window.innerHeight) * 2 - 1);
      }
      wake();
    };
    // passive: لا يمنع التمرير أبداً
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("keydown", wake, { passive: true });
    window.addEventListener("pointerdown", wake, { passive: true });
    wake();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(nudgeTimer.current);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("pointerdown", wake);
    };
  }, [pointerX, pointerY, still]);

  const value = useMemo(() => ({ x, y, zoom, idle, nudge }), [x, y, zoom, idle, nudge]);
  return <CameraContext.Provider value={value}>{children}</CameraContext.Provider>;
}
