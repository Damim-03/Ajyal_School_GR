/**
 * نظام الجسيمات — منطق خالص خارج دورة رسم React (يُدار بـrefs وrAF فقط).
 * الرسم عبر «سبرايتات» مُحضَّرة مسبقاً بدل حساب تدرّج/ضبابية لكل جسيم في كل إطار،
 * وهو ما يجعل 200+ جسيم تعمل بسلاسة 60fps على عتاد مكتبي عادي.
 */
import { AMBIENT_CONFIG, LIGHT_ORIGIN, LIGHT_REACH, PALETTE } from "./ambient.config";

export type ParticleKind = "micro" | "medium" | "warm" | "bokeh";

export interface Particle {
  x: number;
  y: number;
  z: number; // 0 = بعيد، 1 = قريب
  radius: number;
  vx: number;
  vy: number;
  opacity: number;
  targetOpacity: number;
  life: number; // بالثواني
  maxLife: number;
  temperature: number; // -1 بارد · 0 محايد · 1 دافئ
  kind: ParticleKind;
  swayAmp: number;
  swaySpeed: number;
  swayPhase: number;
  flow: boolean; // جسيم تدفّق أفقي
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: readonly T[]) => arr[(Math.random() * arr.length) | 0];

/** شدّة الإضاءة عند نقطة معيارية (0..1) — تُشتقّ من مصدر الضوء أعلى اليسار. */
export function illuminationAt(nx: number, ny: number): number {
  const dx = nx - LIGHT_ORIGIN.x;
  const dy = (ny - LIGHT_ORIGIN.y) * 0.85;
  const d = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, 1 - d / LIGHT_REACH);
}

/**
 * وزن التوزيع: أعلى-اليسار أكثف، واليمين/أسفل-اليمين شبه خالٍ
 * (يُبقي مساحة سالبة نظيفة خلف واجهة المستخدم).
 */
function spawnWeight(nx: number, ny: number): number {
  // مطابقة المرجع: الكثافة تتزايد نحو النصف السفلي وتغطّي العرض كله،
  // مع تخفيف لطيف حول الشريط الذي تجلس فيه نصوص الواجهة (قابلية القراءة).
  const lower = 0.32 + Math.pow(ny, 1.25) * 1.25; // خفيف أعلى → كثيف أسفل
  const uiDip = 1 - 0.42 * Math.exp(-Math.pow((ny - 0.3) / 0.15, 2));
  const edge = 0.82 + Math.abs(nx - 0.5) * 0.36; // الأطراف أكثف قليلاً من المركز
  return Math.max(0.05, Math.min(1, lower * uiDip * edge * 0.72));
}

/** اختيار موضع بالرفض (rejection sampling) وفق وزن التوزيع. */
function samplePosition(w: number, h: number): { x: number; y: number } {
  for (let i = 0; i < 12; i++) {
    const nx = Math.random();
    const ny = Math.random();
    if (Math.random() < spawnWeight(nx, ny)) return { x: nx * w, y: ny * h };
  }
  return { x: Math.random() * w * 0.6, y: Math.random() * h };
}

function chooseKind(): ParticleKind {
  const m = AMBIENT_CONFIG.particles.mix;
  const r = Math.random();
  if (r < m.micro) return "micro";
  if (r < m.micro + m.medium) return "medium";
  if (r < m.micro + m.medium + m.warm) return "warm";
  return "bokeh";
}

export function createParticle(w: number, h: number, allowFlow: boolean): Particle {
  const P = AMBIENT_CONFIG.particles;
  const kind = chooseKind();
  const pos = samplePosition(w, h);
  const z = kind === "bokeh" ? rand(0.75, 1) : Math.random();
  const [r0, r1] = P.radius[kind];
  const maxLife = rand(P.life[0], P.life[1]);

  const isFlow = allowFlow && kind !== "bokeh" && Math.random() < AMBIENT_CONFIG.flow.ratio;
  const band = AMBIENT_CONFIG.flow.bandY;

  return {
    x: pos.x,
    y: isFlow ? rand(band[0], band[1]) * h : pos.y,
    z,
    radius: rand(r0, r1) * (0.7 + z * 0.6),
    vx: isFlow ? rand(AMBIENT_CONFIG.flow.speed[0], AMBIENT_CONFIG.flow.speed[1]) : rand(P.vx[0], P.vx[1]),
    vy: isFlow ? rand(-0.01, 0.01) : rand(P.vy[0], P.vy[1]),
    opacity: 0,
    targetOpacity: 0,
    life: 0,
    maxLife,
    temperature: kind === "warm" ? rand(0.7, 1) : isFlow ? -1 : pick([0.75, 0.5, 0.2, 0, -0.55]),
    kind,
    swayAmp: rand(P.swayAmplitude[0], P.swayAmplitude[1]),
    swaySpeed: rand(P.swaySpeed[0], P.swaySpeed[1]),
    swayPhase: Math.random() * Math.PI * 2,
    flow: isFlow,
  };
}

/** لون الجسيم من درجة حرارته. */
function colorFor(temp: number): [number, number, number] {
  if (temp > 0.35) return temp > 0.75 ? PALETTE.warm : PALETTE.warm2;
  if (temp < -0.35) return temp < -0.75 ? PALETTE.cold : PALETTE.cold2;
  return PALETTE.neutral;
}

/** مفتاح السبرايت: لون × نعومة. */
function spriteKey(temp: number, soft: boolean) {
  const band = temp > 0.35 ? "w" : temp < -0.35 ? "c" : "n";
  return `${band}${soft ? "s" : "h"}`;
}

/**
 * تحضير سبرايتات دائرية بتدرّج شعاعي (حواف ناعمة بلا filter blur المكلف).
 * soft = هالة عريضة جداً (للبوكيه خارج بؤرة التركيز).
 */
export function buildSprites(): Map<string, HTMLCanvasElement> {
  const map = new Map<string, HTMLCanvasElement>();
  const temps = [1, 0, -1];
  for (const t of temps) {
    for (const soft of [false, true]) {
      const size = 64;
      const cv = document.createElement("canvas");
      cv.width = cv.height = size;
      const c = cv.getContext("2d");
      if (!c) continue;
      const [r, g, b] = colorFor(t);
      const grad = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      if (soft) {
        grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
        grad.addColorStop(0.45, `rgba(${r},${g},${b},0.22)`);
        grad.addColorStop(0.8, `rgba(${r},${g},${b},0.05)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      } else {
        grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
        grad.addColorStop(0.28, `rgba(${r},${g},${b},0.72)`);
        grad.addColorStop(0.65, `rgba(${r},${g},${b},0.14)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      }
      c.fillStyle = grad;
      c.fillRect(0, 0, size, size);
      map.set(spriteKey(t, soft), cv);
    }
  }
  return map;
}

export interface StepContext {
  w: number;
  h: number;
  dt: number; // ثوانٍ
  speed: number; // معامل السرعة العام (يقلّ مع reduced-motion)
  allowFlow: boolean;
  /** يرفع سطوع الجسيمات الباردة مؤقتاً (نجاح/نبضة). */
  coldBoost: number;
  intensity: number;
}

/** تحديث جسيم واحد؛ يُعاد توليده عند انتهاء عمره أو خروجه. */
export function stepParticle(p: Particle, ctx: StepContext) {
  const { w, h, dt, speed } = ctx;
  p.life += dt;

  // حركة مستقلّة + تذبذب جيبيّ خفيف
  const sway = Math.sin(p.swayPhase + p.life * p.swaySpeed) * p.swayAmp;
  const zSpeed = 0.55 + p.z * 0.75; // الأقرب أسرع قليلاً
  p.x += (p.vx * zSpeed + sway * 0.12) * speed * dt * 60;
  p.y += p.vy * zSpeed * speed * dt * 60;

  // تلاشٍ داخل/خارج عبر العمر (لا ظهور/اختفاء مفاجئ)
  const t = p.life / p.maxLife;
  const envelope = t < 0.18 ? t / 0.18 : t > 0.78 ? Math.max(0, (1 - t) / 0.22) : 1;

  const nx = p.x / w;
  const ny = p.y / h;
  // الإضاءة = ضوء أعلى-اليسار + التوهّج البيئي السفلي (كما في المرجع:
  // جسيمات النصف السفلي ساطعة أيضاً وليست مطفأة).
  const lowerGlow = Math.max(0, ny - 0.35) * 0.55;
  const illum = Math.min(1.15, 0.66 + illuminationAt(nx, ny) * 0.34 + lowerGlow);
  const base = AMBIENT_CONFIG.particles.alpha[p.kind];
  const cold = p.temperature < -0.35 ? ctx.coldBoost : 0;

  p.targetOpacity = Math.min(1, base * envelope * illum * ctx.intensity + cold * envelope * 0.25);
  p.opacity += (p.targetOpacity - p.opacity) * Math.min(1, dt * 3);

  // تدرّج حراري لجسيمات التدفّق: دافئ → محايد → بارد عبر الشاشة
  if (p.flow) p.temperature = 1 - nx * 2;

  const out = p.x < -60 || p.x > w + 60 || p.y < -60 || p.y > h + 60;
  if (p.life >= p.maxLife || out) Object.assign(p, createParticle(w, h, ctx.allowFlow));
}

export function drawParticle(
  c: CanvasRenderingContext2D,
  p: Particle,
  sprites: Map<string, HTMLCanvasElement>,
  offX: number,
  offY: number,
) {
  if (p.opacity <= 0.004) return;
  const soft = p.kind === "bokeh";
  const sprite = sprites.get(spriteKey(p.temperature, soft));
  if (!sprite) return;
  // العمق يزيد الإزاحة (parallax) وحجم الهالة
  const px = p.x + offX * (0.35 + p.z);
  const py = p.y + offY * (0.35 + p.z);
  const r = p.radius * (soft ? 3.2 : 2.4);
  c.globalAlpha = p.opacity;
  c.drawImage(sprite, px - r, py - r, r * 2, r * 2);
}
