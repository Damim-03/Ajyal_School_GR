/**
 * طبقةُ الإشعارات — تُركَّب مرّةً فوق التطبيق كلِّه.
 *
 * وموضعُها أعلى الوسط كما في الجهاز: الزاويةُ موضعُ ما يُهمَل، والوسطُ
 * الأعلى موضعُ ما يُقرأ ثمّ يُنسى. وهي فوق كلّ شيء (`LAYER.notification`)
 * ولا تلتقط النقرَ إلّا في البطاقات نفسِها — فما تحتها يبقى صالحاً
 * للعمل، والإشعارُ خبرٌ لا حاجز.
 */

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, Hand, Info, Sparkles, X } from "lucide-react";

import { LAYER } from "../../motion/layers";
import { MOTION } from "../../motion/system";
import { uiSound } from "../../lib/ui-sound";
import { useNotices, type Notice, type NoticeKind } from "./notify";

/**
 * لونٌ واحدٌ لكلّ نوع — على الحافّة لا على السطح.
 *
 * تلوينُ خلفية البطاقة كلِّها يُخرج مستطيلاً أحمرَ في شاشةٍ رماديّة:
 * لغةُ لوحات التحكّم لا لغةُ الأجهزة. والشريطُ الرفيع في الجنب يكفي
 * للتمييز من طرف العين، ويُبقي البطاقةَ من مادّة المشهد نفسِها.
 */
const TONE: Record<NoticeKind, { edge: string; icon: typeof Info; fg: string }> = {
  info: { edge: "#8ab4d8", icon: Info, fg: "#cfe0ee" },
  success: { edge: "#7fd4a8", icon: CircleCheck, fg: "#c8ecd9" },
  action: { edge: "#f0c987", icon: Sparkles, fg: "#f3ddb8" },
  error: { edge: "#e88f9a", icon: CircleAlert, fg: "#f2c8cd" },
  trophy: { edge: "#d9b8f0", icon: Sparkles, fg: "#e8d6f5" },
  /* الترحيبُ بلون الضوء الدافئ في المشهد — لا لونَ إشارةٍ ثالث */
  welcome: { edge: "#f0dcb8", icon: Hand, fg: "#f4e7d2" },
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
      initial={{ opacity: 0, y: -18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={MOTION.spring.tile}
      role="status"
      className="pointer-events-auto flex w-88 items-start gap-3 overflow-hidden rounded-xl border border-white/10 py-3 ps-3 pe-3.5 backdrop-blur-xl"
      style={{
        /* داكنٌ شبه معتم — يُقرأ فوق أيّ شاشة، ولا يبتلع ما تحته */
        background: "rgba(10,14,22,0.88)",
        boxShadow: "0 18px 40px -22px rgba(0,0,0,0.9)",
      }}
    >
      {/* الشريطُ الملوّن — كلُّ ما في البطاقة من لون */}
      <span
        aria-hidden
        className="absolute inset-y-0 start-0 w-[3px]"
        style={{ background: tone.edge }}
      />

      <Icon
        aria-hidden
        className="mt-0.5 h-4.5 w-4.5 shrink-0"
        strokeWidth={1.6}
        style={{ color: tone.edge }}
      />

      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold leading-snug" style={{ color: tone.fg }}>
          {notice.title}
        </div>

        {notice.detail && (
          <div className="mt-0.5 text-[12px] font-light leading-relaxed text-white/50">
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
            className="mt-2 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition hover:bg-white/10"
            style={{ borderColor: `${tone.edge}66`, color: tone.edge }}
          >
            {notice.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          uiSound("closeLayer");
          dismiss(notice.id);
        }}
        aria-label="إغلاق الإشعار"
        className="shrink-0 rounded-md p-1 text-white/30 transition hover:bg-white/10 hover:text-white/70"
      >
        <X className="h-3.5 w-3.5" />
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
      className="pointer-events-none fixed inset-x-0 top-6 flex flex-col items-center gap-2.5 px-4"
      style={{ zIndex: LAYER.notification }}
    >
      <AnimatePresence initial={false}>
        {notices.map((notice) => (
          <NoticeCard key={notice.id} notice={notice} />
        ))}
      </AnimatePresence>
    </div>
  );
}
