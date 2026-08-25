/**
 * المسرح — التخطيطُ الذي تشترك فيه شاشاتُ التهيئة كلُّها.
 *
 * وهو ما يجعل التجربةَ **تجربةً واحدة** لا أربعَ عشرةَ شاشةً متشابهة:
 * موضعُ العنوان واحدٌ في كلِّها، فلا يقفز بين خطوةٍ وأخرى؛ والفعلُ
 * الأساسيُّ في المكان نفسِه، فتتعلّمه اليدُ بعد الشاشة الثانية.
 *
 * **والتركيزُ ينتقل إلى العنوان عند كلّ خطوة** (§45). وهذا ليس
 * تحسيناً للوصول فحسب: قارئُ الشاشة كان يبقى على زرّ «متابعة» الذي
 * ضُغط للتوّ في شاشةٍ لم تعد موجودة، فلا يُعلَن شيءٌ ممّا ظهر.
 * و`tabIndex={-1}` يجعل العنوانَ قابلاً للتركيز برمجياً وحده — فلا
 * يدخل في دورة Tab.
 */

import {
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { RotateCcw, type LucideIcon } from "lucide-react";

import nexschoolLogo from "../../../assets/nexschool/nexschool.png";
import { useResumed, useT } from "../hooks/useFirstBootState";
import { useBootProgress } from "../hooks/useBootProgress";

export interface StageProps {
  title: string;
  /** وصفٌ تحت العنوان — سطرٌ أو سطران لا فقرة (§51) */
  description?: ReactNode;
  children?: ReactNode;

  /** الفعلُ الأساسيّ — واحدٌ لا خمسة (§52) */
  primary?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    busy?: boolean;
  };
  /** فعلٌ ثانويٌّ أخفتُ — «ليس الآن»، «إعادة الفحص» */
  secondary?: { label: string; onClick: () => void; disabled?: boolean };
  onBack?: () => void;
  footNote?: ReactNode;

  /** شريطُ خطأ فوق الفعل — لا نافذةَ حوار (§41) */
  error?: string | null;

  /**
   * مفتاحٌ يميّز الشاشة.
   *
   * وهو ما يُعيد تشغيل الحركة ويُعيد التركيز: بدونه يرى React عنصرَ
   * `<h1>` نفسَه بنصٍّ جديد، فلا تُعاد الحركةُ ولا يُنقل التركيز —
   * فيبدو الانتقالُ استبدالَ نصٍّ لا انتقالَ شاشة.
   */
  stepKey: string;
}

export function Stage({
  title,
  description,
  children,
  primary,
  secondary,
  onBack,
  footNote,
  error,
  stepKey,
}: StageProps) {
  const t = useT();
  const progress = useBootProgress();
  const resumed = useResumed();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [stepKey]);

  /*
   * النموذجُ لا `div`: يجعل Enter في أيّ حقلٍ يُرسل الخطوةَ — وهو ما
   * تتوقّعه اليدُ في شاشةٍ من حقلين. و`onSubmit` يمنع إعادةَ التحميل.
   */
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (primary && !primary.disabled && !primary.busy) primary.onClick();
  };

  return (
    <form className="nx-stage" onSubmit={onSubmit} noValidate>
      {progress.counted && (
        <div className="nx-stage__rail" aria-hidden="true">
          <i style={{ width: `${(progress.completed / progress.total) * 100}%` }} />
        </div>
      )}

      <header className="nx-stage__top">
        <div className="nx-stage__brand">
          <img src={nexschoolLogo} alt="" aria-hidden="true" />
          <span className="nx-stage__eyebrow">{t.common.eyebrow}</span>
        </div>

        {/*
          شارةُ «أهلاً بعودتك» — في التدفّق، بين الهويّة وعدّاد الخطوات.

          كانت طبقةً مطلقةً عند أسفل الشاشة تعلو زرَّ «رجوع» وسطرَ
          الإرشاد. ومحلُّها هنا: هي جوابٌ عن «أين أنا» كالعدّاد بجانبها،
          وفي الترويسة فسحةٌ لها.
        */}
        {resumed && (
          <span className="nx-stage__resumed">
            <RotateCcw aria-hidden="true" size={12} strokeWidth={2.2} />
            {t.common.resuming}
          </span>
        )}

        {progress.counted && (
          <div
            className="nx-stage__count"
            /*
             * التقدّمُ يُعلَن بلطف: `polite` لا يقطع ما يقرؤه المستخدم،
             * و`atomic` تجعل «الخطوة 5 من 15» تُقرأ جملةً لا رقماً
             * منفرداً تبدّل.
             */
            aria-live="polite"
            aria-atomic="true"
          >
            {t.common.step} {progress.index} {t.common.of} {progress.total}
          </div>
        )}
      </header>

      <div className="nx-stage__body" key={stepKey}>
        <h1 className="nx-title nx-rise-1" ref={headingRef} tabIndex={-1}>
          {title}
        </h1>

        {description && <p className="nx-lead nx-rise-2">{description}</p>}

        {children && <div className="nx-rise-3">{children}</div>}

        {error && (
          <div className="nx-alert" role="alert">
            {error}
          </div>
        )}
      </div>

      <footer className="nx-stage__foot nx-rise-4">
        {onBack && (
          <button type="button" className="nx-btn nx-btn--ghost" onClick={onBack}>
            {t.common.back}
          </button>
        )}

        <div className="nx-stage__foot-note">{footNote}</div>

        {secondary && (
          <button
            type="button"
            className="nx-btn nx-btn--quiet"
            onClick={secondary.onClick}
            disabled={secondary.disabled}
          >
            {secondary.label}
          </button>
        )}

        {primary && (
          <button
            type="submit"
            className="nx-btn nx-btn--primary"
            disabled={primary.disabled || primary.busy}
          >
            {primary.busy && <span className="nx-pulse" aria-hidden="true" />}
            {primary.busy ? t.common.saving : primary.label}
          </button>
        )}
      </footer>
    </form>
  );
}

// --------------------------------------------------
// عناصرُ مشتركةٌ صغيرة
// --------------------------------------------------

export interface ChoiceProps {
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
  /**
   * **رمزٌ يصف الخيار — لا زخرفةٌ تملأ فراغاً.**
   *
   * الشاشةُ الواحدة تعرض ثلاثةَ خياراتٍ متشابهةً في الشكل، والفرقُ
   * بينها في سطرَي نصّ. والرمزُ يُقرأ قبل النصّ بلمحة: من رأى قرصاً
   * صلباً عرف «محلّي» قبل أن يقرأ، ومن رأى شبكةً عرف «خادمٌ على
   * الشبكة». وهذا هو ما يجعل شاشةَ تركيبٍ تُتصفَّح لا تُقرأ.
   *
   * ويبقى اختيارياً: خياراتُ اللغة أسماؤها هي هويّتُها، ورمزٌ فوقها
   * يزاحمها ولا يضيف.
   */
  icon?: LucideIcon;
  /** محتوىً إضافيٌّ في نهاية الصفّ — وسمُ حالةٍ مثلاً */
  trailing?: ReactNode;
}

/**
 * صفُّ اختيارٍ كبير — العنصرُ الأساسيّ في هذه الشاشات.
 *
 * و`role="radio"` لا `<input type="radio">`: المطلوبُ سطحٌ كاملٌ يُضغط
 * بعنوانه ووصفه، وتنسيقُ زرّ الاختيار الأصليّ إلى هذا الشكل يقاتل
 * المتصفّحَ بلا مقابل. والدورُ يُعطي القارئَ ما ينقصه.
 */
export function Choice({
  label,
  hint,
  selected,
  onSelect,
  icon: Icon,
  trailing,
}: ChoiceProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className="nx-choice"
      onClick={onSelect}
    >
      <span className="nx-choice__mark" aria-hidden="true" />

      {Icon && (
        <span className="nx-choice__icon" aria-hidden="true">
          <Icon size={20} strokeWidth={1.7} />
        </span>
      )}

      <span className="nx-choice__body">
        <span className="nx-choice__label">{label}</span>
        {hint && <span className="nx-choice__hint">{hint}</span>}
      </span>

      {trailing}
    </button>
  );
}

export function ChoiceGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="nx-choices" role="radiogroup" aria-label={label}>
      {children}
    </div>
  );
}

export interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, error, hint, children }: FieldProps) {
  return (
    <label className="nx-field" data-invalid={error ? "true" : "false"}>
      <span>{label}</span>
      {children}
      {error && <span className="nx-field__error">{error}</span>}
      {!error && hint && <span className="nx-hint">{hint}</span>}
    </label>
  );
}

export function StatusRow({
  label,
  meta,
  state,
  icon: Icon,
  trailing,
}: {
  label: string;
  meta?: string;
  state: "ok" | "bad" | "busy" | "idle";
  /**
   * رمزُ الصفّ — **يقول ما هو، والوسمُ يقول كيف حاله**.
   *
   * وفصلُ المعنيين مقصود: صفوفُ الفحص كانت نصّاً ووسماً أخضر، فتُقرأ
   * قائمةً متجانسةً لا يميّز الطابعةَ من الماسح إلّا حرفٌ في أوّلها.
   * والرمزُ يجعل كلَّ صفٍّ يُعرَف بشكله، والوسمُ يبقى للحال وحده.
   */
  icon?: LucideIcon;
  trailing?: ReactNode;
}) {
  const tone =
    state === "ok"
      ? "nx-tag nx-tag--ok"
      : state === "bad"
        ? "nx-tag nx-tag--bad"
        : "nx-tag nx-tag--busy";

  return (
    <div className="nx-row">
      {Icon && (
        <span className="nx-row__icon" aria-hidden="true">
          <Icon size={17} strokeWidth={1.7} />
        </span>
      )}

      <div className="nx-row__body">
        <span className="nx-row__label">{label}</span>
        {meta && <span className="nx-row__meta">{meta}</span>}
      </div>

      {state === "busy" ? (
        <span className={tone}>
          <span className="nx-pulse" aria-hidden="true" />
        </span>
      ) : (
        trailing
      )}
    </div>
  );
}
