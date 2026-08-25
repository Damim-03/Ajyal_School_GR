/**
 * التقدّمُ المعروض — **«الخطوة 4 من 15» لا «27٪»** (§43).
 *
 * والنسبةُ المئويةُ كانت ستكون كذبةً صغيرة: الخطواتُ ليست متساويةَ
 * الكلفة — «اللغة» ضغطةٌ و«المدير» نموذجٌ بستّة حقولٍ وسياسةِ كلمةِ
 * مرور. فرقمٌ يقول 27٪ يَعِد بما لا يفي به.
 *
 * والعدُّ يُقاس بما **أُتمّ** لا بموضع الخطوة في القائمة: من رجع
 * ليصحّح المنطقةَ لا يرى العدّادَ يقفز إلى الوراء ثمّ يقفز إلى الأمام
 * — التقدّمُ ما أُنجز، لا أينَ المؤشّر.
 */

import { useFirstBootStore } from "../store/firstBoot.store";
import { FIRST_BOOT_STEPS, type BootPhase } from "../types/firstBoot.types";

export interface BootProgress {
  /** رقمُ الخطوة المعروضة — من واحد */
  index: number;
  total: number;
  /** كم أُتمّ فعلاً — يقود الشريطَ الرفيع أعلى الشاشة */
  completed: number;
  /** هل للمرحلة الحالية عدّادٌ أصلاً؟ (الترحيبُ والإقلاعُ لا) */
  counted: boolean;
}

const isStep = (phase: BootPhase): boolean =>
  (FIRST_BOOT_STEPS as readonly string[]).includes(phase);

/**
 * **والمنتقياتُ تُرجع أعداداً لا كائناً.**
 *
 * وهذا ليس تفصيلاً في الأسلوب: zustand يقارن ما يُرجعه المنتقي
 * بمرجعه (`Object.is`)، وكائنٌ يُبنى في كلّ نداءٍ لا يساوي سابقَه
 * أبداً — فيرى المتجرُ تغيّراً في كلّ تصيير، فيُعيد التصيير، فيبني
 * كائناً جديداً. وهي حلقةٌ لا تقف: React يقطعها بـ«Maximum update
 * depth exceeded» ويسقط الشجرة.
 *
 * وقد وقع هذا فعلاً في المعاينة: الشاشةُ الأولى ظهرت، ثمّ سقطت
 * الشجرةُ كلُّها عند أوّل انتقال. فالتجميعُ هنا — بعد الاشتراك —
 * والمرجعُ الجديد لا يمرّ بالمقارنة أصلاً.
 */
export const useBootProgress = (): BootProgress => {
  const phase = useFirstBootStore((store) => store.phase);
  const completed = useFirstBootStore((store) => store.state?.done.length ?? 0);

  const total = FIRST_BOOT_STEPS.length;

  if (!isStep(phase)) return { index: 0, total, completed, counted: false };

  const index =
    FIRST_BOOT_STEPS.indexOf(phase as (typeof FIRST_BOOT_STEPS)[number]) + 1;

  return { index, total, completed, counted: true };
};
