import { forwardRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { uiSound } from "../../../lib/ui-sound";
import { ease, geometry, glow, highlight, label as labelToken, palette, reduced } from "./topbar.tokens";

/**
 * زرُّ الإجراء الدائري — مفردةُ الشريط العلوي.
 *
 * **الحالةُ النشطة هي التثبيتُ نفسُه، لا حالةٌ ثالثة.**
 *
 * قرأتُ المخطّط أوّلاً على أنّ فيه ثلاثَ حالات: خامل، ومحوَّم عليه،
 * ونشط. ثمّ تبيّن أنّ قسمَي «‏ACTIVE STATE» و«عند التثبيت على أيقونة»
 * يصفان الشيءَ نفسَه: خلفيةٌ بيضاء، وأيقونةٌ داكنة، وتوهّجٌ ناعم، واسمٌ
 * يظهر أسفلها. أي أنّ الإبرازَ **يتبع الانتباه** ولا يُثبَّت على عنصرٍ
 * بعينه — وهو سلوكُ واجهات الأجهزة: ما تنظر إليه هو النشط.
 *
 * ولذلك `active = تحويم أو تركيز`. و`held` استثناءٌ واحد: الجرسُ يبقى
 * مضاءً ما دامت لوحتُه مفتوحة، وإلّا انطفأ تحت المؤشّر وهو مصدرُ ما
 * يُقرأ على الشاشة.
 *
 * ولماذا لا يُعرَض الاسمُ دائماً: تسعُ تسمياتٍ تحت تسع أيقونات تصير
 * سطرَ نصٍّ ثانياً يزاحم الصفَّ نفسَه. والاسمُ إجابةٌ عن سؤال — يظهر
 * حين يُسأل.
 */
export interface QuickActionProps {
  /** الاسمُ الذي يظهر أسفلها عند الإبراز، وهو نفسُه `aria-label`. */
  label: string;
  children: ReactNode;
  onClick?: () => void;
  /** يُبقيها مضاءةً بلا تحويم — للوحةٍ مفتوحة. */
  held?: boolean;
  /** شارةٌ صغيرة أعلى الحافّة (عدد غير المقروء). */
  badge?: ReactNode;
  /** لونُ الأيقونة الخاملة — يُستعمل للتمييز (الخروج أحمرُ خافت). */
  tone?: string;
  disabled?: boolean;
}

export const QuickAction = forwardRef<HTMLButtonElement, QuickActionProps>(
  function QuickAction(
    { label, children, onClick, held = false, badge, tone, disabled = false },
    ref,
  ) {
    const still = useReducedMotion();
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);

    const active = !disabled && (held || hovered || focused);

    return (
      <div className="relative shrink-0">
        <motion.button
          ref={ref}
          type="button"
          disabled={disabled}
          aria-label={label}
          title={label}
          onClick={() => {
            if (disabled) return;
            /*
              النيّةُ لا الملفّ: المكوّنُ يقول «فُتحت طبقة» ولا يعرف أيّ
              نغمةٍ تُشغَّل ولا بأيّ شدّة — كبقيّة التطبيق.
            */
            uiSound("openLayer");
            onClick?.();
          }}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          /*
            التركيزُ يُبرز كالتحويم: الشريطُ يجب أن يُقاد بلوحة المفاتيح
            كما يُقاد بالفأرة، ومؤشّرُ تركيزٍ من المتصفّح وحده كان سيُخرج
            حلقةً زرقاء غريبةً عن هذا السطح.
          */
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="grid place-items-center rounded-full outline-none"
          style={{
            width: geometry.icon,
            height: geometry.icon,
            /* التزجيج: سطحٌ شفّاف وحافّةٌ رفيعة وضبابيةٌ لما خلفها. */
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.35 : 1,
          }}
          animate={{
            backgroundColor: active ? palette.active : "rgba(255,255,255,0.06)",
            borderColor: active ? "rgba(255,255,255,0)" : "rgba(255,255,255,0.12)",
            color: active ? palette.abyss : tone ?? "rgba(255,255,255,0.78)",
            boxShadow: active ? glow.active : glow.idle,
            /*
              اللقطاتُ الثلاث (0.96 ← 1.08 ← 1) للدخول وحده. والخروجُ
              يعود إلى 1 بلا تجاوز: الرِجعةُ تؤكّد وصولاً، ولا معنى
              لتأكيد مغادرة.
            */
            scale: still ? 1 : active ? [...highlight.scale] : 1,
          }}
          transition={
            still
              ? reduced.transition
              : {
                  duration: highlight.duration,
                  ease,
                  ...(active ? { scale: { duration: highlight.duration, ease, times: [...highlight.times] } } : {}),
                }
          }
          /* الحافّةُ في `style` لا في `animate`: العرضُ والنمطُ ثابتان ولونُها وحده يتحرّك. */
          initial={false}
        >
          <span
            className="grid place-items-center"
            style={{ width: "44%", height: "44%" }}
            aria-hidden
          >
            {children}
          </span>
        </motion.button>

        {/* الحافّة — عنصرٌ مستقلّ فلا يتنازع `border` مع تحريك اللون */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ border: `1px solid ${active ? "transparent" : "rgba(255,255,255,0.12)"}`, transition: `border-color ${highlight.duration}s` }}
        />

        {badge}

        {/*
          الاسمُ أسفلها — **خارج تدفّق التخطيط**.

          لو شارك في التخطيط لتمدّد الشريطُ وانكمش مع كلّ حركةِ مؤشّر،
          ولدُفع ما تحته. وهو مثالُ الخاصّيات التي تُحرَّك: تحويلٌ
          وشفافيةٌ لا غير.
        */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-full whitespace-nowrap text-[11px] font-bold tracking-wide"
          style={{ color: "rgba(255,255,255,0.92)", marginTop: 6 }}
          initial={false}
          /*
            ويسقط الاسمُ حين تُفتح لوحةُ الزرّ.

            اللوحةُ تنزل في الموضع نفسِه تماماً فتغطّيه، فيبقى نصٌّ محجوبٌ
            يُرسم بلا أن يُرى. والأهمّ أنّه لم يعد يجيب عن شيء: اللوحةُ
            المفتوحة تقول ما يقوله الاسمُ وزيادة.
          */
          animate={{
            opacity: active && !held ? 1 : 0,
            x: "-50%",
            y: active && !held ? 0 : labelToken.y,
          }}
          transition={still ? reduced.transition : { duration: labelToken.duration, ease }}
        >
          {label}
        </motion.span>
      </div>
    );
  },
);
