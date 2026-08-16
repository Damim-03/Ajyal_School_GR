import { useEffect, useState } from "react";
import { compactPx, geometry } from "./tokens";

/**
 * مقاسات الشريط بالبكسل.
 *
 * لماذا بالبكسل بعد أن كانت سلاسل CSS: حجم البلاطة صار **مقوداً بشدّة
 * التركيز** لا مُبدَّلاً بين قيمتين. وقيمة مثل `calc(clamp(48px, 5.51vw,
 * 106px) * 1.42)` لا يستطيع أي محرّك حركة استيفاءها رقمياً — لا بدّ من عدد.
 *
 * تُحسب مرّة عند التركيب وعند تغيّر حجم النافذة فقط، لا في كل إطار: هذه
 * قيمة تخطيط لا قيمة حركة.
 */
export interface TileMetrics {
  /** البلاطة الهادئة. */
  compact: number;
  /** البلاطة عند اكتمال التركيز. */
  focused: number;
  /** الفجوة بين بلاطتين. */
  gap: number;
  /** مقاس الرمز — ثابت لا يتبع تمدّد الحاوية. */
  icon: number;
}

function measure(): TileMetrics {
  const c = compactPx(typeof window === "undefined" ? 1280 : window.innerWidth);
  return {
    compact: c,
    focused: c * geometry.selectedRatio,
    gap: c * geometry.gapRatio,
    icon: c * geometry.iconRatio,
  };
}

export function useTileMetrics(): TileMetrics {
  const [m, setM] = useState(measure);

  useEffect(() => {
    const sync = () =>
      setM((prev) => {
        const next = measure();
        /* مقارنة قبل الضبط: تغيير الحجم يُطلق عشرات الأحداث، وأغلبها لا
           يغيّر المقاس المكبوح (clamp) أصلاً. */
        return prev.compact === next.compact ? prev : next;
      });
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return m;
}
