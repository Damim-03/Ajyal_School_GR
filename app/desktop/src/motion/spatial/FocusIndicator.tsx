import { motion, useReducedMotion } from "motion/react";
import { geometry, focusFrame, reduced } from "./tokens";
import { useMotionSpeed, scaleTransition, useRushing } from "../orchestrator";
import type { FocusFrameStage } from "../home-entrance";

/**
 * **إطارُ التركيز — نافذةٌ ثابتةٌ في الفضاء، تتكثّف على ثلاث خطوات.**
 *
 * ما كان: `<FocusIndicator>` يُركَّب **داخل** غلاف البلاطة المركَّزة
 * وينتقل بينها بـ`layoutId` — أي أنّ الإطار يملكه العنصر، فيسافر عبر
 * الشاشة. وذلك هو ما يجعل التجربة تُقرأ «مربّعٌ أبيض يتحرّك بين
 * الأيقونات» بدل «المربّع ثابت، والأيقونات تأتي إليه».
 *
 * وهو الآن ابنٌ للعارض، موضعُه `geometry.focusAnchor`، ولا يُكتب له أيّ
 * انتقالٍ على الموضع أو المقاس. ما يتحرّك هو الصفُّ تحته.
 *
 * ## ثلاثُ طبقاتٍ لا واحدة — والترتيبُ هو المعنى
 *
 * المرجعُ البصريّ يفصلها في ثلاث لحظاتٍ مقيسة:
 *
 *   `"glow"`  ‏0.10s — وهجٌ خارجيٌّ ناعم وحده. «هنا شيء»، بلا شكل.
 *   `"plate"` ‏0.20s — السطحُ الزجاجيّ يتشكّل. صار للمكان سُمك.
 *   `"rim"`   ‏0.33s — الحدُّ الأبيض الرفيع. صار له تعريف.
 *
 * وطبقاتٌ ثلاثٌ لا خاصّياتٌ ثلاثٌ على عنصرٍ واحد، لسببين:
 *
 *   ① **الشفافيةُ لا تُجزَّأ.** لو اجتمعت الثلاثُ في عنصرٍ واحد لَما
 *     أمكن أن يظهر الوهجُ وحده ثمّ ينضمّ إليه الزجاج — تُستوفى شفافيةُ
 *     العنصر فيظهر كلُّ ما فيه معاً. و`backdrop-filter` بالذات لا
 *     يُستوفى أصلاً.
 *
 *   ② **العمقان.** «اللوح» (وهجٌ وزجاج) يقع **تحت** الصفّ، و«الحافّة»
 *     **فوقه**. ولو اجتمعا فوق البلاطة لموّه التمويهُ الخلفيّ رمزَها
 *     وغسل مادّتها؛ ولو اجتمعا تحتها لاختفى الحدُّ المعرِّف. فالزجاجُ
 *     خلفها والحدُّ أمامها: تُرى البلاطةُ حادّةً داخل إطارٍ مضيء.
 *
 * وهو زخرفيٌّ بحت (§36): `pointer-events: none` و`aria-hidden`. الدلالةُ
 * يحملها `aria-current` على البلاطة نفسها.
 */
export function FocusIndicator({
  size,
  layer,
  stage,
  arrivalKey,
}: {
  /** مقاس البلاطة عند اكتمال التركيز (px) — منه تُشتقّ الاستدارة. */
  size: number;
  /** أيُّ طبقةٍ من الثلاث. */
  layer: "glow" | "plate" | "rim";
  /** أين بلغ بناءُ الإطار — يقرّر أيُّ الطبقات حاضرة. */
  stage: FocusFrameStage;
  /** يتغيّر عند كل وصول — يُعيد تشغيل وميض الحافّة. */
  arrivalKey?: string | number;
}) {
  const still = useReducedMotion();
  const speed = useMotionSpeed();
  /* الوميضُ زخرفةُ حدثٍ لا استجابةُ حالة — يسقط أثناء الاندفاع. */
  const rushing = useRushing();

  /*
   * **الصندوقُ يملكه الأب، وهذه الطبقةُ تملؤه.**
   *
   * `inset-0` لا عرضٌ وارتفاع: الموضعُ والمقاسُ قرارُ العارض (هو الذي
   * يعرف المرساة وحشوَه)، وهذه الطبقة لا تعرف أين هي ولا يجب أن تعرف.
   * وهو أيضاً ما يمنع أن يتسلّل انتقالٌ على الموضع من هنا.
   */
  const radius = size * geometry.radiusRatio + size * geometry.ringOffsetRatio;

  /** كلُّ طبقةٍ تنتظر خطوتَها ثمّ تبقى — البناءُ يتراكم ولا يتبادل. */
  const visible =
    layer === "glow"
      ? stage !== "hidden"
      : layer === "plate"
        ? stage === "plate" || stage === "rim"
        : stage === "rim";

  /** الشفافيةُ وحدها هي المتحرّكة — لا موضعَ ولا مقاسَ ولا `layout`. */
  const fade = scaleTransition(
    still
      ? reduced.transition
      : { duration: focusFrame.buildDuration, ease: [0.33, 1, 0.68, 1] },
    speed,
  );

  if (layer === "glow") {
    return (
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ borderRadius: radius, boxShadow: focusFrame.glowShadow }}
        initial={false}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={fade}
      />
    );
  }

  if (layer === "plate") {
    return (
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: radius,
          background: focusFrame.plateFill,
          backdropFilter: `blur(${focusFrame.plateBlur}px)`,
          WebkitBackdropFilter: `blur(${focusFrame.plateBlur}px)`,
        }}
        initial={false}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={fade}
      />
    );
  }

  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        borderRadius: radius,
        border: `${focusFrame.rimWidth}px solid ${focusFrame.rimColor}`,
        boxShadow: focusFrame.rimInner,
      }}
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={fade}
    >
      {/*
        وميضُ الوصول.

        قِيس على المرجع أنّ سطوع الحافّة يهبط أثناء الحركة ثم يتسلّق عند
        الاستقرار — أي أنّ الحافّة **تعترف بما وصلها**. وهي هنا ثابتة، فلم
        يبقَ لها إلّا هذا: نبضةٌ تُعيد تركيب نفسها عند كل وصول.

        ولا تقع أثناء الاندفاع: من يمسك السهم يمرّ بستّ بلاطات في الثانية،
        ووميضٌ عند كلٍّ منها ضجيجٌ لا اعتراف.
      */}
      {visible && !still && !rushing && (
        <motion.span
          key={arrivalKey}
          className="absolute inset-0"
          style={{ borderRadius: "inherit", boxShadow: "0 0 0 1px rgba(255,255,255,0.9)" }}
          initial={{ opacity: focusFrame.arrival.opacity, scale: focusFrame.arrival.scale }}
          animate={{ opacity: 0, scale: 1 }}
          transition={scaleTransition(
            { duration: focusFrame.arrival.duration, ease: [0.22, 1, 0.36, 1] },
            speed,
          )}
        />
      )}
    </motion.span>
  );
}
