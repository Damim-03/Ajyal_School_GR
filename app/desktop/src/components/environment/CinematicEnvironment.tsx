/**
 * الخلفيةُ السينمائية — غلافُ React حول المشهد.
 *
 * ومسؤوليتُه ضيّقةٌ عمداً: يُنشئ اللوحة، ويسلّمها للمنسّق، ويُمرّر إليه
 * خياراتٍ عالية المستوى، ويوقفه حين لا يُرى. **ولا يعرف عن الإطار
 * شيئاً** — لا حالةً تتغيّر معه ولا تصييراً يتبعه.
 *
 * والإيقافُ عند الاختفاء ليس تحسيناً اختيارياً: شاشةُ الإقلاع تبقى
 * مركَّبةً تحت الشاشات التي تعلوها، ولو ظلّت ترسم ألفَ جسيمٍ ستّين
 * مرّةً في الثانية خلف واجهةٍ لا تُرى لأكلت من عمر البطارية ومن سلاسة
 * ما فوقها بلا مقابل.
 */

import { useEffect, useRef } from "react";

import { prefersStillMotion } from "../../core/system/preferences";
import { CinematicScene, detectQuality } from "./scene";
import type { Quality } from "./types";

export interface CinematicEnvironmentProps {
  /** يُكشف المشهد أو يُخفت — بلا إعادة تركيبٍ ولا فقدِ حالة */
  visible?: boolean;
  /** شدّةٌ عامّة [0..1] */
  intensity?: number;
  /** بالإهمال تُقدَّر من قدرة الجهاز */
  quality?: Quality;
  /** إزاحةٌ خفيفة تتبع المؤشّر — تُعمّق الإحساس بالمسافة */
  parallax?: boolean;
  /** موضعُ الزرّ رأسياً [0..1] — يُضيء ما حوله من الغبار */
  focusY?: number;
  className?: string;
}

export function CinematicEnvironment({
  visible = true,
  intensity = 1,
  quality,
  parallax = true,
  focusY = 0.52,
  className = "",
}: CinematicEnvironmentProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<CinematicScene | null>(null);

  /* التركيب — مرّةً واحدة. والخيارات تُدفع إليه في تأثيراتٍ منفصلة. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /*
     * السكونُ له مصدران لا واحد: تفضيلُ النظام، وملمحُ «توفير الطاقة»
     * في تهيئة التطبيق. و`prefersStillMotion` تجمعهما — فاختيارُ
     * المستخدم في شاشة الأداء يهدّئ هذا المشهدَ فعلاً، لا في CSS فقط
     * (الحركةُ هنا على لوحةٍ لا تبلغها أنماطُ الصفحة).
     */
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const scene = new CinematicScene(canvas, {
      quality: quality ?? detectQuality(),
      reducedMotion: prefersStillMotion(),
    });

    sceneRef.current = scene;
    scene.start();

    const onMotionChange = () =>
      scene.setOptions({ reducedMotion: prefersStillMotion() });

    /**
     * `ResizeObserver` على اللوحة نفسها لا حدثُ `resize` على النافذة.
     *
     * حدثُ النافذة يفوته ما لا يأتي منها: لوحةٌ رُكّبت قبل أن يستقرّ
     * التخطيط فقيست بصفر، أو تبدّلٌ في الحاوية بلا تبدّلٍ في النافذة.
     * ورأيتُ الحالة الأولى فعلاً — مخزنٌ خلفيّ 0×0 وحجمٌ تخطيطيّ
     * 1280×720، ولا شيء يوقظ المشهد بعدها فيبقى أسودَ إلى أن يُحجَّم
     * المستخدم النافذة بيده.
     *
     * والمراقبُ يستدرك ذلك من نفسه، ويغني عن حدث النافذة كلِّه لأنّ
     * اللوحة `fixed inset-0` فكلُّ تبدّلٍ في النافذة يبلغها.
     */
    const observer = new ResizeObserver(() => scene.resize());
    observer.observe(canvas);

    /*
     * التبويبُ المخفيّ يوقف الحلقة.
     *
     * ‏`requestAnimationFrame` يتباطأ من نفسه في التبويب الخلفي ولا
     * يتوقّف، ويبقى الجسيمُ يُحسب. والإيقافُ الصريح أضمن — ومعه
     * إعادةُ ضبط الساعة عند العودة، وإلّا قفز المشهد بقدر الغياب.
     */
    const onVisibility = () => {
      if (document.hidden) scene.stop();
      else scene.start();
    };

    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", onMotionChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onMotionChange);
      scene.destroy();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current?.setOptions({ intensity });
  }, [intensity]);

  useEffect(() => {
    if (quality) sceneRef.current?.setOptions({ quality });
  }, [quality]);

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.focusY = focusY;
  }, [focusY]);

  /*
   * المؤشّر — على `window` لا على اللوحة: الواجهةُ فوقها تلتقط الأحداث
   * فلا تصل إليها، وطبقةٌ شفّافةٌ تتلقّاها كانت ستحجب زرَّ الدخول.
   */
  useEffect(() => {
    if (!parallax) return;

    const onMove = (e: PointerEvent) => {
      sceneRef.current?.setPointer(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1,
      );
    };

    window.addEventListener("pointermove", onMove, { passive: true });

    return () => window.removeEventListener("pointermove", onMove);
  }, [parallax]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none fixed inset-0 h-full w-full ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        /* الكشفُ بطيءٌ متأنٍّ — لا ظهورٌ مفاجئ يكسر الهدوء */
        transition: "opacity 1600ms cubic-bezier(0.22,1,0.36,1)",
      }}
    />
  );
}
