import { motion, useReducedMotion } from "motion/react";
import { springs, geometry, reduced, delays } from "./tokens";
import { SHARED } from "../shared-id";
import { useMotionSpeed, scaleTransition, useRushing } from "../orchestrator";

/**
 * إطار تركيز واحد مشترك ينتقل بين العناصر بدل أن تملك كل بلاطة حدّها الخاص.
 *
 * `layoutId` يجعل motion يعامله كجسم واحد ينتقل: يستوفي x و y و العرض
 * والارتفاع والاستدارة دفعةً واحدة. تأخير 20ms يمنحه إحساساً فيزيائياً
 * بأنّه يتبع البلاطة — بلا أن ينفصل عنها بصرياً.
 *
 * يوضع داخل حاوية البلاطة المركَّزة (position: relative).
 */
export function FocusIndicator({
  size,
  /** يتغيّر عند كل وصول — يُعيد تشغيل توهّج الحافّة. */
  arrivalKey,
}: {
  /** مقاس البلاطة المركَّزة بالبكسل. */
  size: number;
  arrivalKey?: string | number;
}) {
  const still = useReducedMotion();
  const speed = useMotionSpeed();
  /* نفس مبدأ الانعكاس المسافر: توهّج الوصول زخرفةُ حدثٍ لا استجابةَ حالة. */
  const rushing = useRushing();
  const off = size * geometry.ringOffsetRatio;
  const radius = size * geometry.radiusRatio + off;

  return (
    <motion.span
      /* هويّة مشتركة مولَّدة لا سلسلة مكتوبة — راجع motion/shared-id.ts */
      layoutId={SHARED.focusRing}
      className="pointer-events-none absolute"
      style={{
        top: -off,
        bottom: -off,
        left: -off,
        right: -off,
        border: `${geometry.ringWidth}px solid ${geometry.ringColor}`,
        borderRadius: radius,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={scaleTransition(
        still ? reduced.transition : { ...springs.focus, delay: delays.focus },
        speed,
      )}
    >
      {/*
        توهّج الوصول.
        قِست المرجع أثناء تنقّل التركيز: سطوع الحافّة يهبط إلى 17 أثناء
        الحركة ثم يتسلّق إلى 73 خلال ~400ms عند الاستقرار — أي أنّ الحافّة
        لا تصل جاهزة، بل **تتوهّج داخلةً** على البلاطة الجديدة.

        `key` يُعيد تركيب هذه الطبقة وحدها عند كل وصول فتُعيد التوهّج،
        بينما يواصل الإطار الأمّ انتقاله عبر layoutId بلا انقطاع — فنجمع
        الأمرين: إطار واحد يسافر، وحافّة تتوهّج عند كل وصول.
      */}
      {/* لا يُعاد التوهّج في كل خطوة أثناء الاندفاع — يقع عند الوصول الأخير. */}
      {!still && !rushing && (
        <motion.span
          key={arrivalKey}
          className="absolute inset-0"
          style={{ borderRadius: "inherit", boxShadow: "0 0 0 1px rgba(255,255,255,0.9)" }}
          initial={{ opacity: 0.9, scale: 1.035 }}
          animate={{ opacity: 0, scale: 1 }}
          transition={scaleTransition({ duration: 0.4, ease: [0.22, 1, 0.36, 1] }, speed)}
        />
      )}
    </motion.span>
  );
}
