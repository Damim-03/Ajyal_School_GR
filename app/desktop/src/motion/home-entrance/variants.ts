import type { Transition, TargetAndTransition } from "motion/react";

import { ringDistance } from "../energy";
import { curve, icon, reduced, settle, spatialY } from "./tokens";

/**
 * أشكالُ الدخول — تُشتقّ هنا ولا تُكتب في الرئيسية.
 *
 * السببُ ليس ترتيباً: البلاطةُ الواحدة تحمل أربع قنواتٍ متزامنة
 * (شفافية، إزاحة، مقياس، تمويه) وثلاثةَ مصادرَ تقرّرها (مرحلةُ الدخول،
 * ومسافتُها عن المركَّزة، وتفضيلُ تقليل الحركة). كتابةُ ذلك داخل JSX
 * تُخرج تعبيراً شرطياً من أربعة مستويات لا يقرؤه أحد — وأوّلُ ضبطٍ
 * للإيقاع يصير تعديلاً في تسعة أسطرَ متشابهة.
 */

/*
 * مراجعُ ثابتةٌ على مستوى الوحدة.
 *
 * ليست تحسيناً: `motion` يقارن هدفَ الحركة بالذي قبله ليقرّر إعادةَ
 * التشغيل، ومصفوفةٌ تُبنى في كلّ عرضٍ تصل إليه **جديدةً في كلّ مرّة**.
 * فكانت لقطاتُ المقياس تُستأنف من أوّلها كلّما تغيّرت حالةٌ أخرى في
 * الرئيسية (الساعةُ وحدها تُعيد العرضَ كلَّ ثانية) — أي بلاطةٌ تنبض بلا
 * سبب. البناءُ مرّةً واحدة هنا يقطع ذلك من أصله.
 */
const SETTLE_SCALE = [...settle.scale];
const SETTLE_TIMES = [...settle.times];

export interface TileEntranceInput {
  index: number;
  /** البلاطةُ التي يستقرّ عليها الانتباه. */
  focused: number;
  count: number;
  /** بلغ الصفُّ مرحلةَ التجميع. */
  assembled: boolean;
  /** انتهى الدخولُ كلُّه — تُسلَّم القنوات إلى حقل الطاقة. */
  done: boolean;
  /** الشفافيةُ المطلوبة عند السكون (‏1، أو خفوتُ الجيران عند الامتداد). */
  restOpacity: number;
  still: boolean;
}

export interface TileEntrance {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  transition: Transition;
  /**
   * التمويهُ وحده — **بانتقال CSS لا بـ`motion`**، ويُدمج في `style`.
   *
   * والسببُ مقيسٌ لا مذهبي. كان التمويهُ ضمن هدف `motion`، ويُسقَط
   * المفتاحُ عند الاستقرار وتُكتب `filter: "none"` في `style`. فقِستُ
   * النتيجة: البلاطاتُ الثماني تبقى عند `blur(0px)` — لا `none`. ثمّ
   * محوتُها من DOM يدوياً فعادت بعد أوّل تنقّلٍ بسهم.
   *
   * والعلّةُ أنّ `motion` يحتفظ بآخر قيمةٍ حرّكها في `latestValues`
   * ويُعيد كتابتها فوق `style` في كلّ عرضٍ تالٍ. فما دام قد ملك
   * `filter` مرّةً، لا يتخلّى عنه أبداً — و`style` لا تغلبه.
   *
   * و`blur(0px)` ليس مجّانياً: مرشّحٌ هويّةٌ يبقى مرشّحاً، يفرض طبقةً
   * مركَّبةً على تسع بلاطاتٍ إلى الأبد. وهو عينُ ما أسقطته ملاحظةُ
   * `energy.ts` من قبل.
   *
   * فالحلُّ ألّا يملكه `motion` أصلاً: القيمةُ في `style` وحدها،
   * والانتقالُ من CSS. فحين تصير `undefined` تُرفع الخاصّيةُ من العنصر
   * رفعاً — ولا شيء يُعيدها.
   */
  style: { filter?: string; transition?: string };
}

/**
 * دخولُ بلاطةٍ واحدة (§8 → §17).
 *
 * ثلاثُ قراراتٍ تُتّخذ هنا:
 *
 * ① **التتابعُ بالمسافة عن المركَّزة لا بترتيب القراءة.** الصفُّ بنيةٌ
 *    لها مركز، لا قائمةٌ تُقرأ من طرفها. والمركَّزةُ تصل أوّلاً لأنّها
 *    الوجهةُ التي سيقف عندها المستخدم — فتُقرأ البنيةُ وقد نشأت **حول**
 *    نقطةِ انتباهه، لا وقد زحفت إليها.
 *
 * ② **المركَّزةُ لا تُموَّه.** هي مستوى البؤرة؛ تمويهُها ثمّ إحداده
 *    يجعل نقطةَ الارتكاز نفسَها غيرَ مستقرّة. الجيرانُ يحدّون تدريجياً
 *    فيُقرأ المشهدُ **يقع في البؤرة**، وهو معنى «الوضوح يأتي» لا
 *    «التمويه يزول».
 *
 * ③ **المركَّزةُ وحدها تستقرّ بلقطات.** 0.965 ← 0.998 ← 1 — رحلةٌ لها
 *    نهايةٌ محسوسة. والبقيّةُ تصل بمنحنىً واحد: لو استقرّ الجميعُ
 *    بالطريقة نفسِها لضاع ما يميّز الوجهة.
 */
export function tileEntrance({
  index, focused, count, assembled, done, restOpacity, still,
}: TileEntranceInput): TileEntrance {
  const isCenter = index === focused;
  const ring = ringDistance(index, focused, count);
  const from = still ? reduced.from : icon.from;

  /* بعد الاكتمال: القنواتُ للسكون وحده، و`style` خالية فيُرفع المرشّح. */
  if (done) {
    return {
      initial: { opacity: from.opacity },
      animate: { opacity: restOpacity, y: 0, scale: 1 },
      transition: { duration: icon.duration, ease: curve.enter },
      style: {},
    };
  }

  const blur = still || isCenter ? 0 : from.blur;
  /* التتابعُ بالمسافة عن المركَّزة — تُحسب مرّةً ويقرؤها المقياسُ والجذر. */
  const delay = assembled && !still ? (ring * icon.stagger) / 1000 : 0;

  return {
    initial: {
      opacity: from.opacity,
      y: still ? 0 : spatialY(index),
      scale: isCenter ? settle.scale[0] : from.scale,
    },
    animate: {
      opacity: assembled ? restOpacity : from.opacity,
      y: assembled ? icon.to.y : still ? 0 : spatialY(index),
      scale: assembled
        ? isCenter
          ? SETTLE_SCALE
          : icon.to.scale
        : isCenter
          ? settle.scale[0]
          : from.scale,
    },
    /*
     * التمويهُ يسير بالتوقيت نفسِه الذي تسير به بقيّةُ القنوات — المدّةُ
     * والتأخيرُ والمنحنى كلُّها مشتقّةٌ من المصدر ذاته أدناه. فتبدّلُ
     * المحرّك (‏CSS بدل motion) لا يعني تبدّلَ الإيقاع: الرمزُ يحدّ وهو
     * يصعد ويتّضح، لا بعده ولا قبله.
     */
    style: blur === 0
      ? /* المركَّزةُ ومسارُ «تقليل الحركة»: لا مرشّحَ يُكتب أصلاً. */ {}
      : {
          filter: `blur(${assembled ? icon.to.blur : blur}px)`,
          transition:
            `filter ${icon.duration}s cubic-bezier(${curve.enter.join(",")}) ${delay}s`,
        },
    transition: {
      duration: isCenter && !still ? settle.duration : still ? reduced.duration : icon.duration,
      /* التأخيرُ يخصّ **الوصول** وحده؛ لا يُطبَّق على حالةٍ لم تبدأ بعد. */
      delay,
      ease: isCenter ? curve.settle : curve.enter,
      /*
       * **اللقطاتُ تخصّ المقياسَ وحده — ولا يجوز أن تُكتب في جذر
       * الانتقال.**
       *
       * كُتبت هناك أوّلاً، فقِستُ النتيجة على البلاطة المركَّزة فوجدتها
       * تنطفئ في منتصف دخولها: 0.94 ← 0.71 ← 0.54 ← 0.41 ← 0.05 ← 0،
       * ثمّ تقفز إلى 1 بعد 300ms. أي أنّ الوجهةَ — وهي أهمّ ما في المشهد
       * — تومض وتغيب بينما يدخل جيرانُها بانتظام.
       *
       * والسببُ أنّ `times` في جذر الانتقال يسري على **كلّ** خاصّية
       * متحرّكة، لا على الوحيدة التي لها لقطات. فورثته الشفافيةُ ولها
       * محطّتان فقط، فطُبّق عليها جدولُ ثلاثِ محطّات — ومن هذا التنافر
       * وُلد الانحدارُ العكسي.
       *
       * فصارت للمقياس فقرتُه الخاصّة، ولا يبلغ `times` سواه.
       */
      ...(isCenter && !still && assembled
        ? { scale: { duration: settle.duration, ease: curve.settle, delay, times: SETTLE_TIMES } }
        : {}),
    },
  };
}
