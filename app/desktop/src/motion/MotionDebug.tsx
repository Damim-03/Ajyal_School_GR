import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useIdle } from "./camera";
import { LAYER } from "./layers";
import { useLayoutDirection } from "./direction";
import { useMotionStore } from "./orchestrator";

/**
 * لوحة تنقيح الحركة — للتطوير فقط (§55 → §59).
 *
 * غرضها الحقيقي ليس عرض الأرقام: هو أن يصير **للنظام لسان**. طوال بناء
 * هذا الفصل تكرّر السؤال «هل الحالة NAVIGATING فعلاً الآن؟ من أين جاء هذا
 * التركيز؟» — وكانت الإجابة تحتاج إضافة console.log ثم حذفه. الآن الحالة
 * معروضة، فيُرى الخلل بدل أن يُستنتج.
 *
 * `import.meta.env.DEV` شرط ثابت ⇒ Vite يحذف الكتلة كلّها من حزمة الإنتاج
 * (إزالة شجرة ميتة)، فلا تصل إلى المستخدم ولا تزن شيئاً.
 *
 * لا تعتمد على سياق الراوتر: تُركَّب في Providers أي **خارج** HashRouter،
 * فاستدعاء useLocation منها يرمي استثناءً يُسقط التطبيق إلى شاشة بيضاء.
 * تقرأ المسار من window مباشرة بدل ذلك.
 */

/** مضاعفات السرعة (§58) — أقلّ من 1 يبطّئ، فيصير الاستيفاء قابلاً للفحص. */
const SPEEDS = [0.25, 0.5, 1, 2] as const;

const PHASE_COLOR: Record<string, string> = {
  ENTERING: "#c4b5fd",
  IDLE: "#94a3b8",
  EXPLORE: "#a5b4fc",
  NAVIGATING: "#7dd3fc",
  PREVIEWING: "#86efac",
  PREVIEW_ACTIVE: "#fcd34d",
  EXITING: "#fca5a5",
  WORKSPACE: "#5eead4",
  RETURNING: "#fdba74",
};

function Row({ k, v, color }: { k: string; v: string | number; color?: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-[70px] shrink-0 text-white/40">{k}</span>
      <b className="truncate" style={color ? { color } : undefined}>{v}</b>
    </div>
  );
}

export function MotionDebug() {
  const [open, setOpen] = useState(false);
  const [fps, setFps] = useState(0);
  const [path, setPath] = useState(() => window.location.hash || "#/");
  const idle = useIdle();
  const still = useReducedMotion();
  const dir = useLayoutDirection();

  const phase = useMotionStore((s) => s.phase);
  const focus = useMotionStore((s) => s.focus);
  const hovered = useMotionStore((s) => s.hovered);
  const activeModule = useMotionStore((s) => s.activeModule);
  const previousModule = useMotionStore((s) => s.previousModule);
  const count = useMotionStore((s) => s.count);
  const speed = useMotionStore((s) => s.speed);
  const setSpeed = useMotionStore((s) => s.setSpeed);

  /*
   * المسار يُقرأ بالاستطلاع لا بحدث `hashchange`.
   *
   * السبب: react-router يغيّر المسار عبر `pushState`، و`pushState` **لا
   * يُطلق** hashchange. فكانت اللوحة تعرض `#/login` والتطبيق على `#/` —
   * لوحة تنقيح تكذب أسوأ من لا لوحة، لأنها تُوجّه البحث في الاتجاه الخطأ.
   * كشفه أوّل استعمال حقيقي لها.
   *
   * الاستطلاع يعمل فقط والّلوحة مفتوحة، مرّتين في الثانية: مقارنة سلسلة
   * لا تُذكر كلفتها، وشيفرة تطوير تُحذف من الإنتاج أصلاً.
   */
  useEffect(() => {
    if (!open) return;
    const read = () => setPath((p) => {
      const h = window.location.hash || "#/";
      return p === h ? p : h;
    });
    read();
    const id = window.setInterval(read, 500);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "M" || e.key === "m")) setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    let frames = 0;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      frames++;
      const now = performance.now();
      // تحديث مرّة كل ثانية فقط — لا setState لكل إطار (§40)
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  /* استعادة السرعة الطبيعية عند إغلاق اللوحة: نسيانُ الإبطاء ثم الحيرة من
     «لماذا صار التطبيق بطيئاً؟» خطأ يقع مرّة واحدة ولا يُنسى بعدها. */
  useEffect(() => { if (!open && speed !== 1) setSpeed(1); }, [open, speed, setSpeed]);

  if (!import.meta.env.DEV || !open) return null;

  return (
    <div
      dir="ltr"
      className="fixed bottom-3 left-3 w-[212px] rounded-lg px-3 py-2 font-mono text-[11px] leading-relaxed text-white/85"
      style={{
        zIndex: LAYER.debug,
        background: "rgba(8,10,16,0.9)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <Row k="phase" v={phase} color={PHASE_COLOR[phase]} />
      <Row k="focus" v={`${focus.id}${count ? ` / ${count}` : ""}`} />
      <Row k="prev" v={focus.previousId ?? "—"} />
      <Row k="dir" v={focus.direction > 0 ? "next +1" : focus.direction < 0 ? "prev -1" : "—"} />
      <Row k="distance" v={focus.distance} />
      <Row k="velocity" v={focus.velocity.toFixed(2)} />
      <Row k="source" v={focus.source} />
      <Row k="hovered" v={hovered ?? "—"} />
      <Row k="module" v={activeModule ?? "home"} />
      <Row k="from" v={previousModule ?? "—"} />

      <div className="my-1.5 h-px bg-white/15" />

      <Row k="fps" v={fps || "—"} color={fps >= 55 ? "#86efac" : fps >= 40 ? "#fcd34d" : "#fca5a5"} />
      <Row k="route" v={path} />
      <Row k="layout" v={dir} />
      <Row k="reduced" v={still ? "yes" : "no"} color={still ? "#fcd34d" : undefined} />
      <Row k="idle" v={idle ? "yes" : "no"} />

      {/*
        وضع الفحص (§59): يبطّئ حركة الرئيسية كلّها بالنسبة نفسها، فيُرى ما
        لا يُرى عند 1× — القفزات، والتراكب الخاطئ، وانزياح التخطيط.
        النوابض تُبطّأ بخفض الصلابة لا بإضافة مدّة، فتحتفظ بشخصيتها.
      */}
      <div className="mt-1.5 flex gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className="flex-1 rounded px-1 py-0.5 text-[10px] transition"
            style={{
              background: speed === s ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)",
              fontWeight: speed === s ? 700 : 400,
            }}
          >
            {s}×
          </button>
        ))}
      </div>
      <div className="mt-1 text-center text-white/35">Ctrl+Shift+M</div>
    </div>
  );
}
