/**
 * الكاروسيل — نظامُ اختيارٍ مكانيّ لا شبكةُ بطاقات.
 *
 * الفرقُ ليس شكلياً: الشبكةُ تعرض الكلَّ متساوياً وتضع مؤشّراً على
 * واحد، والصفُّ المكانيّ **يُزحزح العالمَ** ليقف المختارُ في المركز.
 * الأوّلُ يقول «هذا محدَّد»، والثاني يقول «أنت هنا» — وهي لغةُ واجهات
 * الأجهزة.
 *
 * والانزلاقُ بنابضٍ لا بمدّة: الحركةُ تحمل زخماً فتصل حاسمةً ثمّ تستقرّ
 * مغناطيسياً. ونوابضُ التطبيق مضبوطةٌ بالقياس في `MOTION.spring`، فلا
 * أخترع فيزياء ثانية لهذه الشاشة.
 */

import { motion } from "motion/react";

import { MOTION } from "../../motion/system";
import { AddUserItem } from "./AddUserItem";
import { UserItem } from "./UserItem";
import type { Slot } from "./types";

export function UserCarousel({
  slots,
  index,
  avatarSize,
  addLabel,
  onPick,
}: {
  slots: Slot[];
  index: number;
  avatarSize: number;
  addLabel: string;
  onPick: (at: number) => void;
}) {
  /*
   * عرضُ البطاقة في التخطيط — والمقياسُ تحويلٌ بصريّ لا يمسّه.
   *
   * وُسّع 1.35 ← 1.9: الاسمُ الكامل («System Administrator») كان يُقصّ
   * بثلاث نقاطٍ في عرضٍ لا يتجاوز مئةً وأربعةً وعشرين بكسلاً، فيصير
   * التعرّفُ على الحساب تخميناً. والفرجةُ بين البطاقات تحفظ الفصلَ
   * بينها، فالعرضُ الزائد يذهب إلى النصّ لا إلى التزاحم.
   */
  const itemWidth = avatarSize * 1.9;
  /* خطوةُ الخانة — العرضُ ومعه الفرجة، ومنها تُحسب الإزاحة */
  const step = itemWidth + 28;

  return (
    /*
      `dir="ltr"` على المسار — **وهو تصحيحُ عطبٍ لا خيارُ ذوق.**

      المستندُ عربيٌّ (`body` اتّجاهُه rtl)، فالصفُّ المرن كان يُرتَّب
      يميناً→يساراً بينما الإزاحةُ `x = −index·step` تدفع يساراً: أي أنّ
      العنصرَ المختار كان يبتعد عن المركز بدل أن يقترب منه، وينحرف
      الصفُّ كلَّما زاد عددُه. فيُثبَّت للمسار نظامُ إحداثياتٍ خاصٌّ به
      لا يتبع اتجاه النصّ — والتخطيطُ المكانيّ ليس نصّاً يُقرأ.

      والنصوصُ داخل البطاقات تبقى عربيةً كما هي: كلُّ عنوانٍ مقطعٌ
      مستقلٌّ يرسمه المحرّك باتجاهه الطبيعي.
    */
    <div dir="ltr" className="relative w-full overflow-hidden">
      {/*
        قناعٌ يذيب الطرفين.
        الصفُّ يمتدّ خارج الشاشة، وقطعُه بحافّةٍ صريحة يكشف أنّه عنصرٌ
        مقصوص. والتلاشيُ يجعله يغيب في الظلام كأنّ الفضاء يمتدّ خلفه.
      */}
      <div
        className="w-full"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%)",
        }}
      >
        <motion.div
          className="flex items-start"
          /*
            الإزاحةُ تضع المختارَ في المركز: نصفُ العرض ناقصَ موضعه.
            و`left: 50%` مع `translateX(-50%)` على الخانة الأولى كان
            سيحتاج قياساً بعد الرسم — والحسابُ من الخطوة الثابتة يغني
            عنه ويعمل قبل أوّل إطار.
          */
          animate={{ x: -index * step }}
          transition={MOTION.spring.navigation}
          style={{
            gap: 28,
            /*
              فرجةٌ رأسيةٌ تسع التمدّد.
              الغلافُ `overflow-hidden` ليُقصّ الصفُّ أفقياً، لكنّ القصَّ
              يقع على المحورين معاً — فكان العنصرُ المختار (×1.14) يتجاوز
              ارتفاعَ الصفّ فتُبتَر الصورةُ من أعلى وأسفل ويُقطع اسمُها.
              والحشوةُ تعطي المدى الذي يتمدّد فيه بلا أن يبلغ الحافّة.
            */
            paddingBlock: avatarSize * 0.34,
            /*
              الحشوةُ نصفُ **عرض البطاقة** لا نصفُ الخطوة.
              الخطوةُ تشمل الفرجة، فطرحُ نصفها كان يزيح الصفَّ بنصف
              الفرجة (14px) — انحرافٌ لا يُرى بالعين وحدها لكنّه يظهر
              في القياس: مركزُ المختار 509 ومركزُ الشاشة 523.
            */
            paddingInline: `calc(50% - ${itemWidth / 2}px)`,
          }}
        >
          {slots.map((slot, at) => {
            const distance = Math.abs(at - index);
            const focused = at === index;

            return slot.kind === "add" ? (
              <AddUserItem
                key="add"
                distance={distance}
                focused={focused}
                size={avatarSize}
                label={addLabel}
                onActivate={() => onPick(at)}
              />
            ) : (
              <UserItem
                key={slot.profile.id}
                profile={slot.profile}
                distance={distance}
                focused={focused}
                size={avatarSize}
                onActivate={() => onPick(at)}
              />
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
