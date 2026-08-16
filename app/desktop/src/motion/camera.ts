import { createContext, useContext } from "react";
import { useMotionValue, useTransform, useReducedMotion, type MotionValue } from "motion/react";

/**
 * الكاميرا الافتراضية — الرموز والسياق والخطّافات.
 * المكوّن نفسه في CameraProvider.tsx (فصلٌ مطلوب: تصدير مكوّن وغير مكوّنات
 * من ملف واحد يُعطّل Fast Refresh).
 *
 * الفكرة التي تفصل بيئة تشغيل عن موقع ويب: المستخدم يجب أن يشعر
 * **«أنا تحرّكت»** لا «الزرّ تحرّك». تُحقَّق بإزاحة كل الطبقات معاً بمقدار
 * ضئيل وبسرعات متفاوتة حسب عمقها — فيولد التجسيم من فروق السرعة لا من
 * منظور ثلاثي الأبعاد.
 *
 * الحدّ 10px مطلقاً. ما فوقه يصير حركة كاميرا واعية، وهو ما يجب تجنّبه:
 * الإحساس يبقى تحت عتبة الانتباه أو لا يكون.
 */

/** عمق الطبقة: 0 = أبعد (لا يكاد يتحرّك)، 1 = أقرب (أسرع استجابة). */
export const LAYER_DEPTH = {
  background: 0.15,
  fog: 0.3,
  lighting: 0.45,
  content: 0.6,
  navigation: 0.85,
  focus: 1,
} as const;

/** عمق التوازي — مفهوم غير الترتيب البصري في layers.ts (ذاك z، هذا سرعة). */
export type DepthLayer = keyof typeof LAYER_DEPTH;

/**
 * أقصى إزاحة للطبقة الأقرب (px). ما دونها يُقاس بنسبة عمقه.
 * 10 لا 12: الحدّ شُدّد في مراجعة الصقل النهائية. ما فوق ذلك يبدأ
 * بالانتقال من «عمق غير محسوس» إلى «حركة كاميرا واعية».
 */
export const CAMERA_RANGE = 10;
/** الرأسي أضعف: الحركة العمودية أوضح للعين. */
export const VERTICAL_DAMPING = 0.6;
/** نابض متراخٍ: الكاميرا تتبع المؤشّر ولا تلتصق به. */
export const CAMERA_SPRING = { stiffness: 90, damping: 22, mass: 1.1 } as const;
/** مدّة السكون قبل اعتبار المستخدم خاملاً. */
export const IDLE_AFTER_MS = 15_000;

/**
 * دفعة التنقّل (§CAMERA DIRECTION): عند تحرّك التركيز تميل الكاميرا قليلاً
 * في اتجاهه ثم تعود. هذا ما يمنح الإحساس بأن **المشهد** استجاب لا العنصر.
 * تُطبَّق على البيئة وحدها — الواجهة تبقى ساكنة كما في المرجع.
 */
export const NUDGE_PX = 5;
/** تكبير مصاحب دقيق: 1 ← 1.008 ثم عودة — الحدّ الأعلى المسموح. */
export const NUDGE_ZOOM = 1.008;
/** مدّة بقاء الدفعة قبل ارتدادها إلى الصفر. */
export const NUDGE_HOLD_MS = 260;

export interface CameraCtx {
  x: MotionValue<number>;
  y: MotionValue<number>;
  /** تكبير المشهد — يستهلكه غلاف الخلفية وحده. */
  zoom: MotionValue<number>;
  /** true بعد سكون كامل — تستعمله البيئة لتهدأ أكثر. */
  idle: boolean;
  /** يُستدعى عند تنقّل التركيز: +1 للأمام، -1 للخلف. */
  nudge: (direction: number) => void;
}

export const CameraContext = createContext<CameraCtx | null>(null);

/** true حين يسكن المستخدم — الواجهة تهدأ والبيئة وحدها تبقى حيّة. */
export function useIdle(): boolean {
  return useContext(CameraContext)?.idle ?? false;
}

/**
 * إزاحة طبقة بعينها، تُمرَّر مباشرة إلى `style` في motion.div.
 * الطبقات البعيدة تتحرّك أقلّ — وهذا كل سرّ التجسيم.
 *
 * تنبيه: لا تضعها على عنصر يحمل حركة CSS تكتب `transform` — حركة CSS
 * تتغلّب على النمط السطري فيُلغى التوازي صامتاً. افصل الطبقتين.
 */
export function useCameraLayer(layer: DepthLayer) {
  const ctx = useContext(CameraContext);
  const still = useReducedMotion();
  const fallback = useMotionValue(0);
  const sx = ctx?.x ?? fallback;
  const sy = ctx?.y ?? fallback;
  const amp = still || !ctx ? 0 : CAMERA_RANGE * LAYER_DEPTH[layer];
  const x = useTransform(sx, (v) => v * amp);
  const y = useTransform(sy, (v) => v * amp * VERTICAL_DAMPING);
  return { x, y };
}

/**
 * تكبير المشهد المصاحب للتنقّل. يُستهلك في `style.scale` لغلاف الخلفية.
 * لا يُطبَّق على الواجهة إطلاقاً — تكبير النصّ يجعله يهتزّ عند إعادة الرسم.
 */
export function useCameraZoom(): MotionValue<number> {
  const ctx = useContext(CameraContext);
  const fallback = useMotionValue(1);
  return ctx?.zoom ?? fallback;
}

/**
 * دفعة اتجاهية عند تنقّل التركيز. تُستدعى من الشاشات التي فيها تنقّل مكاني.
 * آمنة بلا مزوّد (تصير عملية فارغة).
 */
export function useCameraNudge(): (direction: number) => void {
  return useContext(CameraContext)?.nudge ?? (() => {});
}

/** رموز الكاميرا — موثَّقة للتنقيح والضبط. */
export const cameraTokens = {
  range: CAMERA_RANGE,
  verticalDamping: VERTICAL_DAMPING,
  spring: CAMERA_SPRING,
  depth: LAYER_DEPTH,
  idleAfterMs: IDLE_AFTER_MS,
  nudgePx: NUDGE_PX,
  nudgeZoom: NUDGE_ZOOM,
  nudgeHoldMs: NUDGE_HOLD_MS,
} as const;
