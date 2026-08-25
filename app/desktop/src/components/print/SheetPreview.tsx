import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { AlertTriangle, CircleCheckBig, Loader2, Printer, RefreshCw, X } from "lucide-react";

import { MOTION } from "../../motion/system";
import { LAYER } from "../../motion/layers";
import { useSchoolStore } from "../../core/stores/school.store";
import {
  canPrintDirectly,
  defaultPrinter,
  listPrinters,
  printDirect,
  readPrinter,
  savePrinter,
} from "./native-print";

/** رسالة الفشل كما يقرؤها المستخدم — الجانب الأصلي يرمي نصّاً أحياناً وكائناً أخرى */
const printFailure = (err: unknown) =>
  typeof err === "string"
    ? err
    : ((err as { message?: string })?.message ?? "تعذّرت الطباعة");

/**
 * معاينة ورقة الكشف — A4 أفقية بمقاسها الحقيقي.
 *
 * ليست هذه معاينةَ الإيصال (`PrintPreview`): ذاك شريطٌ حراري عرضه 80mm
 * يُختار له الورق وحجم النصّ، وهذه ورقةُ مؤسسةٍ مقاسها ثابت لا يُختار.
 * فمشتركُهما نافذةٌ وزرُّ طباعة لا أكثر، وتوحيدُهما كان سيُدخل منتقي
 * الورق الحراري على كشفٍ لا يُطبع إلّا على A4.
 *
 * والورقة المعروضة هي `children` نفسها التي تُطبع — لا نسخةٌ ثانية:
 * الغلاف يكشفها بـ`.sheet-preview` وأنماطُ المحتوى مشتركة بين الشاشة
 * والطابعة في `index.css`. فما يُرى هو ما يخرج.
 */
export function SheetPreview({
  title,
  subtitle,
  warning,
  children,
  onRefresh,
  orientation = "landscape",
  controls,
  onClose,
}: {
  title: string;
  subtitle?: string;
  /** تنبيهٌ يُقرأ قبل إهدار ورقة — نقصُ الحصص مثلاً */
  warning?: string | null;
  children: ReactNode;
  /**
   * ضوابطُ الورقة نفسِها — شريطٌ تحت الترويسة لا يُطبع.
   *
   * ما يُبدّل **محتوى** الوثيقة قبل خروجها: صورةُ الأستاذ على شهادة
   * العمل مثلاً. وهي غيرُ ضوابط الطباعة (الطابعة والأوراق) لأنّها من
   * شأن المستند لا من شأن الجهاز، فتُمرَّر من الشاشة التي تعرفه.
   *
   * وتُصنَّف `sheet-preview-chrome` فتغيب عن الورق كبقية الغلاف.
   */
  controls?: ReactNode;
  /**
   * إعادةُ جلب معطيات الكشف والورقة معه.
   *
   * الورقة تُقرأ قبل الطباعة، وفي أثناء قراءتها يقع ما يغيّرها: حضورٌ
   * يُدوَّن على حاسوبٍ آخر، أو حقٌّ يُسدَّد في الشبّاك. وكان تحديثُها
   * يعني إغلاق المعاينة والعودة إلى الشاشة ثمّ فتحَها من جديد —
   * أربعُ نقراتٍ لمعرفة ما إن كان شيءٌ قد تبدّل.
   */
  onRefresh?: () => void | Promise<void>;
  /**
   * اتّجاه الورقة — أفقيّةٌ ما لم يُقل غيرُ ذلك.
   *
   * ولا يكفي `@page` في CSS: الطباعة المباشرة تمرّ بأمرٍ إلى ويندوز
   * يحمل اتّجاهَه معه وهو يغلب ما في الورقة، فتخرج الشهادةُ مستديرةً
   * على ورقةٍ عرضُها 297.
   */
  orientation?: "landscape" | "portrait";
  onClose: () => void;
}) {
  const settings = useSchoolStore((s) => s.settings);
  const brand = settings["school.brand_color"] || "#7dd3fc";

  const [zoom, setZoom] = useState(0.5);

  const upright = orientation === "portrait";

  /**
   * اختيار الورقة المطبوعة.
   *
   * `null` = كل الأوراق. وغيرُه فهرسُ ورقةٍ واحدة، تُخفى أخواتها
   * بـ`display: none` — فتغيب عن المعاينة وعن الطابعة معاً، بلا حاجةٍ
   * إلى مربّع «الصفحات من… إلى…» في نافذة النظام.
   *
   * والإخفاء على عناصر DOM لا بأنماطٍ ثابتة: الأوراق يرسمها المستدعي
   * ولا يعرف هذا المكوّن عددها إلّا بعدّها بعد الرسم.
   */
  const stageRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [only, setOnly] = useState<number | null>(null);

  /** إظهارُ ورقةٍ واحدة — مباشرةً على DOM، لأنّ ما يُطبع هو ما استقرّ فيه */
  const showOnly = useCallback((index: number | null) => {
    stageRef.current
      ?.querySelectorAll<HTMLElement>(".sheet-page")
      .forEach((node, i) => {
        node.style.display = index === null || index === i ? "" : "none";
      });
  }, []);

  /*
   * الأوراق قد تتأخّر عن أوّل رسمة: كشف الحضور يرسم صفوفه في ورقةٍ
   * خفيّة ليقيسها قبل أن يقسّمها، فلا `.sheet-page` واحدة في تلك اللحظة.
   * فلا يكفي أن تُعدَّ عند تبدّل `children` — المراقب يُبلغ متى ظهرت.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const sync = () => {
      setPages(stage.querySelectorAll(".sheet-page").length);
      showOnly(only);
    };

    sync();

    /* `childList` وحده: تبديلُ `display` تعديلُ سمةٍ فلا يوقظ المراقب */
    const watcher = new MutationObserver(sync);
    watcher.observe(stage, { childList: true, subtree: true });

    return () => watcher.disconnect();
  }, [only, children, showOnly]);

  /*
   * التصغير يُحسب من عرض النافذة لا من قيمةٍ ثابتة: 297mm تساوي
   * ‏1123px على 96dpi، وهي أعرض من أكثر النوافذ. فتُقاس المساحة
   * المتاحة وتُقسم عليها — ولا يُكبَّر أبداً فوق الحجم الطبيعي.
   */
  useEffect(() => {
    const fit = () => {
      const pageWidthPx = ((upright ? 210 : 297) * 96) / 25.4;
      const available = window.innerWidth - 96;
      setZoom(Math.min(1, Math.max(0.25, available / pageWidthPx)));
    };

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [upright]);

  // --------------------------------------------------
  // الطابعة
  //
  // تُقرأ مرّة عند الفتح: المحفوظة لهذا الجهاز إن كانت ما تزال مثبَّتة،
  // وإلّا فافتراضية النظام. وطابعةٌ حُذفت لا تبقى مختارةً بصمت — الطباعة
  // عليها تفشل بعد أن يكون المستخدم انصرف ظانّاً أنّها خرجت.
  // --------------------------------------------------

  const [printers, setPrinters] = useState<string[]>([]);
  const [printer, setPrinter] = useState("");
  const [printing, setPrinting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!canPrintDirectly()) return;

    let alive = true;

    Promise.all([listPrinters(), defaultPrinter()]).then(([names, fallback]) => {
      if (!alive) return;

      setPrinters(names);

      const saved = readPrinter();
      setPrinter(saved && names.includes(saved) ? saved : fallback);
    });

    return () => {
      alive = false;
    };
  }, []);

  /** ما طُبع وما بقي — يظهر بين ورقةٍ وأخرى فيبقى قرارُ الإتمام للمستخدم */
  const [progress, setProgress] = useState<{ printed: number; total: number } | null>(null);

  /**
   * ورقةٌ واحدة ثمّ وقفة.
   *
   * كانت الأوراق تُرسل دفعةً واحدة، فمن رأى الأولى خرجت مائلةً أو على
   * ورقٍ خطأ لم يبقَ له إلّا أن يوقف الطابعة والورق يخرج. والوقفة بعد
   * كلِّ ورقةٍ تجعل الاستمرار قراراً يُتَّخذ لا افتراضاً يُصحَّح.
   */
  const printPage = async (index: number) => {
    setFailure(null);
    setProgress(null);
    setOnly(index);
    showOnly(index);
    setPrinting(true);

    try {
      /* رسمةٌ كاملة قبل الإرسال — الطابعة تلتقط ما في DOM لحظتَها */
      await new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done(null))),
      );

      await printDirect(printer, !upright);

      if (index + 1 < pages) {
        setProgress({ printed: index + 1, total: pages });
      } else {
        setOnly(null);
        showOnly(null);
      }
    } catch (err) {
      setFailure(printFailure(err));
    } finally {
      setPrinting(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (!onRefresh) return;

    setRefreshing(true);
    try {
      await onRefresh();
      /* بيانةٌ جديدة ← ما طُبع من ترتيب الأوراق لم يعد يخصّها */
      setProgress(null);
    } finally {
      setRefreshing(false);
    }
  };

  const print = async () => {
    setFailure(null);
    setProgress(null);

    if (!canPrintDirectly()) {
      window.print();
      return;
    }

    /* ورقةٌ واحدة، أو ورقةٌ اختارها بنفسه: إرسالٌ واحد بلا سؤال */
    if (pages <= 1 || only !== null) {
      setPrinting(true);
      try {
        await printDirect(printer, !upright);
      } catch (err) {
        setFailure(printFailure(err));
      } finally {
        setPrinting(false);
      }
      return;
    }

    await printPage(0);
  };

  /* Escape يغلق — النافذة ملءُ الشاشة فلا زرَّ ظاهراً دائماً */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /*
   * البوّابةُ على الجسد — لا في شجرة الصفحة التي فُتحت منها.
   *
   * والسببُ عطبٌ في الورق لا ترتيبٌ في الشجرة: قواعدُ الطباعة تُخفي ما
   * ليس ورقةً بـ`visibility: hidden`، وهي **تُخفي ولا تُلغي المساحة**.
   * فيبقى المستندُ بطول الشاشة خلفها — جدولُ خمسين طالباً مثلاً —
   * فيقسّمه المتصفّح أوراقاً: الأولى فيها الورقة وما بعدها فراغٌ يخرج
   * ورقاً أبيض. ومع `#root { display: none }` في وسط الطباعة يصير
   * المستندُ هو الورقةَ وحدها وعددُ الأوراق عددَها.
   */
  return createPortal(
    /*
      `sheet-preview-shell` على كل صندوقٍ بين جذر النافذة والورقة، و
      `sheet-preview-chrome` على ما ليس ورقة. وعند الطباعة يُبطَل الأوّل
      (موضعٌ ثابت وقصٌّ وتحويل) ويُخفى الثاني — وإلّا لقصَّت النافذةُ
      الورقةَ أو أزاحتها، لأنّ العنصر المطلق يُنسب إلى أقرب سلفٍ موضَّع.
    */
    <div
      className="sheet-preview-shell fixed inset-0 text-white"
      style={{ zIndex: LAYER.dialog }}
    >
      {/*
        مقاسُ الورقة للطباعة — يُحقن ما دامت المعاينة العمودية مفتوحة.

        وإعادةُ تعريف `@page sheet` نفسِها لا صفحةٍ ثانية: الإسنادُ
        بالاسم يمرّ عبر خاصّية `page` على عنصرٍ مطلق الموضع، وهو ما لا
        يُضمن — وثمرةُ إخفاقه ورقةٌ مُدارة. وهذه تُبدّل المقاسَ نفسَه
        فلا يبقى للتأويل موضع. وتُرفع مع النافذة، فالكشوف بعدها أفقيّةٌ
        كما كانت.
      */}
      {upright && (
        <style>{"@media print{@page sheet{size:A4 portrait;margin:0}}"}</style>
      )}

      {/* الحجاب وأدوات النافذة خارج الورقة — لا تُطبع */}
      <div onClick={onClose} className="sheet-preview-chrome absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: MOTION.duration.fast, ease: MOTION.easing.enter }}
        className="sheet-preview-shell absolute inset-3 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0f1a]"
      >
        <header
          className="sheet-preview-chrome flex flex-wrap items-center gap-3 px-6 py-4"
          style={{ background: `linear-gradient(120deg, ${brand}22, transparent)` }}
        >
          <Printer className="h-5 w-5 shrink-0" style={{ color: brand }} />

          <div className="flex-1">
            <h2 className="text-lg font-black leading-tight">{title}</h2>
            {subtitle && <p className="text-[11px] text-white/45">{subtitle}</p>}
          </div>

          {printers.length > 0 && (
            <select
              value={printer}
              onChange={(e) => {
                setPrinter(e.target.value);
                savePrinter(e.target.value);
              }}
              title="الطابعة التي ستخرج منها الورقة"
              className="max-w-56 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold outline-none transition focus:border-white/30"
            >
              {printers.map((name) => (
                <option key={name} value={name} className="bg-[#0a0f1a]">
                  {name}
                </option>
              ))}
            </select>
          )}

          {onRefresh && (
            <button
              onClick={refresh}
              disabled={refreshing || printing}
              title="إعادة جلب الحضور والحقوق — الورقة تتبع ما استجدّ"
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              تحديث
            </button>
          )}

          <button
            onClick={print}
            disabled={printing || refreshing}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-[#04121c] transition hover:brightness-110 disabled:opacity-50"
            style={{ background: brand }}
          >
            {printing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            {only !== null
              ? `طباعة الورقة ${only + 1}`
              : pages > 1
                ? `طباعة — الورقة 1 من ${pages}`
                : "طباعة"}
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
          >
            <X className="h-4 w-4" />
            إغلاق
          </button>
        </header>

        {controls && (
          <div className="sheet-preview-chrome flex flex-wrap items-center gap-3 border-b border-white/10 px-6 py-3">
            {controls}
          </div>
        )}

        {warning && (
          <div className="sheet-preview-chrome flex items-start gap-2.5 border-b border-amber-400/20 bg-amber-500/10 px-6 py-3 text-xs leading-relaxed text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{warning}</span>
          </div>
        )}

        {/* فشلُ الطباعة المباشرة لا يترك المستخدم بلا مخرج — حوار النظام باقٍ */}
        {failure && (
          <div className="sheet-preview-chrome flex flex-wrap items-center gap-3 border-b border-rose-400/20 bg-rose-500/10 px-6 py-3 text-xs text-rose-100">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{failure}</span>
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-white/10 px-3 py-1.5 font-bold transition hover:bg-white/20"
            >
              جرّب عبر نافذة ويندوز
            </button>
            <button onClick={() => setFailure(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* بين ورقةٍ وأخرى — الاستمرار قرارٌ لا افتراض */}
        {progress && (
          <div className="sheet-preview-chrome flex flex-wrap items-center gap-3 border-b border-emerald-400/20 bg-emerald-500/10 px-6 py-3 text-xs text-emerald-100">
            <CircleCheckBig className="h-4 w-4 shrink-0" />

            <span className="flex-1">
              خرجت الورقة {progress.printed} من {progress.total} — بقيت{" "}
              {progress.total - progress.printed}. أتطبع التي بعدها؟
            </span>

            <button
              onClick={() => printPage(progress.printed)}
              disabled={printing}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-400/20 px-3 py-1.5 font-bold transition hover:bg-emerald-400/30 disabled:opacity-50"
            >
              {printing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              اطبع الورقة {progress.printed + 1}
            </button>

            <button
              onClick={() => {
                setProgress(null);
                setOnly(null);
                showOnly(null);
              }}
              className="rounded-lg bg-white/10 px-3 py-1.5 font-bold text-white/80 transition hover:bg-white/20"
            >
              يكفي
            </button>
          </div>
        )}

        {pages > 1 && (
          <div className="sheet-preview-chrome flex flex-wrap items-center gap-2 border-b border-white/10 px-6 py-2.5">
            <span className="text-[11px] font-bold text-white/45">الأوراق:</span>

            <PageChip label={`الكل (${pages})`} active={only === null} onClick={() => setOnly(null)} />

            {Array.from({ length: pages }).map((_, index) => (
              <PageChip
                key={index}
                label={`ورقة ${index + 1}`}
                active={only === index}
                onClick={() => setOnly(index)}
              />
            ))}

            <span className="ms-auto text-[11px] text-white/30">
              المطبوع هو المعروض — والطباعة تمضي ورقةً ورقة وتقف بينهما
            </span>
          </div>
        )}

        <main className="sheet-preview-shell flex-1 overflow-auto bg-[#0d1420] p-8">
          <div
            ref={stageRef}
            className="sheet-preview"
            style={{ "--sheet-zoom": zoom } as React.CSSProperties}
          >
            {children}
          </div>
        </main>

        <footer className="sheet-preview-chrome flex items-center gap-3 border-t border-white/10 px-6 py-3 text-[11px] text-white/35">
          <span>
            {upright
              ? "A4 عمودية — 210 × 297 مم بمقاسها الحقيقي"
              : "A4 أفقية — 297 × 210 مم بمقاسها الحقيقي"}
          </span>
          <span>·</span>
          <span>
            {canPrintDirectly()
              ? "الطباعة مباشرة بلا حوار النظام — بمقاس المعاينة تماماً"
              : "خارج التطبيق: الطباعة تمرّ بحوار المتصفّح"}
          </span>
          <span className="ms-auto">
            {only === null
              ? pages > 1
                ? `${pages} أوراق — تخرج واحدةً واحدة`
                : "ورقة واحدة"
              : `الورقة ${only + 1} وحدها ستُطبع`}
          </span>
        </footer>
      </motion.div>
    </div>,
    document.body,
  );
}

function PageChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-3 py-1 text-[11px] font-bold transition"
      style={
        active
          ? { background: "rgba(255,255,255,0.16)", color: "#fff" }
          : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)" }
      }
    >
      {label}
    </button>
  );
}
