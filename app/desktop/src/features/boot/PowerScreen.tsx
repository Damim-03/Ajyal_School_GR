import { useEffect } from "react";

import nexschoolLogo from "../../assets/nexschool/nexschool.png";
import { LAYER } from "../../motion/layers";
import { closeApp, restartApp } from "../../lib/app-window";
import { sfx, stopAmbient } from "../../lib/sound";
import { usePower, type PowerAction } from "../../core/system/power";
import { BootStage } from "./engine/BootStage";

/**
 * **شاشةُ الإطفاء — اللحظةُ التي كانت مفقودة بين الضغطة والاختفاء.**
 *
 * كان زرُّ الطاقة يُغلق النافذةَ في الإطار الذي يُضغط فيه: تختفي الصورةُ
 * فجأةً، فلا يُعرف أوقع الإغلاقُ أم انهار البرنامج. وهذا الفرقُ — بين
 * **نظامٍ يُطفأ** و**نافذةٍ تُقفل** — هو كلُّ ما تشتريه هذه الشاشة.
 *
 * وثلاثةُ أشياء تجعلها تُقرأ إطفاءً:
 *
 *   ① **الشعار** — البرنامجُ يسمّي نفسَه آخرَ ما يُرى كما سمّاها أوّلَ
 *     ما رُئي. فتُغلق الجلسةُ بالعلامة التي فُتحت بها.
 *
 *   ② **الفضاءُ نفسُه لا خلفيةٌ أخرى.** تُركَّب `BootStage` مستقرّةً،
 *     فيبقى الحقلُ الأزرقُ الخافتُ حيّاً تحت الشعار. ولو وُضع سوادٌ
 *     مسطّح لقُرئ انقطاعاً لا انصرافاً.
 *
 *   ③ **سطرٌ يقول ما يجري وما لا يُفعل.** «لا تفصل الطاقة» ليست زخرفة:
 *     الخادمُ قد يكون على هذا الجهاز نفسِه، وقطعُ الكهرباء أثناء كتابةٍ
 *     في القاعدة يُفسدها.
 *
 * ## والتنفيذُ بعد أن تُرسم لا قبلها
 *
 * المهلةُ ليست تجميلاً: `closeApp` تُنهي النافذة، فلو نوديت مع التركيب
 * لَما رُسم إطارٌ واحدٌ من هذه الشاشة. فتُترك مهلةٌ تكفي لأن تُرى
 * وتُقرأ، ثمّ يقع الفعل.
 */

/** ما يكفي لتُرسم الشاشةُ وتُقرأ — ولا يُشعر بالانتظار. */
const HOLD_MS = 1750;

const COPY: Record<PowerAction, { title: string; note: string }> = {
  restart: {
    title: "جارٍ إعادة تشغيل NexSchool…",
    note: "لا تفصل الطاقةَ عن الجهاز. سيعود البرنامجُ بعد لحظات.",
  },
  off: {
    title: "جارٍ إغلاق NexSchool…",
    note: "لا تفصل الطاقةَ عن الجهاز حتى يكتمل الإغلاق.",
  },
};

export function PowerScreen() {
  const action = usePower((s) => s.action);

  useEffect(() => {
    if (!action) return;

    /*
     * الصوتُ ينسحب مع الصورة.
     *
     * ونغمةُ الإطفاء تُطلب مرّةً، والموسيقى تتلاشى على مدّة المكوث
     * نفسِها — فيسكت المكانُ ويُظلم معاً، لا أحدهما قبل الآخر.
     */
    sfx("logout", 0.9, true);
    stopAmbient(HOLD_MS);

    const timer = window.setTimeout(() => {
      if (action === "restart") restartApp();
      else void closeApp();
    }, HOLD_MS);

    return () => window.clearTimeout(timer);
  }, [action]);

  if (!action) return null;

  const copy = COPY[action];

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-[#04060c] text-white"
      style={{
        /*
          فوق شاشة الإقلاع وفوق الإشعارات: لا شيء يعلو إطفاءً جارياً،
          ولا خبرَ يستحقّ أن يُقرأ بعد أن قرّر المستخدمُ أن يغادر.
        */
        zIndex: LAYER.debug - 1,
        animation: "skk-power-in 420ms cubic-bezier(0.33,0,0.2,1) both",
      }}
      role="status"
      aria-live="polite"
    >
      {/* الفضاءُ نفسُه — مستقرّاً، فلا يبدأ مشهدٌ جديدٌ عند المغادرة. */}
      <BootStage settled />

      <div className="relative flex h-full flex-col items-center justify-center gap-7 px-8">
        <img
          src={nexschoolLogo}
          alt=""
          aria-hidden
          draggable={false}
          className="select-none"
          style={{
            height: "clamp(150px, 22vh, 260px)",
            width: "auto",
            /* اقترابٌ بطيءٌ جدّاً — المشهدُ حيٌّ وإن كان يُغلق. */
            animation: "skk-power-logo 900ms cubic-bezier(0.16,1,0.3,1) both",
          }}
        />

        <div className="flex flex-col items-center gap-2.5 text-center">
          <h1 className="text-xl font-light tracking-wide text-white/90">
            {copy.title}
          </h1>

          <p className="max-w-md text-[13px] leading-relaxed text-white/45">
            {copy.note}
          </p>
        </div>

        {/*
          نبضةٌ لا شريطُ تقدّم: لا نعرف كم يبقى، وشريطٌ يتحرّك بلا قياسٍ
          حقيقيّ يَعِد بما لا يملك.
        */}
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-white/60"
          style={{ animation: "skk-ring-pulse 1.6s ease-in-out infinite" }}
        />
      </div>
    </div>
  );
}
