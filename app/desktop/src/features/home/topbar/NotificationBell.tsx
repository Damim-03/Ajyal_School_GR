import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bell,
  CircleAlert,
  CircleCheck,
  Hand,
  Info,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";

import { LAYER } from "../../../motion/layers";
import { MOTION } from "../../../motion/system";
import { uiSound } from "../../../lib/ui-sound";
import { useNotices, useUnreadCount, type NoticeKind } from "../../../components/notifications/notify";
import { QuickAction } from "./QuickAction";
import { palette, reduced } from "./topbar.tokens";

/**
 * مركزُ الإشعارات — الجرسُ ولوحتُه.
 *
 * **المشكلةُ التي يحلّها: الإشعارُ كان يُمحى لا يُطوى.** يظهر أربع
 * ثوانٍ ثمّ يزول بلا أثر؛ فمن نظر إلى مكانٍ آخر، أو غادر مكتبَه، أو
 * تراكمت عليه أربعةٌ فأزاح أوّلُها آخرَها — فقد الخبرَ ولا سبيلَ إليه.
 * والنغمةُ تقول «وقع شيء» ولا تقول ماذا.
 *
 * ولماذا لوحةٌ معلَّقة لا نافذةُ حوار (`MotionDialog`): الحوارُ يأخذ
 * التركيزَ كلَّه ويُعتّم ما خلفه ويحبس `Tab` — وذلك صحيحٌ لقرارٍ يجب
 * أن يُتّخذ، وخطأٌ لقائمةٍ تُقرأ بطرف العين. والإشعارُ خبرٌ لا حاجز،
 * وهي القاعدةُ التي بُنيت عليها طبقةُ العرض أصلاً.
 */

const TONE: Record<NoticeKind, { edge: string; icon: typeof Info }> = {
  info: { edge: "#8ab4d8", icon: Info },
  success: { edge: "#7fd4a8", icon: CircleCheck },
  action: { edge: "#f0c987", icon: Sparkles },
  error: { edge: "#e88f9a", icon: CircleAlert },
  trophy: { edge: "#d9b8f0", icon: Sparkles },
  welcome: { edge: "#f0dcb8", icon: Hand },
  /*
   * الانقطاعُ والعودةُ في السجلّ أيضاً — وهو موضعُهما الأنفع.
   *
   * فبطاقةُ الانقطاع تُرفع من نفسها متى عاد الخادم، وقد لا يكون
   * المستخدمُ ناظراً حينها. والسجلُّ يُبقي الأثر: «انقطع 10:14،
   * عاد 10:16» — وبه يُعرف هل كان العطبُ في الشبكة أم في العمل.
   */
  offline: { edge: "#e88f9a", icon: WifiOff },
  restored: { edge: "#7fd4a8", icon: Wifi },
};

/** عرضُ اللوحة — رقمٌ لا صنف: يقرؤه حسابُ الموضع أدناه. */
const PANEL_WIDTH = 352;

/**
 * «منذ كم» بالعربية.
 *
 * ولا تُستعمل `Intl.RelativeTimeFormat` هنا: تُخرج «قبل ٣ دقائق»
 * بأرقامٍ هنديّة تخالف بقيّةَ الأرقام في هذه الواجهة (الساعةُ والتواريخ
 * كلُّها `nu-latn`)، وتصريفُ العربية للمثنّى والجمع يحتاج ضبطاً على أيّ
 * حال. وثلاثُ حالاتٍ تكفي لسجلٍّ عمرُه جلسةٌ واحدة.
 */
const since = (at: number): string => {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return "الآن";
  const m = Math.round(s / 60);
  if (m < 60) return `منذ ${m} د`;
  return `منذ ${Math.round(m / 60)} س`;
};

export function NotificationBell() {
  const still = useReducedMotion();
  const [open, setOpen] = useState(false);

  const history = useNotices((s) => s.history);
  const unread = useUnreadCount();
  const markAllRead = useNotices((s) => s.markAllRead);
  const clearHistory = useNotices((s) => s.clearHistory);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  /**
   * اللوحةُ تُرسم في `body` عبر بوّابة، فهي **ليست** من نسل `wrapRef`.
   *
   * فحصُ «هل وقع النقر خارجنا؟» بالغلاف وحده كان يعني أنّ كلّ نقرةٍ
   * داخل اللوحة نفسِها تُحسب خارجيّة — فيُغلقها زرُّ «مسح الكلّ» قبل
   * أن يعمل، ويُغلقها سحبُ شريط التمرير.
   *
   * (قِستُ السلوك فوجدته سليماً رغم ذلك — لأسبابٍ تتعلّق بإعادة
   *  `React` توجيهَ أحداث البوّابات. وهو اتّكالٌ على تفصيلٍ داخليّ لا
   *  ينبغي البناءُ عليه: المرجعُ الصريح يجعل الصوابَ مقصوداً لا عارضاً.)
   */
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  /**
   * موضعُ اللوحة — يُحسب من موضع الجرس، ويُقصّ داخل الشاشة.
   *
   * المحاذاةُ عربيّةٌ صحيحة: حافّةُ اللوحة اليمنى فوق حافّة الجرس
   * اليمنى، ثمّ تمتدّ يساراً — كما تفعل كلُّ قائمةٍ منسدلة في مستندٍ
   * من اليمين إلى اليسار.
   *
   * والقصُّ ليس ترفاً: الجرسُ يقع في يسار الشريط، فاللوحةُ (352px)
   * تبلغ حافّةَ النافذة على العروض المتوسّطة وتُقصّ. فتُزاح عند الحاجة
   * بدل أن تخرج — والإزاحةُ أهونُ من محتوىً لا يُقرأ.
   */
  const place = useCallback(() => {
    const r = bellRef.current?.getBoundingClientRect();
    if (!r) return;

    const margin = 10;
    const left = Math.min(
      Math.max(margin, r.right - PANEL_WIDTH),
      window.innerWidth - PANEL_WIDTH - margin,
    );

    setAnchor({ top: r.bottom + 14, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, place]);

  /*
   * الفتحُ يُعلِّم الكلَّ مقروءاً.
   *
   * ولا يُنتظر أن يمرّ المستخدم على كلّ سطر: اللوحةُ تعرض ما وقع كلَّه
   * دفعةً واحدة، فالشارةُ التي تبقى بعد أن يُنظر إليها تكذب.
   */
  useEffect(() => {
    if (open) markAllRead();
    /*
      و`history.length` في التبعيّات لا `open` وحدها.
      قِستُ الحالة: وصل إشعارٌ بعد فتح اللوحة بثوانٍ، فظهر سطرُه فيها
      **وبقيت الشارةُ تقول «1»** — أي أنّ الشاشة تُنبّه إلى خبرٍ معروضٍ
      أمام عين قارئه. والشارةُ تعني «ثمّة ما لم تره»، فلا تصحّ فوق لوحةٍ
      مفتوحة.
    */
  }, [open, history.length, markAllRead]);

  /*
   * الإغلاقُ بالنقر خارجها وبـEsc.
   *
   * و`pointerdown` لا `click`: النقرُ على زرٍّ آخر في الشريط كان يُغلق
   * اللوحةَ **بعد** أن يعمل ذلك الزرّ، فيومض ترتيبٌ معكوس. والالتقاطُ
   * عند الضغط يُنهي اللوحةَ أوّلاً كما يتوقّع المستخدم.
   */
  useEffect(() => {
    if (!open) return;

    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      /* يُطوى الحدثُ هنا فلا يبلغ الرئيسية فتطوي سياقَها هي أيضاً. */
      e.stopPropagation();
      uiSound("back");
      setOpen(false);
      bellRef.current?.focus();
    };

    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);

    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <QuickAction
        ref={bellRef}
        label="الإشعارات"
        held={open}
        onClick={() => setOpen((v) => !v)}
        badge={
          unread > 0 ? (
            <span
              aria-hidden
              className="pointer-events-none absolute -top-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full px-1 text-[10px] font-black tabular-nums"
              style={{
                /* بدايةُ السطر منطقيّة لا يمين/يسار — الشريطُ عربيّ والصفُّ قد ينعكس. */
                insetInlineEnd: -2,
                background: palette.accent,
                color: palette.abyss,
                boxShadow: "0 0 0 2px rgba(13,17,23,0.9)",
              }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : undefined
        }
      >
        <Bell aria-hidden strokeWidth={1.8} className="h-full w-full" />
      </QuickAction>

      {createPortal(
        <AnimatePresence>
          {open && anchor && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="سجلّ الإشعارات"
            dir="rtl"
            className="fixed overflow-hidden rounded-2xl border border-white/10"
            style={{
              zIndex: LAYER.contextMenu,
              /*
                **بوّابةٌ إلى `body` لا عنصرٌ داخل الشريط.**

                لسببين قِستُ كليهما. الأوّل أنّ الشريط يعيش عند شفافية
                0.62 (‏`chromeIdleOpacity`) — وشفافيةُ الأب تضرب أبناءها،
                فكانت اللوحةُ تُرسم باهتةً ونصُّها رمادياً بلا سبب ظاهر،
                ولا يمكن لابنٍ أن ينقض شفافية أبيه. والثاني أنّ الشريط
                يقع داخل غلافٍ له `transform` أثناء الدخول والمغادرة،
                وذلك يُنشئ حاوية تموضعٍ جديدة فتنزلق اللوحةُ مع الغلاف.

                وخارج الشجرة تُحسب مكانَها بنفسها (`place`) وتبقى عند
                شفافيتها هي.
              */
              top: anchor.top,
              left: anchor.left,
              width: PANEL_WIDTH,
              background: "rgba(13,17,23,0.94)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 24px 60px -28px rgba(0,0,0,0.95)",
              transformOrigin: "top center",
            }}
            initial={still ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={still ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={still ? reduced.transition : MOTION.spring.overlay}
          >
            <header className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <span className="text-[13px] font-bold text-white/85">الإشعارات</span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    uiSound("back");
                    clearHistory();
                  }}
                  className="rounded-lg px-2 py-1 text-[11px] font-bold text-white/45 transition hover:bg-white/10 hover:text-white/80"
                >
                  مسح الكلّ
                </button>
              )}
            </header>

            <div className="max-h-96 overflow-y-auto overscroll-contain">
              {history.length === 0 ? (
                /* الفراغُ حالةٌ تُقال: لوحةٌ بيضاء بلا سطرٍ تبدو عطلاً. */
                <p className="px-4 py-10 text-center text-[12px] font-light text-white/35">
                  لا إشعارات بعد
                </p>
              ) : (
                <ul className="divide-y divide-white/6">
                  {history.map((n) => {
                    const tone = TONE[n.kind];
                    const Icon = tone.icon;
                    return (
                      <li key={n.id} className="flex items-start gap-3 px-4 py-3">
                        <Icon
                          aria-hidden
                          className="mt-0.5 h-4 w-4 shrink-0"
                          strokeWidth={1.7}
                          style={{ color: tone.edge }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-bold leading-snug text-white/88">
                            {n.title}
                          </div>
                          {n.detail && (
                            <div className="mt-0.5 text-[11.5px] font-light leading-relaxed text-white/45">
                              {n.detail}
                            </div>
                          )}
                        </div>
                        <span
                          dir="ltr"
                          className="mt-0.5 shrink-0 text-[10.5px] tabular-nums text-white/30"
                        >
                          {since(n.at)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
