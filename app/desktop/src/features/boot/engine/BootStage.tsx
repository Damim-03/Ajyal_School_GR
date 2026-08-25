import { useEffect, useRef } from "react";

import { prefersStillMotion } from "../../../core/system/preferences";
import { BootRenderer, detectQuality, type Quality } from "./BootRenderer";
import { SETTLED, frameAt, type BootFrame } from "./BootTimeline";
import { TOTAL, type BootPhase } from "./boot.config";

/**
 * **غلافُ React حول المحرّك — ومسؤوليتُه ضيّقةٌ عمداً.**
 *
 * يُنشئ اللوحة، ويسلّمها للمُصيِّر، ويملك الساعة، ويُبلّغ **تبدّلَ
 * الطور** — لا أكثر.
 *
 * ## القاعدةُ التي لا تُخرَق (§2)
 *
 * **لا حالةَ React تتغيّر في الإطار.** الساعةُ تكتب في `renderer.frame`
 * مباشرةً — كائنٌ عاديّ خارج الشجرة — والمُصيِّر يقرؤه. فستّون إطاراً
 * في الثانية تكلّف صفرَ إعادةِ عرض.
 *
 * والاستثناءُ الوحيد `onPhase`: يُنادى حين **يتبدّل الطور** فقط، أي
 * ثلاثَ عشرةَ مرّةً في تسع ثوانٍ. وهو ما تحتاجه طبقةُ الواجهة فوقه
 * (الشعار، ثمّ ظهورُ المصادقة) — وثمنُه لا شيء.
 *
 * ## والسقوطُ الآمن
 *
 * لو تعذّر WebGL2 — سائقٌ قديم، أو تسريعٌ معطَّل، أو سياقٌ ضاع — **لا
 * يتعطّل الإقلاع**: تبقى اللوحةُ سوداءَ وتمضي الساعةُ والأطوارُ كما
 * هي، فيصل المستخدم إلى المصادقة. شاشةُ إقلاعٍ لا تُرى خيرٌ من تطبيقٍ
 * لا يُفتح.
 */
export function BootStage({
  /** يُنادى عند تبدّل الطور وحده — لا في كلّ إطار. */
  onPhase,
  /** يُنادى مرّةً عند بلوغ النهاية. */
  onDone,
  /**
   * القفزُ إلى النهاية — للتشغيلات التي لا تستحقّ المشهد كاملاً
   * (‏`skipIntro` بعد التهيئة، أو إقلاعٌ سبق في الجلسة نفسِها).
   */
  settled = false,
  quality,
  className = "",
}: {
  onPhase?: (phase: BootPhase, frame: BootFrame) => void;
  onDone?: () => void;
  settled?: boolean;
  quality?: Quality;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /*
   * المستدعياتُ في مرجعٍ لا في تبعيات.
   *
   * الأثرُ يُركَّب مرّةً واحدة — وسياقٌ رسوميٌّ يُعاد إنشاؤه لأنّ دالّةً
   * سهميةً تبدّلت هويّتُها في عرضٍ ما يعني إعادةَ ترجمة أربعة برامج
   * وتخصيصَ ثلاثة أنسجة ملءَ الشاشة. فتُقرأ من المرجع، ويبقى الأثرُ
   * بلا تبعيات.
   */
  const cbs = useRef({ onPhase, onDone, settled });

  /*
   * والتحديثُ في أثرٍ لا في جسم العرض: قراءةُ `ref.current` أو الكتابةُ
   * فيه أثناء التصيير ممنوعةٌ في هذا المشروع (‏`react-hooks/refs`)،
   * وسببُها أنّ التصيير قد يُعاد أو يُهجَر فتصير الكتابةُ أثراً جانبياً
   * لعرضٍ لم يقع. والأثرُ يجري بعد التثبيت، والتأخّرُ إطارٌ واحد لا
   * يضرّ هنا — المستدعياتُ تُقرأ عند تبدّل الطور لا في كلّ إطار.
   */
  useEffect(() => {
    cbs.current = { onPhase, onDone, settled };
  }, [onPhase, onDone, settled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: BootRenderer | null = null;

    /*
     * **لوحةٌ لا ترسم يجب أن تُرفع من الشاشة.**
     *
     * الطبقةُ `absolute inset-0` فوق الواجهة كلِّها. فما دامت مركَّبةً
     * وفارغةً، هي مساحةٌ ملءَ الشاشة يملؤها المتصفّحُ بما يشاء — وقد
     * ملأها بالأبيض فعلاً حين فشل البناءُ مرّةً، فحجبت شاشةَ اختيار
     * المستخدم كاملةً.
     *
     * و`alpha: true` في المحرّك تُذهب السببَ من أصله؛ وهذا السطرُ
     * الحزامُ الثاني: ما لا يرسم لا يُركَّب.
     */
    const silence = () => {
      canvas.style.display = "none";
    };

    try {
      renderer = new BootRenderer(canvas, quality ?? detectQuality());
    } catch (err) {
      /* لا يُعطَّل الإقلاع لأجل المشهد — انظر أعلاه. */
      console.warn("[boot] WebGL2 unavailable — المشهدُ صامت:", err);
      silence();
    }

    /*
     * وفقدُ السياق يقع في الاستعمال العاديّ لا في العطل وحده: تحديثُ
     * تعريفِ العتاد، أو إعادةُ ضبط المشغّل، أو نومُ الجهاز. وقد كان
     * ذلك — قبل هذا السطر — يُبيّض التطبيقَ في وجه المستخدم.
     */
    canvas.addEventListener("webglcontextlost", silence);

    const still = prefersStillMotion();
    if (renderer) renderer.still = still;

    /* ---------- الساعة ---------- */
    let raf = 0;
    let origin = performance.now();
    let last: BootPhase | null = null;
    let finished = false;

    const tick = () => {
      const jumped = cbs.current.settled;
      const frame = jumped
        ? SETTLED
        : frameAt((performance.now() - origin) / 1000, still);

      if (renderer) renderer.frame = frame;

      if (frame.phase !== last) {
        last = frame.phase;
        cbs.current.onPhase?.(frame.phase, frame);
      }

      if (!finished && frame.done) {
        finished = true;
        cbs.current.onDone?.();
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    renderer?.start();

    /*
     * `ResizeObserver` على اللوحة لا حدثُ النافذة.
     *
     * حدثُ النافذة يفوته ما لا يأتي منها — أظهرُها لوحةٌ رُكّبت قبل أن
     * يستقرّ التخطيط فقيست بصفر، فتبقى سوداءَ إلى أن يُحجَّم المستخدمُ
     * النافذة بيده. (العلّةُ نفسُها موثّقةٌ في `CinematicEnvironment`.)
     */
    const ro = new ResizeObserver(() => renderer?.resize());
    ro.observe(canvas);

    /*
     * التبويبُ المخفيّ — **الزمنُ يُحفظ ويُستأنف منه**.
     *
     * `requestAnimationFrame` يتباطأ من نفسه في نافذةٍ خلفية ولا يقف،
     * ولو تُركت الساعةُ تجري لعاد المستخدمُ فوجد المشهدَ قد انتهى في
     * غيابه. فيُلتقط المنقضي عند الإخفاء، ويُزاح الأصلُ به عند العودة.
     *
     * والالتقاطُ عند الإخفاء **وحده**: حسابُه عند الظهور أيضاً كان يقرأ
     * من أصلٍ قديمٍ فيُضاعف ما مضى — عطلٌ لا يظهر إلّا لمن غاب وعاد.
     */
    let held = 0;

    const onVisibility = () => {
      if (document.hidden) {
        held = Math.min(TOTAL, (performance.now() - origin) / 1000);
        renderer?.stop();
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else {
        origin = performance.now() - held * 1000;
        renderer?.start();
        if (!raf) raf = requestAnimationFrame(tick);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", silence);
      document.removeEventListener("visibilitychange", onVisibility);
      if (raf) cancelAnimationFrame(raf);
      renderer?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
