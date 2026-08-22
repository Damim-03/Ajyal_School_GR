/**
 * لوحُ المرشِّحات — شريطُ الاختيار في شاشات الكشوف.
 *
 * ثلاث شاشاتٍ (الحضور اليومي، الحقوق الشهرية، الكشف التقديري) تفتح
 * بالسلسلة نفسها: سنة ← طور ← مستوى ← مادة ← أستاذ ← فوج ← كشف. وكانت
 * في كلٍّ منها صفَّ حقولٍ حرّاً بأعراضٍ متفاوتة يبقى مفتوحاً أبداً —
 * يأكل من الشاشة قدرَ صفوفٍ من الجدول بعد أن يكون المستخدم قد فرغ من
 * الاختيار ولم يعد ينظر إليه.
 *
 * فصار لوحاً واحداً: شبكةٌ منتظمة تُطوى بنقرة، وإذا طُويت بقي الاختيارُ
 * مقروءاً في شارات الترويسة — لأنّ إخفاء المرشِّح لا يجوز أن يُخفي **ما
 * وقع عليه الاختيار**، وبه يُقرأ الجدول أسفلَه.
 *
 * والطيُّ يُحفظ في `localStorage` بمفتاح الشاشة: من عوّد نفسه على الطيّ
 * يجد الشاشةَ مطويّةً في المرّة القادمة.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Loader2, RotateCcw, SlidersHorizontal } from "lucide-react";

import { MOTION } from "../../motion/system";
import { uiSound } from "../../lib/ui-sound";

/** شارةُ اختيارٍ واحد — تُقرأ حين يُطوى اللوح */
export interface FilterChip {
  label: string;
  value: string;
}

function readOpen(key: string | undefined, fallback: boolean): boolean {
  if (!key) return fallback;

  try {
    const saved = localStorage.getItem(`filters.open.${key}`);
    return saved === null ? fallback : saved === "1";
  } catch {
    return fallback;
  }
}

export function FilterPanel({
  accent,
  storageKey,
  defaultOpen = true,
  collapseKey = "",
  chips = [],
  busy = false,
  extra,
  onReset,
  children,
}: {
  /** لون الشاشة — لكلّ كشفٍ هويتُه اللونية */
  accent: string;
  /** مفتاح حفظ حالة الطيّ؛ بدونه لا تُحفظ */
  storageKey?: string;
  defaultOpen?: boolean;
  /**
   * مُعرّفُ ما يكتمل به الاختيار — الإسناد التدريسي.
   *
   * كلّما صار غيرَ فارغٍ أو تبدّل، طُوي اللوح من نفسه: اختيارُ الفوج آخرُ
   * الحقول، وبعده لا يبقى في اللوح ما يُنظر إليه — والجدولُ هو المقصود.
   */
  collapseKey?: string;
  chips?: FilterChip[];
  busy?: boolean;
  /**
   * أداةٌ تبقى في الترويسة مفتوحاً اللوحُ أو مطويّاً — حقلُ مسح الباركود.
   *
   * ولا تُوضع بين الحقول: اللوح يُطوى بعد اكتمال الاختيار، والمسح إنّما
   * يقع بعده — ورقةٌ عادت من أستاذٍ فتُمسح ليُفتح كشفُها.
   */
  extra?: React.ReactNode;
  onReset?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(storageKey, defaultOpen));

  /**
   * الطيّ التلقائي — أثناء العرض لا في effect.
   *
   * وهو **لا يُحفظ**: المحفوظ تفضيلُ المستخدم لكيفية فتح الشاشة، ولو
   * كتبه الطيُّ التلقائي لفُتحت الشاشةُ في المرّة القادمة مطويّةً بلا
   * اختيارٍ أصلاً — فيُضطرّ إلى فتحها ليبدأ.
   */
  const [lastKey, setLastKey] = useState(collapseKey);

  if (collapseKey !== lastKey) {
    setLastKey(collapseKey);
    if (collapseKey) setOpen(false);
  }

  const persist = (next: boolean) => {
    if (!storageKey) return;

    try {
      localStorage.setItem(`filters.open.${storageKey}`, next ? "1" : "0");
    } catch {
      /* الحفظ رفاهية — لا يُعطّل الشاشة */
    }
  };

  /* الصوت والحفظ خارج مُحدِّث الحالة — المُحدِّث يجب أن يبقى نقيّاً */
  const toggle = () => {
    const next = !open;

    uiSound(next ? "openLayer" : "closeLayer");
    persist(next);
    setOpen(next);
  };

  const picked = chips.length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
      className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.015]"
    >
      {/* ============ الترويسة ============ */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          onClick={toggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-start"
        >
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
            style={{ background: `${accent}1f`, color: accent }}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </span>

          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-black">
              المرشِّحات
              {picked > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-black"
                  style={{ background: `${accent}1f`, color: accent }}
                >
                  {picked}
                </span>
              )}
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />}
            </span>

            {!open && (
              <span className="mt-0.5 block truncate text-[11px] text-white/35">
                {picked === 0 ? "لم يُختَر شيء بعد — انقر للفتح" : "انقر للفتح والتعديل"}
              </span>
            )}
          </span>
        </button>

        {extra}

        {onReset && picked > 0 && (
          <button
            onClick={() => {
              uiSound("back");
              onReset();
            }}
            title="إفراغ المرشِّحات"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/55 transition hover:bg-white/10 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            إفراغ
          </button>
        )}

        <button
          onClick={toggle}
          aria-label={open ? "طيّ المرشِّحات" : "فتح المرشِّحات"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-white/55 transition hover:bg-white/10 hover:text-white"
        >
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: MOTION.duration.fast, ease: MOTION.easing.standard }}
            className="grid place-items-center"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </button>
      </div>

      {/* ============ الشارات — بديلُ الحقول حين تُطوى ============ */}
      <AnimatePresence initial={false}>
        {!open && picked > 0 && (
          <motion.div
            key="chips"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.duration.fast, ease: MOTION.easing.standard }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.07] px-4 py-3">
              {chips.map((chip) => (
                <span
                  key={chip.label}
                  className="flex items-baseline gap-1.5 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[11px]"
                >
                  <span className="text-white/35">{chip.label}</span>
                  <span className="font-bold text-white/85">{chip.value}</span>
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ الحقول ============ */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="fields"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.duration.fast, ease: MOTION.easing.standard }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.07] p-4">
              {/*
                شبكةٌ لا صفٌّ حرّ: الحقول السبعة كانت تتفاوت عرضاً بحسب
                أطول اسمٍ في قائمتها، فتنكسر السطور في مواضع مختلفة كلّما
                تبدّل الفوج. و`auto-fit` يوزّعها بالتساوي على العرض المتاح.
              */}
              <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

export function FilterField({
  label,
  span,
  children,
}: {
  label: string;
  /** حقلٌ يحتاج خانتين — كالكشف ومعه زرُّ إنشائه */
  span?: boolean;
  children: React.ReactNode;
}) {
  const body = (
    <>
      <span className="mb-1.5 block text-[11px] font-bold text-white/45">{label}</span>
      {children}
    </>
  );

  /*
   * الحقلُ الممتدّ يحمل زرّاً بجانب قائمته، والزرُّ داخل <label> ينقل
   * نقرتَه إلى القائمة — فيُفتح المنسدل مع كلّ ضغطة على «كشف جديد».
   */
  return span ? (
    <div className="min-w-0 sm:col-span-2">{body}</div>
  ) : (
    <label className="block min-w-0">{body}</label>
  );
}

/**
 * قائمةُ اختيارٍ منسدلة.
 *
 * `appearance-none` مع سهمٍ مرسوم: سهمُ المتصفّح الأصلي يقع في الجهة
 * الخطأ في RTL ولا يُلوَّن. والحقلُ المختار يُميَّز بحدٍّ ملوَّن — فصفٌّ
 * من سبع قوائمَ متشابهة لا يُقرأ منه ما اختير وما بقي فارغاً.
 */
export function FilterSelect({
  value,
  onChange,
  items,
  placeholder,
  accent,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { id: string; name: string }[];
  /** بدونه لا خيارَ فارغاً — للحقل الذي لا يصحّ تركُه (السنة الدراسية) */
  placeholder?: string;
  accent: string;
  disabled?: boolean;
}) {
  const chosen = Boolean(value);

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full appearance-none rounded-xl border bg-black/30 py-2.5 pe-9 ps-3 text-xs font-bold outline-none transition hover:bg-black/40 focus:border-white/35 disabled:opacity-40 ${
          chosen ? "border-white/10 text-white" : "border-white/10 text-white/55"
        }`}
        style={chosen ? { borderColor: `${accent}55` } : undefined}
      >
        {placeholder !== undefined && (
          <option value="" className="bg-[#0a0f1a]">
            {placeholder}
          </option>
        )}
        {items.map((item) => (
          <option key={item.id} value={item.id} className="bg-[#0a0f1a]">
            {item.name}
          </option>
        ))}
      </select>

      <ChevronDown
        className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35"
        style={{ insetInlineEnd: 12 }}
      />
    </div>
  );
}
