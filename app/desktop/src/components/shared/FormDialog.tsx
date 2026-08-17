import type { FormEvent, ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { MotionDialog } from "../../motion/MotionDialog";

/**
 * غلافُ نماذج الإضافة والتعديل — نافذةٌ في وسط الشاشة لا درجٌ جانبي.
 *
 * كانت النماذج على ثلاثة أشكال: درجٌ بعرض 34rem ينزلق من الجانب، وصندوقٌ
 * صغير في الوسط بعرض 26rem، ونافذةٌ واسعة. والثلاثة تُدخل البيانات نفسها،
 * فاختلافُها يجعل كلَّ شاشةٍ تُتعلَّم من جديد.
 *
 * والدرج كان أسوأها: عرضُه يصفّ الحقول عموداً واحداً طويلاً، ونماذج هذا
 * النظام تبلغ عشرة حقول — فيبقى نصفُها تحت خطّ الرؤية، ويُحفظ الطالب
 * وحقلٌ لم يُرَ أصلاً. والوسط يتّسع لعمودين فيُرى النموذج كلُّه دفعة.
 *
 * والبنية ثابتة في كل نافذة: ترويسةٌ برمز المورد ولونه، ثمّ جسمٌ وحده
 * يتمرّر، ثمّ ذيلٌ ملتصقٌ بالقاع — فزرّ الحفظ في مكانه مهما طال النموذج،
 * لا يُبحث عنه بالتمرير.
 *
 * البنية والسلوك من `MotionDialog`: تعتيمُ المحيط، وحبسُ التركيز داخل
 * اللوح، وEscape للإغلاق، وإعادةُ التركيز إلى ما فتحها.
 */

/**
 * العرض بحسب كثافة الحقول — لا رقمٌ يُكتب في كل شاشة.
 *
 * `lg` هو الأصل (56rem): عمودان مريحان لعشرة حقول. و`md` لنموذجٍ من
 * أربعة حقول لا يملأ الأوّل فيبدو فارغاً. و`xl` لما يحمل جدولاً أو
 * قائمةً داخله — كتوزيع دفعةٍ على فواتير.
 */
const WIDTH = {
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
} as const;

export type DialogWidth = keyof typeof WIDTH;

export function FormDialog({
  icon: Icon,
  title,
  subtitle,
  tone,
  width = "lg",
  onClose,
  onSubmit,
  submitForm,
  busy = false,
  submitLabel,
  submitIcon,
  submitDisabled = false,
  hideCancel = false,
  error,
  children,
  footerExtra,
  headerExtra,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** لون المورد — يصبغ الترويسة وزرّ الحفظ فيُعرف المورد قبل قراءة عنوانه */
  tone: string;
  width?: DialogWidth;
  onClose: () => void;
  /** غيابُه (مع `submitForm`) يجعلها نافذةَ عرضٍ بلا ذيلِ حفظ */
  onSubmit?: (event: FormEvent) => void;
  /**
   * معرّفُ نموذجٍ في الأبناء يُرسله زرُّ الذيل — بديلُ `onSubmit`.
   *
   * لأنّ بعض النماذج مكوّناتٌ مشتركة تحمل `<form>` الخاصّ بها (حقول
   * الطالب تُستعمل في المعالج وفي هذه النافذة معاً)، ولفُّها في نموذجٍ
   * ثانٍ تعشيشٌ يرفضه HTML ويُسقط الإرسال صامتاً. و`form="id"` على
   * الزرّ يربطه بنموذجٍ خارجه — وهو الحلّ المعياري لا حيلة.
   */
  submitForm?: string;
  busy?: boolean;
  submitLabel?: string;
  submitIcon?: ReactNode;
  submitDisabled?: boolean;
  /** يُخفي «إلغاء» — لخطوةٍ صار فيها العمل محفوظاً، فالإلغاء يوهم أنّه يتراجع عنه */
  hideCancel?: boolean;
  error?: string | null;
  children: ReactNode;
  /** أزرارٌ إضافية في الذيل — تُوضع بعد «إلغاء» */
  footerExtra?: ReactNode;
  /** شريطٌ ثابتٌ تحت الترويسة لا يتمرّر — كحقل بحثٍ تعتمد عليه بقيةُ النافذة */
  headerExtra?: ReactNode;
}) {
  const titleId = `dialog-${title}`;

  const body = (
    <>
      <header
        className="flex shrink-0 items-center gap-3 border-b border-white/10 px-7 py-5"
        style={{ background: `linear-gradient(90deg, ${tone}14, transparent)` }}
      >
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
          style={{ background: `${tone}1f` }}
        >
          <Icon className="h-5.5 w-5.5" style={{ color: tone }} />
        </span>

        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate text-lg font-black leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11px] text-white/40">{subtitle}</p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {headerExtra && (
        <div className="shrink-0 border-b border-white/10 px-7 py-4">{headerExtra}</div>
      )}

      {/*
        `min-h-0` ضروريٌّ لا تجميل: عنصرُ المرونة أدنى ارتفاعه محتواه
        افتراضاً، فبدونه يتمدّد الجسمُ بطول الحقول ويدفع الذيل خارج
        الشاشة بدل أن يتمرّر داخل نفسه.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
        {children}

        {error && (
          <div className="mt-5 whitespace-pre-line rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm leading-relaxed text-rose-200">
            {error}
          </div>
        )}
      </div>

      {(onSubmit || submitForm) && (
        <footer className="flex shrink-0 items-center gap-3 border-t border-white/10 px-7 py-4">
          <button
            type="submit"
            form={submitForm}
            disabled={busy || submitDisabled}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 font-black text-[#04121c] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: tone }}
          >
            {busy ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : submitIcon}
            {submitLabel}
          </button>

          {!hideCancel && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
            >
              إلغاء
            </button>
          )}

          {footerExtra}
        </footer>
      )}
    </>
  );

  return (
    <MotionDialog
      onClose={onClose}
      labelledBy={titleId}
      className={`flex max-h-[90vh] w-full ${WIDTH[width]} flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a0f1a] text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]`}
    >
      {onSubmit ? (
        <form
          /*
           * الإرسال يقف هنا ولا يصعد.
           *
           * البوّابة تُخرج النافذة من شجرة الـDOM لكنّ أحداث React تعبرها
           * إلى الأب في شجرة React. فنافذةُ مسحٍ تُفتح من داخل استمارة
           * الطالب كانت ستوقظ `onSubmit` الاستمارة أيضاً — فيُحفظ الطالب
           * لأنّ الموظّف ضغط «امسح الآن».
           */
          onSubmit={(event) => {
            event.stopPropagation();
            onSubmit(event);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {body}
        </form>
      ) : (
        body
      )}
    </MotionDialog>
  );
}

/**
 * شبكةُ الحقول — عمودان على الشاشات المتوسّطة فما فوق.
 *
 * موحَّدةٌ هنا لا في كل نموذج: الفواصل بين الحقول كانت `gap-4` في شاشة
 * و`gap-5` في أخرى و`space-y-5` في ثالثة، والفرق يُرى حين تُفتح النافذتان
 * في دقيقة واحدة.
 *
 * والحقل الذي يحتاج السطر كاملاً يُلفّ بـ`<FormRow wide>` — كالعنوان
 * والملاحظة، ومفاتيح التبديل التي تبدو مبتورةً في نصف سطر.
 */
export function FormGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">{children}</div>
  );
}

export function FormRow({
  wide = false,
  children,
}: {
  wide?: boolean;
  children: ReactNode;
}) {
  return <div className={wide ? "sm:col-span-2" : ""}>{children}</div>;
}
