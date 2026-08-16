import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { AlertTriangle, Loader2, Printer, RefreshCw, X, Zap } from "lucide-react";

import { MOTION } from "../../motion/system";
import { useSchoolStore } from "../../core/stores/school.store";
import {
  canPrintDirectly,
  defaultPrinter,
  listPrinters,
  mmToIn,
  printDirect,
  readPrinter,
  savePrinter,
} from "./native-print";
import type { Raster } from "./escpos";
import {
  listUsbPrinters,
  rasterizeReceipt,
  sendRaster,
  thermalReady,
} from "./thermal-print";
import {
  PAPERS,
  SCALES,
  paperClass,
  paperSpec,
  printAreaStyle,
  readPaper,
  readScale,
  savePaper,
  saveScale,
  type PaperSize,
  type TextScale,
} from "./paper";

export type { PaperSize, TextScale };

/**
 * نافذة معاينة الطباعة — مشتركة بين الفاتورة والإيصال.
 *
 * الغرض أن يرى المستخدم **ما سيخرج بالضبط** قبل أن يخرج: الورق الحراري
 * ضيّق والأخطاء فيه لا تُكتشف إلّا بعد إتلاف ورقة. فالمعاينة بنفس عرض
 * الورق المختار حرفياً لا تقريباً.
 *
 * **والطباعة مباشرة بلا حوار ويندوز** — كما في أوراق الكشوف. وحوار
 * النظام لم يكن مجرّد نقرتين زائدتين: يطبع بإعداداته هو، فيُصغّر
 * الورقة «لتناسب» الصفحة ويكتب في الهامش عنوان النافذة والرابط
 * والتاريخ — فيخرج الإيصال غير الذي عاينه المستخدم. والأمر الأصلي
 * يفرض مقاس الورق المختار وتصغيراً 1.0 وهوامش صفر وبلا ترويسة.
 *
 * ومقاس الصفحة يُحسب من الورقة المعروضة نفسِها: عرضُ الورق بالمليمتر،
 * وطولُه بطول المعروض — فالشريط الحراري لا يخرج بطول A4 أكثرُه أبيض.
 *
 * ويبقى حوار ويندوز مخرجاً عند الفشل (طابعة مطفأة، أو WebView2 قديمة)،
 * وهو أيضاً ما يعمل في المتصفّح أثناء التطوير.
 *
 * ⚠️ الطباعة بلغة الطابعة الحرارية (ESC/POS) شيءٌ آخر غير منفَّذ —
 * انظر `silentPrintingAvailable` في paper.ts.
 */

export interface PrintDoc {
  /** يظهر في ترويسة النافذة */
  title: string;
  /**
   * محتوى الورقة.
   *
   * لا يتلقّى مقاساً: المستند كلّه مضاعفاتٌ لـ`--rcp` التي تُضبط على
   * ‏`.print-area` هنا. تمرير رقم بالبكسل كان يُكتب ولا يُقرأ عند
   * الطباعة لأنّ قواعد `@media print` تفرض المليمتر بـ`!important`.
   */
  render: (ctx: { paper: PaperSize }) => ReactNode;
  /** يُستدعى بعد إرسال الأمر إلى الطابعة (لتعليم الإيصال مطبوعاً) */
  onPrinted?: () => Promise<void> | void;
}

export function PrintPreview({ doc, onClose }: { doc: PrintDoc; onClose: () => void }) {
  const settings = useSchoolStore((s) => s.settings);
  const brand = settings["school.brand_color"] || "#7dd3fc";

  /* القراءة محصَّنة: قيمة قديمة في التخزين لا تُسقط الشاشة — انظر paper.ts */
  const [paper, setPaper] = useState<PaperSize>(readPaper);
  const [scale, setScale] = useState<TextScale>(readScale);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => savePaper(paper), [paper]);
  useEffect(() => saveScale(scale), [scale]);

  const spec = paperSpec(paper);

  /* الورقة المعروضة — منها يُقاس طول ما سيُطبع */
  const sheetRef = useRef<HTMLDivElement>(null);

  // --------------------------------------------------
  // الطابعة — لكلّ ورقٍ طابعتُه
  //
  // المكتب فيه طابعتان: كانون A4 وحرارية 80 مم. فالاختيار يُحفظ
  // **باسم الورق**: يُختار الحراري مرّة للإيصالات فيبقى لها، والكانون
  // للA4 فيبقى لها — بلا إعادة اختيارٍ في كل ورقة.
  //
  // والمحفوظة تُقبل إن كانت ما تزال مثبَّتة، وإلّا فافتراضية النظام:
  // طابعةٌ حُذفت لا تبقى مختارةً بصمت ثمّ تفشل الطباعة عليها بعد أن
  // يكون المستخدم انصرف ظانّاً أنّ الورقة خرجت.
  // --------------------------------------------------

  const [printers, setPrinters] = useState<string[]>([]);
  const [printer, setPrinter] = useState("");
  const [loadingPrinters, setLoadingPrinters] = useState(canPrintDirectly());

  const loadPrinters = useCallback(async () => {
    if (!canPrintDirectly()) return;

    setLoadingPrinters(true);
    try {
      const [names, fallback] = await Promise.all([listPrinters(), defaultPrinter()]);

      setPrinters(names);

      const saved = readPrinter(paper);
      setPrinter(saved && names.includes(saved) ? saved : fallback);
    } finally {
      setLoadingPrinters(false);
    }
  }, [paper]);

  useEffect(() => {
    loadPrinters();
  }, [loadPrinters]);

  // --------------------------------------------------
  // الطباعة الحرارية الفورية — ESC/POS إلى المنفذ
  //
  // تُستعمل حين تجتمع ثلاثة: ورقٌ حراري، وثنائيّةٌ تعرف الأوامر، وجهازٌ
  // مفتوحٌ للكتابة. وإلّا فالطريق الأوّل (WebView2) — يعمل على كل طابعة.
  //
  // والتنقيط يجري **بينما ينظر المستخدم إلى المعاينة**: هو نصف الزمن،
  // وتقديمُه يجعل الضغطة إرسالاً محضاً.
  // --------------------------------------------------

  const [usbDevices, setUsbDevices] = useState<string[]>([]);
  const [thermalOk, setThermalOk] = useState(false);
  const [raster, setRaster] = useState<Raster | null>(null);
  const [preparing, setPreparing] = useState(false);

  const thermalPaper = paper !== "A4";
  const instant = thermalOk && thermalPaper && usbDevices.length > 0;

  useEffect(() => {
    let alive = true;

    Promise.all([thermalReady(), listUsbPrinters()]).then(([ready, devices]) => {
      if (!alive) return;
      setThermalOk(ready);
      setUsbDevices(devices);
    });

    return () => {
      alive = false;
    };
  }, []);

  /* التنقيط المسبق — ويُعاد كلّما تغيّر ما يُرسم أو مقاسه */
  useEffect(() => {
    setRaster(null);

    if (!instant || !sheetRef.current) return;

    let alive = true;
    const el = sheetRef.current;

    /* مهلةٌ قصيرة: الورقة تُعاد رسمتها بعد تغيير الورق أو حجم النصّ */
    const timer = window.setTimeout(async () => {
      setPreparing(true);
      try {
        const prepared = await rasterizeReceipt(el, paper === "72mm" ? "72mm" : "80mm");
        if (alive) setRaster(prepared);
      } catch {
        /* يُعاد عند الضغط — والفشل هناك يُعرض برسالته */
      } finally {
        if (alive) setPreparing(false);
      }
    }, 120);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [instant, paper, scale, doc]);

  /**
   * مقاس الصفحة للطباعة المباشرة.
   *
   * الحراري: عرضُه عرضُ الورق، وطولُه طولُ المعروض. والقياس بالبكسل
   * يصحّ هنا لأنّ CSS تعرّف المليمتر بـ96/25.4 بكسل، والمعاينة تُرسم
   * بمقاييس المليمتر نفسها التي تفرضها قواعد الطباعة — فـ302 بكسل هي
   * 80 مم حرفياً. ويُزاد 4 مم في الذيل حتى لا يُقصّ آخر سطر.
   *
   * وA4 يُترك للافتراض في الجانب الأصلي.
   */
  const pageSize = () => {
    if (paper === "A4") return undefined;

    const heightPx = sheetRef.current?.offsetHeight ?? 0;
    const heightMm = heightPx / (96 / 25.4) + 4;

    return {
      widthIn: mmToIn(spec.mm),
      heightIn: mmToIn(Math.max(heightMm, 40)),
    };
  };

  const print = async () => {
    setFailure(null);

    if (!canPrintDirectly()) {
      /*
       * إطارٌ قبل حوار النظام: المتصفّح قد يفتحه قبل تطبيق أصناف
       * `.print-area` فتخرج الورقة بعرضٍ خاطئ. والطباعة المباشرة لا
       * تحتاجه — الورقة مرسومةٌ منذ فُتحت المعاينة، والانتظار تأخيرٌ
       * محض في عملٍ يتكرّر عشرات المرّات في اليوم.
       */
      await new Promise((r) => setTimeout(r, 80));
      window.print();
      await doc.onPrinted?.();
      return;
    }

    setBusy(true);
    try {
      /*
       * الطريق الفوريّ أوّلاً حين يتوفّر شرطُه.
       *
       * وإن فشل لم نرتدّ إلى السائق صامتين: الفشل هنا يعني عتاداً —
       * طابعة مطفأة أو منفذاً مشغولاً — والارتدادُ يُخرج الورقة من
       * طابعةٍ أخرى وقد ظنّ المستخدم أنّها خرجت من الحرارية. تُعرض
       * الرسالة ويبقى القرار له.
       */
      if (instant) {
        const ready =
          raster ?? (await rasterizeReceipt(sheetRef.current!, paper === "72mm" ? "72mm" : "80mm"));

        await sendRaster(ready, usbDevices[0]);
      } else if (thermalPaper) {
        /*
         * ورقٌ حراريّ بلا طريقٍ مباشر — يُرفض ولا يُرسل إلى السائق.
         *
         * كان يرتدّ إلى `printDirect` صامتاً، فيُسلَّم إلى مخزن ويندوز
         * **صفحةٌ مرسومة** لطابعةٍ حرارية لا تفهم إلّا ESC/POS. فتُخرج
         * الورقة الأولى شيئاً مقبولاً ثمّ تُفسَّر بقيةُ البايتات نصّاً
         * في صفحة ترميز الطابعة — وهي صينيةٌ في هذا الطراز — فتنهال
         * حروفٌ لا معنى لها والبكرة لا تقف. وتبقى المهمّة في الطابور
         * بحالة `Error, Retained` تُعيد المحاولة من نفسها.
         *
         * والارتدادُ الصامت خطأٌ في ذاته: المستخدم ظنّ أنّه يطبع إيصالاً
         * حرارياً فوريّاً، فخرج من طريقٍ آخر بنتيجةٍ أخرى. والرسالة هنا
         * تقول له ما ينقص بدل أن تُهدر ورقه.
         */
        throw new Error(
          !thermalOk
            ? "الطباعة الحرارية غير متاحة في هذه النسخة من التطبيق — أعِد بناءها."
            : "لم يُعثر على طابعة حرارية موصولة مباشرةً. " +
              "الإيصال لا يُطبع عبر سائق ويندوز: الطابعة الحرارية لا تفهم الصفحة المرسومة فتُخرج رموزاً وتستهلك الورق. " +
              "تحقّق من توصيل الطابعة وتشغيلها، أو اطبع بمقاس A4.",
        );
      } else {
        await printDirect(printer, false, pageSize());
      }

      await doc.onPrinted?.();
    } catch (err: any) {
      setFailure(typeof err === "string" ? err : (err?.message ?? "تعذّرت الطباعة"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* الحجاب لا يُطبع — خارج .print-area */}
      <div onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: MOTION.duration.fast, ease: MOTION.easing.enter }}
        className="absolute inset-4 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0f1a] md:inset-x-[8%] md:inset-y-[5%]"
      >
        <header
          className="flex items-center gap-3 px-6 py-4"
          style={{ background: `linear-gradient(120deg, ${brand}22, transparent)` }}
        >
          <Printer className="h-5 w-5" style={{ color: brand }} />
          <h2 className="flex-1 text-lg font-black">{doc.title}</h2>
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
          >
            <X className="h-4 w-4" />
            إغلاق
          </button>
        </header>

        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[300px_1fr]">
          {/* ================= التحكّم ================= */}
          <aside className="space-y-5 overflow-y-auto border-e border-white/10 p-5">
            {/*
              الطابعة أوّلاً — لا في ذيل اللوحة.

              هي القرار الأوّل في مكتبٍ فيه طابعتان: الإيصال إلى الحراري
              والكشف إلى الكانون. وكانت أسفل «نوع الورق» و«حجم النصّ»
              فتقع تحت الطيّة، فيبدو أنّ الحرارية غير موجودة أصلاً.
            */}
            {/*
              الطريق الفوريّ يُعلَن لا يُخمَّن.

              المستخدم يسأل «لماذا خرج هذا الإيصال في ربع ثانية وذاك في
              ثانيتين؟» — والفرق طريقٌ لا مزاج. فيُكتب أيّهما سيعمل
              وسببُ تعذّر الأسرع إن تعذّر.
            */}
            {canPrintDirectly() && thermalPaper && (
              <section
                className="rounded-xl border px-4 py-3"
                style={
                  instant
                    ? { borderColor: "rgba(134,239,172,0.3)", background: "rgba(134,239,172,0.08)" }
                    : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }
                }
              >
                <div className="flex items-center gap-2">
                  <Zap
                    className="h-4 w-4 shrink-0"
                    style={{ color: instant ? "#86efac" : "rgba(255,255,255,0.35)" }}
                  />
                  <h3 className="text-xs font-black" style={{ color: instant ? "#86efac" : "rgba(255,255,255,0.6)" }}>
                    {instant ? "طباعة فورية — ESC/POS" : "طباعة عبر سائق ويندوز"}
                  </h3>
                </div>

                <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
                  {instant
                    ? preparing
                      ? "يجري تحضير الإيصال… والضغطة بعده إرسالٌ محض."
                      : raster
                        ? "الإيصال محضَّر — تخرج الورقة فور الضغط، بلا مخزن ولا سائق."
                        : "البايتات تُرسَل إلى الطابعة رأساً، فتتحرّك الورقة أثناء وصولها."
                    : !thermalOk
                      ? "الثنائيّة الحالية لا تعرف الطباعة الحرارية — أعد بناء التطبيق."
                      : "لم يُعثر على طابعة حرارية على منفذ USB — ستُطبع عبر السائق."}
                </p>
              </section>
            )}

            {canPrintDirectly() && (
              <section>
                <div className="mb-2.5 flex items-center gap-2">
                  <h3 className="flex-1 text-sm font-black text-white/70">الطابعة</h3>
                  <button
                    onClick={loadPrinters}
                    disabled={loadingPrinters}
                    title="أعد قراءة الطابعات المثبَّتة"
                    className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 transition hover:bg-white/20 disabled:opacity-40"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingPrinters ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {printers.length > 0 ? (
                  <>
                    <select
                      value={printer}
                      onChange={(e) => {
                        setPrinter(e.target.value);
                        savePrinter(e.target.value, paper);
                      }}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-bold outline-none transition focus:border-white/30"
                    >
                      {printers.map((name) => (
                        <option key={name} value={name} className="bg-[#0a0f1a]">
                          {name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">
                      محفوظةٌ لورق {spec.label} وحده — فلكلّ ورقٍ طابعتُه.
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] leading-relaxed text-amber-200/70">
                    {loadingPrinters
                      ? "جارٍ قراءة الطابعات…"
                      : "لم يُعثر على طابعات مثبَّتة — تحقّق من تعريفها في ويندوز ثمّ أعد القراءة."}
                  </p>
                )}
              </section>
            )}

            <section>
              <h3 className="mb-2.5 text-sm font-black text-white/70">نوع الورق</h3>
              <div className="space-y-2">
                {PAPERS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPaper(p.key)}
                    className="flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-right transition"
                    style={
                      paper === p.key
                        ? { borderColor: `${brand}77`, background: `${brand}14` }
                        : { borderColor: "rgba(255,255,255,0.1)" }
                    }
                  >
                    <span
                      className="grid h-4 w-4 shrink-0 place-items-center rounded-full border"
                      style={{ borderColor: paper === p.key ? brand : "rgba(255,255,255,0.3)" }}
                    >
                      {paper === p.key && (
                        <span className="h-2 w-2 rounded-full" style={{ background: brand }} />
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-bold">{p.label}</span>
                      <span className="block text-[11px] text-white/40">{p.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2.5 text-sm font-black text-white/70">حجم النصّ المطبوع</h3>
              <div className="space-y-2">
                {SCALES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setScale(s.key)}
                    className="w-full rounded-xl border px-4 py-2.5 text-right transition"
                    style={
                      scale === s.key
                        ? { borderColor: `${brand}77`, background: `${brand}14` }
                        : { borderColor: "rgba(255,255,255,0.1)" }
                    }
                  >
                    <span className="block text-sm font-bold">{s.label}</span>
                    <span className="block text-[11px] text-white/40">{s.hint}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="mb-1.5 text-xs font-black text-white/70">
                هذه الخيارات تُحفظ لهذا الجهاز
              </h3>
              <p className="text-[11px] leading-relaxed text-white/45">
                ما تختاره هنا هو نفسه المحفوظ في الإعدادات ← الطباعة، فلا
                تُضبط مرّتين.{" "}
                {canPrintDirectly()
                  ? "والورقة تخرج مباشرةً إلى الطابعة المختارة بمقاس الورق نفسِه — بلا حوار ويندوز ولا تصغير."
                  : "وخارج البرنامج (متصفّح التطوير) تمرّ الطباعة بحوار النظام."}
              </p>
            </section>
          </aside>

          {/* ================= المعاينة ================= */}
          <main className="overflow-y-auto bg-[#0d1420] p-6">
            <div className="mb-3 text-center text-xs text-white/40">
              معاينة — {spec.label}
            </div>

            <div className="flex justify-center">
              {/*
                لا غلاف `receipt-card` هنا: المستند يحمله بنفسه، فلو
                لُفّ مرّة أخرى لتضاعفت الحشوة وضاق العمود على 72 مم.
              */}
              <div
                ref={sheetRef}
                className={paperClass(paper)}
                style={printAreaStyle(paper, scale)}
              >
                {doc.render({ paper })}
              </div>
            </div>
          </main>
        </div>

        {/* فشلُ الطباعة المباشرة لا يترك المستخدم بلا مخرج — حوار النظام باقٍ */}
        {failure && (
          <div className="flex flex-wrap items-center gap-3 border-t border-rose-400/20 bg-rose-500/10 px-6 py-3 text-xs text-rose-100">
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

        <footer className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
          <button
            onClick={print}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl px-6 py-3 font-black text-[#04121c] transition hover:brightness-110 disabled:opacity-50"
            style={{ background: brand }}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
            {canPrintDirectly() ? "طباعة" : "طباعة عبر نافذة ويندوز"}
          </button>

          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
          >
            إلغاء
          </button>

          <span className="ms-auto text-[11px] text-white/35">
            {!canPrintDirectly()
              ? "تأكّد من اختيار الطابعة الصحيحة وحجم الورق في نافذة النظام"
              : instant
                ? `تخرج على ${spec.label} من الطابعة الحرارية مباشرةً`
                : `تخرج على ${spec.label} من ${printer || "الطابعة الافتراضية"}`}
          </span>
        </footer>
      </motion.div>
    </div>
  );
}
