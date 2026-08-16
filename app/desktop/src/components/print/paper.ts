/**
 * إعدادات الطباعة — **إعدادات هذا الجهاز لا هذه المدرسة**.
 *
 * الورق والطابعة يخصّان الحاسوب الذي أمامك: أمانة الاستقبال قد تطبع
 * على حراري 80 مم بينما المدير يطبع على A4. فلو حُفظت مع هوية المدرسة
 * لأفسد اختيارُ أحدهما ورقةَ الآخر. لذلك `localStorage` لا الخادم —
 * وهذا نفس ما يفعله SKK للسبب نفسه.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * **المقاس بالمليمتر لا بالبكسل.** وهذا ليس تفضيلاً في الصياغة:
 *
 * البكسل وحدة شاشة، يُترجَم عند الطباعة إلى 1/96 بوصة. فنصّ 11px يخرج
 * نحو 2.91mm على الورق — **دون** الحدّ المألوف للإيصالات الحرارية
 * (‏3.2–4.5mm). وكانت هذه الشاشة تضبط `fontSize: 12` بالبكسل على بطاقة
 * الإيصال، بينما قواعد `@media print` في index.css تفرض
 * `font-size: var(--rcp-print, 3.5mm) !important` — فكان منتقي حجم
 * النصّ **يُكتب ولا يُقرأ**: كل الأحجام تطبع 3.5mm بالضبط.
 *
 * فالقيم هنا بالمليمتر، وتُضبط على `.print-area` باسم `--rcp-print`،
 * وكل مقاس في المستند مضاعفٌ لـ`var(--rcp)` — فيتناسب الإيصال كلّه مع
 * تغيير رقم واحد.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * والقراءة محصَّنة: القيمة المخزَّنة مُدخَلٌ خارجي كردّ خادم تماماً، وقد
 * تكون من نسخة أقدم. أوّل مرّة كلّفنا هذا شاشةً بيضاء كاملة — قيمة
 * `"thermal"` قديمة لم تجد لها مواصفة فانهار العرض. فالمجهول يُستبدل
 * بالافتراضي لا يُمرَّر.
 */

export type PaperSize = "72mm" | "80mm" | "A4";
export type TextScale = "3.1mm" | "3.5mm" | "4mm";
export type PrintLang = "escpos" | "tspl";

export const PAPERS: {
  key: PaperSize;
  label: string;
  hint: string;
  /** عرض المعاينة على الشاشة — تقريب بصريّ لعرض الورق الحقيقي */
  px: number;
  /**
   * عرض الورق الحقيقي بالمليمتر.
   *
   * تحتاجه الطباعة المباشرة: `ICoreWebView2PrintSettings` تأخذ مقاس
   * الصفحة صراحةً، وبلا هذا الرقم تطبع كلَّ إيصالٍ على هيئة A4.
   */
  mm: number;
}[] = [
  { key: "72mm", label: "72 مم", hint: "الحراري الشائع", px: 272, mm: 72 },
  { key: "80mm", label: "80 مم", hint: "حراري عريض", px: 302, mm: 80 },
  { key: "A4", label: "A4", hint: "ورق عادي", px: 460, mm: 210 },
];

export const SCALES: { key: TextScale; label: string; hint: string }[] = [
  { key: "3.1mm", label: "مضغوط", hint: "3.1mm" },
  { key: "3.5mm", label: "متوسط", hint: "3.5mm" },
  { key: "4mm", label: "كبير", hint: "4mm" },
];

export const LANGS: { key: PrintLang; label: string; hint: string }[] = [
  { key: "escpos", label: "ESC/POS", hint: "طابعات الإيصالات الشائعة" },
  { key: "tspl", label: "TSPL", hint: "Xprinter وما شابهها" },
];

const PAPER_KEY = "ajyal_print_paper";
const SCALE_KEY = "ajyal_print_scale";
const LANG_KEY = "ajyal_print_lang";

const DEFAULT_PAPER: PaperSize = "80mm";
const DEFAULT_SCALE: TextScale = "3.5mm";
const DEFAULT_LANG: PrintLang = "escpos";

/*
 * جسرٌ من الأسماء القديمة.
 *
 * نسختان سابقتان حفظتا `"thermal"` ثمّ `"t72"/"t80"/"a4"`. من ضبط ورقه
 * مرّة لا ينبغي أن يعود إلى الافتراضي لأنّ التسمية تغيّرت خلفه.
 */
const PAPER_ALIASES: Record<string, PaperSize> = {
  thermal: "80mm",
  t72: "72mm",
  t80: "80mm",
  a4: "A4",
};

const SCALE_ALIASES: Record<string, TextScale> = {
  compact: "3.1mm",
  normal: "3.5mm",
  large: "4mm",
};

const read = <T extends string>(
  key: string,
  known: readonly { key: T }[],
  aliases: Record<string, T>,
  fallback: T,
): T => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    if (known.some((k) => k.key === stored)) return stored as T;
    return aliases[stored] ?? fallback;
  } catch {
    /* وضع خاص يمنع التخزين — الافتراضي يعمل */
    return fallback;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* تبقى للجلسة */
  }
};

export const readPaper = (): PaperSize =>
  read(PAPER_KEY, PAPERS, PAPER_ALIASES, DEFAULT_PAPER);

export const readScale = (): TextScale =>
  read(SCALE_KEY, SCALES, SCALE_ALIASES, DEFAULT_SCALE);

export const readLang = (): PrintLang =>
  read(LANG_KEY, LANGS, {}, DEFAULT_LANG);

export const savePaper = (v: PaperSize) => write(PAPER_KEY, v);
export const saveScale = (v: TextScale) => write(SCALE_KEY, v);
export const saveLang = (v: PrintLang) => write(LANG_KEY, v);

/** المواصفة مضمونة: القراءة لا تعيد إلّا مفتاحاً معروفاً */
export const paperSpec = (paper: PaperSize) =>
  PAPERS.find((p) => p.key === paper) ?? PAPERS[1];

/** صنف الطباعة: الحراري يملأ عرض الورق، وA4 عمودٌ موسّط */
export const paperClass = (paper: PaperSize) =>
  `print-area ppr-${paper === "A4" ? "a4" : "thermal"}`;

/**
 * أنماط `.print-area` — العرض على الشاشة والمقاس على الورق معاً.
 *
 * `--rcp-print` تقرؤها قواعد الطباعة في index.css، و`--rcp` يقرؤها
 * المستند على الشاشة. القيمتان واحدة، فما تراه هو ما يخرج.
 */
export function printAreaStyle(paper: PaperSize, scale: TextScale) {
  return {
    width: paperSpec(paper).px,
    "--rcp-print": scale,
    "--rcp": scale,
  } as React.CSSProperties;
}

/**
 * الطباعة الصامتة **بلغة الطابعة** (ESC/POS · TSPL) — غير منفَّذة بعد.
 *
 * ولا تخلط بينها وبين الطباعة المباشرة التي صارت تعمل: تلك تطبع صفحة
 * الويب نفسها بلا حوار النظام عبر `ICoreWebView2_16::Print`
 * (‏`src-tauri/src/printing.rs` و`components/print/native-print.ts`)،
 * وهي ما تستعمله أوراق الكشوف A4.
 *
 * وهذه تعني بناء أوامر بايتيّة تُرسَل إلى الطابعة الحرارية مباشرةً —
 * أسرع وأدقّ للإيصالات، وتحتاج نداءً أصلياً آخر.
 */
export const silentPrintingAvailable = false;
