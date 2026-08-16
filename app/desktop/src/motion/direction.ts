import { useEffect, useState } from "react";

/**
 * نموذج الاتجاه الدلالي (§48/§49).
 *
 * المشكلة التي يحلّها: كان مكتوباً في الرئيسية `ArrowLeft → step(+1)` مع
 * تعليق «RTL: اليسار = التالي». هذا صحيح اليوم فقط لأن `index.html` يثبّت
 * `dir="rtl"`. والمشروع يحمل ترجمة فرنسية جاهزة (i18n/locales/fr) — أي أن
 * قلب الاتجاه مسألة وقت، وحينها ينعكس التنقّل كلّه ويصير السهم الأيسر
 * يرجع بدل أن يتقدّم، بلا أي رسالة خطأ تدلّ على السبب.
 *
 * الحلّ: الشيفرة تتكلّم بالدلالة — **التالي** و**السابق** — والترجمة إلى
 * يمين/يسار تحدث في مكان واحد يقرأ اتجاه المستند فعلياً.
 *
 * لا يُفترض الاتجاه ولا يُخزَّن: يُقرأ من `document.documentElement.dir`
 * ويُراقَب تغيّره، فتبديل اللغة يُصلح التنقّل فوراً بلا إعادة تحميل.
 */

export type LayoutDirection = "rtl" | "ltr";

/** الاتجاه الدلالي: ‎+1 يتقدّم في الصفّ، ‎-1 يرجع. */
export type Step = 1 | -1;

export function readDirection(): LayoutDirection {
  return document.documentElement.dir === "ltr" ? "ltr" : "rtl";
}

/** اتجاه المستند، متتبَّعاً حيّاً — تبديل اللغة يُحدِّثه بلا إعادة تحميل. */
export function useLayoutDirection(): LayoutDirection {
  const [dir, setDir] = useState<LayoutDirection>(readDirection);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDir((d) => (d === readDirection() ? d : readDirection()));
    const mo = new MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ["dir"] });
    sync();
    return () => mo.disconnect();
  }, []);
  return dir;
}

/**
 * يترجم سهم لوحة المفاتيح إلى خطوة دلالية.
 * في RTL: اليسار يتقدّم. في LTR: اليمين يتقدّم.
 * يُعيد `null` لأي مفتاح آخر، فلا يبتلع المُستدعي مفاتيح لا تخصّه.
 */
export function arrowToStep(key: string, dir: LayoutDirection): Step | null {
  const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
  const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
  if (key === forward) return 1;
  if (key === back) return -1;
  return null;
}

/**
 * إشارة الإزاحة الفيزيائية لخطوة دلالية.
 * الصفّ في RTL ينزلق يميناً كي تتقدّم البلاطة، وفي LTR يساراً.
 */
export const physicalSign = (dir: LayoutDirection): Step => (dir === "rtl" ? 1 : -1);

/**
 * عجلة الفأرة لا تنعكس مع الاتجاه: الدوران للأسفل يعني «تقدّم» في كلّ
 * تخطيط، لأنّه إيماءة على محور رأسي لا علاقة له باتجاه القراءة.
 */
export const wheelToStep = (delta: number): Step => (delta > 0 ? 1 : -1);
