import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import {
  AMBIENT_CONFIG,
  QUALITY_PRESETS,
  type AmbientState,
  type Quality,
} from "./ambient.config";
import { buildSprites, createParticle, drawParticle, stepParticle, type Particle } from "./particles";
import "./ambient.css";

/** حبيبات SVG مضمّنة (بلا طلب شبكة) لكسر حزوز التدرّج. */
const NOISE_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

export interface AmbientHandle {
  /** استجابة بيئية خفيفة لحدث (اتصال ناجح، جهاز اكتُشف…). */
  pulse: () => void;
}

export interface AmbientBackgroundProps {
  /** شدّة عامة للإضاءة والجسيمات. */
  intensity?: number;
  /** كثافة الجسيمات (1 = المعيار). */
  particleDensity?: number;
  /** التدفّق الأفقي الخفيف وسط الشاشة. */
  particleFlowEnabled?: boolean;
  /** إزاحة خفيفة تتبع الماوس (تُعطَّل تلقائياً على اللمس). */
  enableParallax?: boolean;
  state?: AmbientState;
  quality?: Quality;
  debug?: boolean;
  className?: string;
}

export const AmbientBackground = forwardRef<AmbientHandle, AmbientBackgroundProps>(function AmbientBackground(
  {
    intensity = 1,
    particleDensity = 1,
    particleFlowEnabled = true,
    enableParallax = true,
    state = "idle",
    quality = "high",
    debug = false,
    className = "",
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debugRef = useRef<HTMLDivElement>(null);

  // كل ما يتغيّر أثناء الحركة يعيش في refs — لا إعادة رسم React إطلاقاً
  const propsRef = useRef({ intensity, particleDensity, particleFlowEnabled, enableParallax, state, quality });
  propsRef.current = { intensity, particleDensity, particleFlowEnabled, enableParallax, state, quality };

  const preset = useMemo(() => QUALITY_PRESETS[quality], [quality]);

  // تفضيل تقليل الحركة (يُقرأ مرّة ويُراقَب)
  const reducedRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const c = canvas.getContext("2d", { alpha: true });
    if (!c) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onMQ = (e: MediaQueryListEvent) => { reducedRef.current = e.matches; };
    mq.addEventListener("change", onMQ);

    const sprites = buildSprites();
    let particles: Particle[] = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = performance.now();
    const started = performance.now();
    let coldBoost = 0;
    let pulseUntil = 0;

    // إزاحة الماوس (مُنعَّمة)
    const mouse = { tx: 0, ty: 0, x: 0, y: 0 };
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    const targetCount = () => {
      const mp = (w * h) / 1_000_000;
      const n = mp * preset.particlesPerMegapixel * propsRef.current.particleDensity;
      return Math.max(8, Math.min(preset.maxParticles, Math.round(n)));
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, AMBIENT_CONFIG.maxDPR);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);

      // إعادة ضبط العدد وفق المساحة الجديدة (تتحجّم مع النافذة)
      const want = targetCount();
      if (particles.length > want) particles.length = want;
      while (particles.length < want) particles.push(createParticle(w, h, propsRef.current.particleFlowEnabled));
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const onPointer = (e: PointerEvent) => {
      if (!propsRef.current.enableParallax || coarse || reducedRef.current) return;
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // مؤشّرات التشخيص
    let frames = 0;
    let fpsAt = performance.now();
    let fps = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);

      // إيقاف الرسم كلياً عندما تكون النافذة مخفية (توفير طاقة)
      if (document.hidden) { last = now; return; }

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const P = propsRef.current;
      const reduced = reducedRef.current;
      const speed = reduced ? 0.12 : 1;

      // ظهور تدريجي للجسيمات بعد استقرار الإضاءة
      const elapsed = now - started;
      const introT = Math.min(1, Math.max(0, (elapsed - AMBIENT_CONFIG.intro.canvasDelayMs) / AMBIENT_CONFIG.intro.canvasFadeMs));
      const intro = introT * introT * (3 - 2 * introT); // smoothstep

      // حالات: نجاح ⇒ دفعة باردة · نبضة مؤقّتة
      const wantCold = P.state === "success" ? 1 : now < pulseUntil ? 0.7 : 0;
      coldBoost += (wantCold - coldBoost) * Math.min(1, dt * 2.2);

      const stateIntensity = P.state === "error" ? 0.72 : 1;

      // تنعيم إزاحة الماوس
      mouse.x += (mouse.tx - mouse.x) * AMBIENT_CONFIG.parallax.damping;
      mouse.y += (mouse.ty - mouse.y) * AMBIENT_CONFIG.parallax.damping;
      const offX = mouse.x * AMBIENT_CONFIG.parallax.particlesNear;
      const offY = mouse.y * AMBIENT_CONFIG.parallax.particlesNear * 0.6;

      const stepCtx = {
        w, h, dt, speed,
        allowFlow: P.particleFlowEnabled,
        coldBoost,
        intensity: P.intensity * intro * stateIntensity,
      };

      c.clearRect(0, 0, w, h);
      c.globalCompositeOperation = "lighter"; // تراكب ضوئي طبيعي للغبار
      for (let i = 0; i < particles.length; i++) {
        stepParticle(particles[i], stepCtx);
        drawParticle(c, particles[i], sprites, offX, offY);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";

      // إزاحة طبقات CSS (متغيّر واحد — بلا إعادة رسم React)
      if (P.enableParallax && !coarse && !reduced) {
        root.style.setProperty("--amb-mx", `${mouse.x * AMBIENT_CONFIG.parallax.base}px`);
        root.style.setProperty("--amb-my", `${mouse.y * AMBIENT_CONFIG.parallax.base}px`);
        root.style.setProperty("--amb-hx", `${mouse.x * AMBIENT_CONFIG.parallax.haze}px`);
        root.style.setProperty("--amb-hy", `${mouse.y * AMBIENT_CONFIG.parallax.haze}px`);
      }

      if (debug) {
        frames++;
        if (now - fpsAt >= 500) {
          fps = Math.round((frames * 1000) / (now - fpsAt));
          frames = 0;
          fpsAt = now;
          if (debugRef.current) {
            debugRef.current.textContent = `${fps} fps · ${particles.length}p · ${w}×${h} · dpr ${dpr}`;
          }
        }
      }
    };

    raf = requestAnimationFrame(frame);

    // كشف واجهة النبضة
    pulseApi.current = () => {
      pulseUntil = performance.now() + AMBIENT_CONFIG.states.pulseMs;
      root.dataset.pulse = "1";
      window.setTimeout(() => { if (rootRef.current) rootRef.current.dataset.pulse = "0"; }, AMBIENT_CONFIG.states.pulseMs);
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      mq.removeEventListener("change", onMQ);
      particles = [];
      sprites.clear();
      pulseApi.current = () => {};
    };
    // يُبنى مرّة واحدة؛ بقية التغيّرات تُقرأ من propsRef داخل الحلقة.
  }, [preset, debug]);

  const pulseApi = useRef<() => void>(() => {});
  useImperativeHandle(ref, () => ({ pulse: () => pulseApi.current() }), []);

  return (
    <div
      ref={rootRef}
      className={`amb-root ${className}`}
      data-state={state}
      data-pulse="0"
      aria-hidden="true"
      style={{ ["--amb-noise" as string]: NOISE_URL }}
    >
      <div className="amb-layer amb-base" />
      <div
        className="amb-layer amb-lower-glow"
        style={{ transform: "translate3d(var(--amb-mx,0), var(--amb-my,0), 0)" }}
      />
      <div
        className="amb-layer amb-volumetric"
        style={{ opacity: intensity, transform: "translate3d(var(--amb-mx,0), var(--amb-my,0), 0)" }}
      />

      {preset.raysEnabled && (
        <div className="amb-layer amb-rays">
          <div className="amb-ray amb-ray-1" />
          <div className="amb-ray amb-ray-2" />
          <div className="amb-ray amb-ray-3" />
        </div>
      )}

      {preset.hazeEnabled && (
        <div
          className="amb-layer amb-haze"
          style={{ transform: "translate3d(var(--amb-hx,0), var(--amb-hy,0), 0)" }}
        >
          <div className="amb-haze-blob amb-haze-1" />
          <div className="amb-haze-blob amb-haze-2" />
        </div>
      )}

      <canvas ref={canvasRef} className="amb-canvas" />

      <div className="amb-layer amb-state" />
      {preset.noiseEnabled && <div className="amb-layer amb-noise" />}
      <div className="amb-layer amb-vignette" />

      {debug && (
        <div
          ref={debugRef}
          style={{
            position: "absolute", left: 8, bottom: 8, zIndex: 5,
            font: "11px ui-monospace, monospace", color: "#9fb0c9",
            background: "rgba(5,9,20,0.6)", padding: "3px 7px", borderRadius: 6,
          }}
        />
      )}
    </div>
  );
});
