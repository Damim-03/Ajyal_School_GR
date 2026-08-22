/**
 * مسحُ باركود — زرٌّ يفتح نافذةً تشرح ثمّ تنتظر القارئ.
 *
 * كان حقلاً مكشوفاً في ترويسة المرشِّحات، وكان ذلك خطأً في موضعين:
 * حقلُ إدخالٍ بلا شرحٍ لا يُعرف ما يُكتب فيه، والقارئ **لوحةُ مفاتيح**
 * لا جهازٌ يُخاطَب — يكتب حيث وقع التركيز، فإن لم يكن الحقلُ مركَّزاً
 * تناثرت الحروف في الشاشة أو ضاعت.
 *
 * والنافذة تحلّ الأمرين: تشرح ما يُنتظر، وتحبس التركيز في حقلها
 * (`MotionDialog`) فلا يذهب ما يُمسح إلى غيره.
 *
 * **وما يُبحث عنه ليس من شأنها.** الشاشات تمسح أشياء مختلفة — ورقةَ
 * كشفٍ هنا ودفعةَ أستاذٍ هناك وبطاقةَ طالبٍ غداً — والمشترَك بينها
 * واحد: نافذةٌ تشرح، وحقلٌ مركَّز، ورسالةُ فشلٍ تُعيد التركيز لمسحةٍ
 * ثانية. فتُمرَّر دالّةُ البحث `resolve` ويبقى الباقي واحداً، ولا
 * تُنسخ نافذةٌ لكلّ شاشة فتتخلّف إحداها عن إصلاحٍ وقع في أختها.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { CircleAlert, Loader2, ScanLine, X } from "lucide-react";

import { MotionDialog } from "../../motion/MotionDialog";

/**
 * أرقامٌ وصلت مضغوطةً مع Shift — تُردّ إلى أصلها.
 *
 * القارئُ لوحةُ مفاتيح، وبعضُ الطُّرز يُرسل صفَّ الأرقام و«العالي»
 * مضغوطٌ (أو يُبرمَج عليه)، فيصل «2026000026» إلى الحقل هكذا:
 * `@)@^))))@^` — ويرتدّ البحث بـ«لا وجود لهذا الكود بار» والرقمُ
 * صحيحٌ في يد الماسح. وهو عطبٌ لا يُخمَّن سببُه: النصُّ المعروض في
 * حقلٍ عربيّ يظهر مقلوباً فوقَ ذلك.
 *
 * والردُّ مشروط: يقع إن كان المدخل **كلُّه** أرقاماً ورموزَ صفِّها،
 * فلا يمسّ معرّفاً داخلياً (cuid) ولا نصّاً فيه رموز.
 */
const SHIFTED: Record<string, string> = {
  ")": "0",
  "!": "1",
  "@": "2",
  "#": "3",
  $: "4",
  "%": "5",
  "^": "6",
  "&": "7",
  "*": "8",
  "(": "9",
};

const unshiftDigits = (text: string): string => {
  const raw = text.trim();

  if (!raw || !/^[0-9)!@#$%^&*(]+$/.test(raw)) return raw;
  if (!/[)!@#$%^&*(]/.test(raw)) return raw;

  return raw.replace(/[)!@#$%^&*(]/g, (ch) => SHIFTED[ch] ?? ch);
};

export interface ScanCopy {
  /** نصُّ الزرّ في ترويسة المرشِّحات */
  button: string;
  /** تلميحُ الزرّ */
  buttonTitle: string;
  title: string;
  subtitle: string;
  /** ثلاث خطوات: أين يُوجَّه القارئ، وماذا يفعل، وما يحدث بعدها */
  steps: [ReactNode, ReactNode, ReactNode];
  placeholder: string;
  /** نصُّ زرّ التنفيذ — «افتح الكشف» */
  action: string;
  /** رسالةُ عدم الوجود — تُعرض كما هي */
  notFound: string;
  /** سطرٌ رماديّ في ذيل النافذة */
  hint: string;
}

export function BarcodeScanner<T>({
  copy,
  accent,
  busy = false,
  resolve,
  onFound,
}: {
  copy: ScanCopy;
  accent: string;
  /** الانتقال ما يزال جارياً بعد مسحةٍ ناجحة */
  busy?: boolean;
  /** يُرجع المطلوب أو `null` إن لم يوجد؛ ورميُه يُعامَل كعدم وجود */
  resolve: (text: string) => Promise<T | null>;
  onFound: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={copy.buttonTitle}
        className="flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition hover:brightness-110"
        style={{ borderColor: `${accent}44`, background: `${accent}14`, color: accent }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
        {copy.button}
      </button>

      <AnimatePresence>
        {open && (
          <ScanDialog
            copy={copy}
            accent={accent}
            resolve={resolve}
            onClose={() => setOpen(false)}
            onFound={(value) => {
              /* رمزٌ صحيح: تُغلق النافذة ويُفتح المطلوب خلفها */
              setOpen(false);
              onFound(value);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function ScanDialog<T>({
  copy,
  accent,
  resolve,
  onFound,
  onClose,
}: {
  copy: ScanCopy;
  accent: string;
  resolve: (text: string) => Promise<T | null>;
  onFound: (value: T) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [seeking, setSeeking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  /*
   * التركيز على الحقل — لا على زرّ الإغلاق.
   *
   * `autoFocus` وحده لا يكفي: `MotionDialog` يضع التركيز على **أوّل
   * عنصرٍ قابلٍ له** في اللوح حبساً للتنقّل، وأوّلُه زرّ الإغلاق في
   * الترويسة. وتأثيرُه يسبق هذا لأنّه ابنٌ في شجرة React — فما يُكتب
   * هنا يقع بعده فيغلبه.
   *
   * والقارئ لا ينتظر: يُمسح الباركود فيُرسل حروفه فوراً، فإن لم يكن
   * الحقلُ مركَّزاً ذهبت إلى زرٍّ لا يقرؤها.
   */
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  /**
   * فشلٌ: الرسالة، ثمّ الحقل **فارغٌ** جاهزٌ لمسحةٍ ثانية بلا نقرة.
   *
   * كان يُحدَّد ما فيه لا يُمسح، فيكفي أنّ المسحة التالية تحلّ محلّه.
   * لكنّ القارئ قد يُرسل حرفاً واحداً زائداً أو يُقاطَع، فيلتصق
   * الجديدُ بالقديم ويخرج رمزٌ لا وجود له — والمستخدم يرى فشلاً
   * ثانياً ولا يعرف أنّ الحقل هو السبب. والإفراغُ يقطع ذلك.
   */
  const fail = (message: string) => {
    setError(message);
    setText("");
    inputRef.current?.focus({ preventScroll: true });
  };

  const submit = async () => {
    const code = text.trim();
    if (!code || seeking) return;

    setSeeking(true);
    setError(null);

    try {
      const found = await resolve(unshiftDigits(code));

      if (!found) {
        fail(copy.notFound);
        return;
      }

      onFound(found);
    } catch {
      fail(copy.notFound);
    } finally {
      setSeeking(false);
    }
  };

  return (
    /* الأنماط على لوح `MotionDialog` نفسه كما في `FormDialog` — لا على غلافٍ داخله */
    <MotionDialog
      onClose={onClose}
      labelledBy="scan-title"
      className="w-full max-w-115 overflow-hidden rounded-2xl border border-white/12 bg-[#0a0f1a] text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
    >
      <header
        className="flex items-center gap-3 px-6 py-4"
        style={{ background: `linear-gradient(120deg, ${accent}22, transparent)` }}
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{ background: `${accent}1f`, color: accent }}
        >
          <ScanLine className="h-5 w-5" />
        </span>

        <div className="flex-1">
          <h3 id="scan-title" className="text-base font-black leading-tight">
            {copy.title}
          </h3>
          <p className="text-[11px] text-white/45">{copy.subtitle}</p>
        </div>

        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="grid h-8 w-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="space-y-4 px-6 py-5">
        {/* الشرح: ماذا يفعل المستخدم، وماذا يحدث من نفسه */}
        <ol className="space-y-2 text-xs leading-relaxed text-white/60">
          {copy.steps.map((step, index) => (
            <li key={index} className="flex gap-2">
              <Step accent={accent}>{index + 1}</Step>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="relative">
          <ScanLine
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ insetInlineStart: 12, color: accent }}
          />

          <input
            ref={inputRef}
            /* العودةُ إليه تُحدِّد ما فيه: المسحة التالية تحلّ محلّ الأولى */
            onFocus={(e) => e.currentTarget.select()}
            value={text}
            onChange={(e) => {
              /* يُردّ ما ضُغط مع Shift وقتَ الكتابة — فما يُرى هو ما يُبحث عنه */
              setText(unshiftDigits(e.target.value));
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={copy.placeholder}
            className="w-full rounded-xl border bg-black/30 py-3 pe-10 ps-10 text-sm font-bold outline-none transition placeholder:font-normal placeholder:text-white/30 focus:border-white/35"
            style={{ borderColor: error ? "rgba(253,164,175,0.55)" : `${accent}44` }}
          />

          {seeking && (
            <Loader2
              className="absolute top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/40"
              style={{ insetInlineEnd: 12 }}
            />
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs leading-relaxed text-rose-100">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <footer className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
        <button
          onClick={submit}
          disabled={!text.trim() || seeking}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-[#04121c] transition hover:brightness-110 disabled:opacity-40"
          style={{ background: accent }}
        >
          {seeking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
          {copy.action}
        </button>

        <button
          onClick={onClose}
          className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold transition hover:bg-white/20"
        >
          إغلاق
        </button>

        <span className="ms-auto text-[11px] text-white/30">{copy.hint}</span>
      </footer>
    </MotionDialog>
  );
}

function Step({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <span
      className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-black"
      style={{ background: `${accent}22`, color: accent }}
    >
      {children}
    </span>
  );
}
