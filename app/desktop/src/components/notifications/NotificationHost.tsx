/**
 * طبقةُ الإشعارات — بطاقةُ الجهاز، لا شريطُ الويب.
 *
 * كانت بطاقةً داكنةً في وسط الأعلى بشريطٍ ملوّنٍ في جنبها — لغةٌ صحيحة،
 * لكنّها لغةُ **لوحةِ تحكّم**. وهذا التطبيقُ يتقمّص جهازاً منذ شاشة
 * إقلاعه، والإشعارُ في الأجهزة شيءٌ آخر: **قرصٌ فاتحٌ مصنفر** ينزلق من
 * حافّة الشاشة العليا، فيه صورةُ المُرسِل ونصٌّ في سطرين وختمُ النظام.
 *
 * وأربعةُ فروقٍ تصنع ذلك:
 *
 * **① فاتحٌ على داكن.** الواجهةُ كلُّها سوداء، فبطاقةٌ داكنةٌ تذوب فيها
 *    وتحتاج حدّاً وظلّاً ليُرى شكلُها. والقرصُ الفاتحُ يُرى بمادّته
 *    نفسِها — ولذلك لا يحتاج لوناً صارخاً ليلفت.
 *
 * **② الزجاجُ يُشبع ما تحته.** `backdrop-filter: blur + saturate` لا
 *    شفافيّةٌ مسطّحة: القرصُ يأخذ لونَ المشهد خلفه فيبدو **فوقه** لا
 *    **عليه** — وهي الحيلةُ التي تجعل الطبقةَ تُقرأ مادّةً لا مستطيلاً.
 *
 * **③ الموضعُ عند البداية المنطقية لا في الوسط.** الأجهزةُ تضعه في
 *    الزاوية العليا حيث يسكن نظرُ المستخدم بين الأفعال. و`inset-inline`
 *    تجعله يميناً في العربية ويساراً في الإنجليزية بلا شرطٍ في الشيفرة.
 *
 * **④ اللونُ في البلاطة وحدها.** لا شريطَ ولا خلفيةً ملوّنة: مربّعٌ
 *    صغيرٌ متدرّجٌ يحمل رمزَ النوع. فيبقى القرصُ من مادّة المشهد،
 *    ويُقرأ النوعُ من طرف العين.
 *
 * وما لم يتغيّر: الأنواعُ ومُددُها وأصواتُها والسجلُّ وإتاحةُ القارئ —
 * التبديلُ في **الشكل** لا في المعنى.
 */

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CircleAlert,
  CircleCheck,
  Hand,
  Info,
  Sparkles,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import nexschoolMark from "../../assets/nexschool/nexschool.png";
import { LAYER } from "../../motion/layers";
import { MOTION } from "../../motion/system";
import { uiSound } from "../../lib/ui-sound";
import { useNotices, type Notice, type NoticeKind } from "./notify";

/**
 * لونُ كلِّ نوعٍ — في بلاطته لا في بطاقته.
 *
 * والتدرّجُ لا اللونُ المصمت: البلاطةُ 40×40، وسطحٌ مصمتٌ بهذا الحجم
 * يُقرأ رقعةَ طلاء. والتدرّجُ الخفيفُ يعطيها حجماً فتبدو زرّاً مضيئاً.
 */
const TONE: Record<
  NoticeKind,
  { from: string; to: string; icon: typeof Info; glyph: string }
> = {
  info: { from: "#4f8fc4", to: "#6fb2e0", icon: Info, glyph: "#fff" },
  success: { from: "#2f9c6a", to: "#54c48c", icon: CircleCheck, glyph: "#fff" },
  action: { from: "#c98a25", to: "#e8b355", icon: Sparkles, glyph: "#fff" },
  error: { from: "#c0424f", to: "#e0707c", icon: CircleAlert, glyph: "#fff" },
  trophy: { from: "#8a5cc4", to: "#b189e4", icon: Sparkles, glyph: "#fff" },
  welcome: { from: "#c08a3c", to: "#e6b96f", icon: Hand, glyph: "#fff" },

  /*
   * الانقطاعُ بلونِ الخطأ ورمزِ الواي‑فاي المشطوب.
   *
   * والرمزُ هو ما يُقرأ قبل النصّ: من رأى واي‑فاي مشطوباً عرف السببَ
   * قبل أن يقرأ حرفاً — وهذه إشارةٌ يعرفها كلُّ من استعمل هاتفاً.
   */
  offline: { from: "#b03a46", to: "#d9636f", icon: WifiOff, glyph: "#fff" },
  restored: { from: "#2f9c6a", to: "#54c48c", icon: Wifi, glyph: "#fff" },
};

function NoticeCard({ notice }: { notice: Notice }) {
  const dismiss = useNotices((s) => s.dismiss);
  const tone = TONE[notice.kind];
  const Icon = tone.icon;

  /*
   * الطيُّ التلقائي داخل البطاقة لا في المتجر.
   *
   * لو كان في المتجر لاحتاج جدولَ مؤقّتاتٍ يُنظَّف يدوياً عند الطيّ
   * المبكر. وهنا يموت المؤقّتُ مع البطاقة من نفسه — والتنظيفُ الذي
   * لا يُكتب لا يُنسى.
   */
  useEffect(() => {
    if (notice.ttl <= 0) return;

    const timer = window.setTimeout(() => dismiss(notice.id), notice.ttl);

    return () => window.clearTimeout(timer);
  }, [notice.id, notice.ttl, dismiss]);

  return (
    <motion.div
      layout
      /*
       * الدخولُ من فوق الحافّة — لا من العدم.
       *
       * البطاقةُ تنزلق نازلةً كأنّها كانت خارجَ الشاشة، وهو ما يجعلها
       * تُقرأ **قادمةً من النظام** لا ظاهرةً في مكانها. والانكماشُ
       * الطفيف يمنعها أن تبدو ملصقةً مسطّحة.
       */
      initial={{ opacity: 0, y: -26, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      /*
       * والخارجةُ تُسلّم المؤشّرَ قبل أن تختفي.
       *
       * فالبطاقةُ تبقى في الشجرة حتى تنقضي حركةُ خروجها، وهي في تلك
       * اللحظة **شفّافةٌ تلتقط النقر**: مستطيلٌ لا يُرى في زاوية الشاشة
       * يبتلع ضغطةً على ما تحته. و`pointerEvents` في متغيّر الخروج
       * يُطبَّق مع أوّل إطارٍ منه.
       */
      exit={{ opacity: 0, y: -14, scale: 0.96, pointerEvents: "none" }}
      transition={MOTION.spring.tile}
      role="status"
      className="group pointer-events-auto relative flex w-90 items-center gap-3 overflow-hidden py-2.5 ps-2.5 pe-3"
      style={{
        /*
         * القرصُ شديدُ الاستدارة — 22px على ارتفاعٍ 62px.
         *
         * وهو ما يفصل «بطاقةَ جهاز» عن «تنبيهِ متصفّح»: الأخيرُ زواياه
         * 8px فيُقرأ صندوقاً، وهذا يُقرأ قرصاً.
         */
        borderRadius: 22,
        background: "rgba(238,240,246,0.82)",
        /*
         * `saturate` مع `blur`: الضبابُ وحده يُخرج رمادياً ميّتاً،
         * والإشباعُ يُعيد ألوانَ المشهد خلفه فيحيا الزجاج.
         */
        backdropFilter: "blur(26px) saturate(180%)",
        WebkitBackdropFilter: "blur(26px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.55)",
        boxShadow:
          "0 22px 48px -20px rgba(0,0,0,0.85), 0 2px 8px -4px rgba(0,0,0,0.4)",
      }}
    >
      {/* بلاطةُ النوع — كلُّ ما في البطاقة من لون */}
      <span
        aria-hidden
        className="grid h-10.5 w-10.5 shrink-0 place-items-center"
        style={{
          borderRadius: 13,
          background: `linear-gradient(150deg, ${tone.from}, ${tone.to})`,
          boxShadow: `0 6px 14px -6px ${tone.from}`,
        }}
      >
        <Icon className="h-5.5 w-5.5" strokeWidth={2} style={{ color: tone.glyph }} />
      </span>

      {/*
        النصُّ داكنٌ على فاتح — وهو انقلابٌ عن التطبيق كلِّه.

        ولذلك يجب أن يكون **أدكنَ ممّا يُظنّ**: ‏#1a1d24 لا رماديّ.
        فالزجاجُ يمرّر شيئاً من سوادِ ما تحته، والرماديُّ عليه يخفت
        حتى يصير كأنّه معطَّل.
      */}
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-[13.5px] font-bold leading-tight"
          style={{ color: "#171a21" }}
        >
          {notice.title}
        </div>

        {notice.detail && (
          <div
            className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-snug"
            style={{ color: "rgba(23,26,33,0.62)" }}
          >
            {notice.detail}
          </div>
        )}

        {notice.action && (
          <button
            type="button"
            onClick={() => {
              uiSound("confirm");
              notice.action!.run();
              dismiss(notice.id);
            }}
            className="mt-1.5 rounded-full px-3 py-1 text-[11.5px] font-bold text-white transition hover:brightness-110"
            style={{
              background: `linear-gradient(150deg, ${tone.from}, ${tone.to})`,
            }}
          >
            {notice.action.label}
          </button>
        )}
      </div>

      {/*
        ختمُ النظام — علامةُ NexSchool.

        وموضعُها الطرفُ الخاتم كما في الأجهزة: البلاطةُ في البداية تقول
        **ما وقع**، والختمُ في النهاية يقول **من يُخبر**. وشعارُ المؤسسة
        لا يوضع هنا: هذا صوتُ البرنامج لا صوتُ المدرسة.
      */}
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-opacity group-hover:opacity-0"
        style={{ background: "rgba(23,26,33,0.9)" }}
      >
        <img src={nexschoolMark} alt="" className="h-7 w-7 object-contain" />
      </span>

      {/*
        الإغلاقُ يحلّ محلَّ الختم عند التحويم.

        فبطاقةُ الجهاز لا تحمل زرَّ إغلاقٍ ظاهراً — ومع ذلك يجب أن
        يكون ثمّة مخرج: إشعارُ الانقطاع يبقى بلا مؤقّت، وإشعارُ الفعل
        كذلك. فيُخفى حتى يُطلب، ولا يُزاحم الختمَ في المساحة.
      */}
      <button
        type="button"
        onClick={() => {
          uiSound("closeLayer");
          dismiss(notice.id);
        }}
        aria-label="إغلاق الإشعار"
        className="absolute end-3 grid h-8 w-8 place-items-center rounded-full opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        style={{ background: "rgba(23,26,33,0.9)", color: "rgba(255,255,255,0.85)" }}
      >
        <X className="h-4 w-4" strokeWidth={2.4} />
      </button>
    </motion.div>
  );
}

export function NotificationHost() {
  const notices = useNotices((s) => s.notices);

  return (
    <div
      /*
       * `aria-live` على الحاوية لا على البطاقة: قارئُ الشاشة يراقب
       * منطقةً ثابتة، ولو وُضع على بطاقةٍ تُركَّب وتُفكّ لما أعلن شيئاً.
       */
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed top-5 flex flex-col gap-2.5"
      style={{
        zIndex: LAYER.notification,
        /*
         * البدايةُ المنطقية — يميناً في العربية ويساراً في الإنجليزية.
         * ولا `inset-x-0` مع `items-center`: ذاك يضعها في الوسط حيث
         * تعترض ما يُقرأ، وهذه في الزاوية حيث تُرى ولا تحجب.
         */
        insetInlineStart: "1.25rem",
      }}
    >
      <AnimatePresence initial={false}>
        {notices.map((notice) => (
          <NoticeCard key={notice.id} notice={notice} />
        ))}
      </AnimatePresence>
    </div>
  );
}
