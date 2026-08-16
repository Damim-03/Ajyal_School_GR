import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { AlertTriangle, Loader2, Printer, X } from "lucide-react";

import { MOTION } from "../../motion/system";
import { useSchoolStore } from "../../core/stores/school.store";
import {
  canPrintDirectly,
  defaultPrinter,
  listPrinters,
  printDirect,
  readPrinter,
  savePrinter,
} from "./native-print";

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
  onClose,
}: {
  title: string;
  subtitle?: string;
  /** تنبيهٌ يُقرأ قبل إهدار ورقة — نقصُ الحصص مثلاً */
  warning?: string | null;
  children: ReactNode;
  onClose: () => void;
}) {
  const settings = useSchoolStore((s) => s.settings);
  const brand = settings["school.brand_color"] || "#7dd3fc";

  const [zoom, setZoom] = useState(0.5);

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

  useEffect(() => {
    const nodes = stageRef.current?.querySelectorAll<HTMLElement>(".sheet-page");
    if (!nodes) return;

    setPages(nodes.length);
    nodes.forEach((node, index) => {
      node.style.display = only === null || only === index ? "" : "none";
    });
  }, [only, children]);

  /*
   * التصغير يُحسب من عرض النافذة لا من قيمةٍ ثابتة: 297mm تساوي
   * ‏1123px على 96dpi، وهي أعرض من أكثر النوافذ. فتُقاس المساحة
   * المتاحة وتُقسم عليها — ولا يُكبَّر أبداً فوق الحجم الطبيعي.
   */
  useEffect(() => {
    const fit = () => {
      const pageWidthPx = (297 * 96) / 25.4;
      const available = window.innerWidth - 96;
      setZoom(Math.min(1, Math.max(0.25, available / pageWidthPx)));
    };

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

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

  const print = async () => {
    setFailure(null);

    if (!canPrintDirectly()) {
      window.print();
      return;
    }

    setPrinting(true);
    try {
      await printDirect(printer);
    } catch (err: any) {
      setFailure(typeof err === "string" ? err : (err?.message ?? "تعذّرت الطباعة"));
    } finally {
      setPrinting(false);
    }
  };

  /* Escape يغلق — النافذة ملءُ الشاشة فلا زرَّ ظاهراً دائماً */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    /*
      `sheet-preview-shell` على كل صندوقٍ بين جذر النافذة والورقة، و
      `sheet-preview-chrome` على ما ليس ورقة. وعند الطباعة يُبطَل الأوّل
      (موضعٌ ثابت وقصٌّ وتحويل) ويُخفى الثاني — وإلّا لقصَّت النافذةُ
      الورقةَ أو أزاحتها، لأنّ العنصر المطلق يُنسب إلى أقرب سلفٍ موضَّع.
    */
    <div className="sheet-preview-shell fixed inset-0 z-50">
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

          <button
            onClick={print}
            disabled={printing}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-[#04121c] transition hover:brightness-110 disabled:opacity-50"
            style={{ background: brand }}
          >
            {printing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            طباعة
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
          >
            <X className="h-4 w-4" />
            إغلاق
          </button>
        </header>

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
              المطبوع هو المعروض — اطبع ورقةً ثمّ اختر التي بعدها
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
          <span>A4 أفقية — 297 × 210 مم بمقاسها الحقيقي</span>
          <span>·</span>
          <span>
            {canPrintDirectly()
              ? "الطباعة مباشرة بلا حوار النظام — بمقاس المعاينة تماماً"
              : "خارج التطبيق: الطباعة تمرّ بحوار المتصفّح"}
          </span>
          <span className="ms-auto">
            {only === null
              ? pages > 1
                ? `${pages} أوراق ستُطبع`
                : "ورقة واحدة"
              : `الورقة ${only + 1} وحدها ستُطبع`}
          </span>
        </footer>
      </motion.div>
    </div>
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
