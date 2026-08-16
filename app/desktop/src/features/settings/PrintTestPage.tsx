import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  ImageOff,
  Printer,
  RotateCcw,
  Settings2,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { logoSpec } from "../../components/print/logo";
import {
  LANGS,
  PAPERS,
  SCALES,
  paperClass,
  printAreaStyle,
  readLang,
  readPaper,
  readScale,
  saveLang,
  savePaper,
  saveScale,
  silentPrintingAvailable,
  type PaperSize,
  type PrintLang,
  type TextScale,
} from "../../components/print/paper";
import { useSchoolStore } from "../../core/stores/school.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { Header, InvoiceDoc, ReceiptDoc } from "../../modules/finance/PrintDocs";
import { SAMPLE_INVOICE, SAMPLE_PAYMENT } from "../../modules/finance/sample-docs";

type DocKind = "invoice" | "receipt" | "probe";

const DOCS: { k: DocKind; label: string; hint: string }[] = [
  { k: "invoice", label: "الفاتورة", hint: "قالبها الحقيقي" },
  { k: "receipt", label: "الإيصال", hint: "دفعة بفاتورتين" },
  { k: "probe", label: "اختبار تقني", hint: "كثافة · حوافّ" },
];

/**
 * الطباعة — الإعدادات والمعاينة في شاشة واحدة.
 *
 * **إعدادات هذا الجهاز لا هذه المدرسة**: الورق والطابعة يخصّان الحاسوب
 * الذي أمامك، فتُحفظ محلياً ولا تُنسخ إلى غيره. أمّا ما يُطبع (الاسم
 * والشعار والملاحظات) فهو هوية المدرسة، ومكانه شاشة الهوية.
 *
 * والمعاينة هي `InvoiceDoc` و`ReceiptDoc` **نفسهما** بمعطيات تجريبية —
 * لا نسخةٌ عنهما. القالب الذي تراه هنا هو الذي يخرج عند أول فاتورة،
 * فتغييرٌ فيه لا يستطيع أن يترك هذه الشاشة تشهد لورقةٍ ماتت.
 */
export default function PrintTestPage() {
  const exitTo = useScreenExit();
  const navigate = useNavigate();

  const settings = useSchoolStore((s) => s.settings);
  const load = useSchoolStore((s) => s.load);

  /*
   * القيم المحفوظة تُقرأ في **مُهيّئ الحالة** لا في أثر: `localStorage`
   * متزامن ومتاح عند أول عرض، فقراءته في أثرٍ تعني رسمةً بقيمٍ
   * افتراضية ثمّ رسمةً تصحّحها — وميضٌ مرئيّ يُظهر «80 مم» ثمّ يقفز.
   */
  const [paper, setPaper] = useState<PaperSize>(readPaper);
  const [scale, setScale] = useState<TextScale>(readScale);
  const [lang, setLang] = useState<PrintLang>(readLang);

  const [kind, setKind] = useState<DocKind>("invoice");
  const [printed, setPrinted] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    load();
  }, [load]);

  /* الحفظ فوريّ لا بزرّ: ثلاث قيم ولا نصّ يُكتب، فلا مسوّدة تُجمع */
  const flash = () => {
    setSaved("حُفظ");
    window.setTimeout(() => setSaved(""), 1600);
  };

  const pickPaper = (v: PaperSize) => { setPaper(v); savePaper(v); flash(); };
  const pickScale = (v: TextScale) => { setScale(v); saveScale(v); flash(); };
  const pickLang = (v: PrintLang) => { setLang(v); saveLang(v); flash(); };

  const v = (k: string) => settings[k] ?? "";
  const brand = v("school.brand_color") || "#7dd3fc";
  const logo = logoSpec(settings);

  const doPrint = () => {
    setPrinted(true);
    /*
     * تأخير إطار واحد: بعض المتصفّحات تفتح حوار الطباعة قبل أن تُطبَّق
     * أصناف `.print-area` فتخرج الورقة بعرضٍ خاطئ.
     */
    window.setTimeout(() => window.print(), 60);
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="الطباعة" subtitle="إعدادات هذا الجهاز ومعاينة الورقة">
        <button
          onClick={() => exitTo(PATHS.settings)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto grid max-w-300 gap-6 p-6 lg:grid-cols-[1fr_400px]">
        {/* ================= الإعدادات ================= */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
          className="space-y-5"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-black">الطباعة</h2>
                <p className="mt-0.5 text-xs text-white/45">
                  إعدادات <b className="text-white/70">هذا الجهاز</b> — لا تُنسخ إلى
                  الأجهزة الأخرى.
                </p>
              </div>
              {saved && (
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-300">
                  ✓ {saved}
                </span>
              )}
            </div>

            <Group label="عرض الورق">
              {PAPERS.map((p) => (
                <Opt
                  key={p.key}
                  on={paper === p.key}
                  brand={brand}
                  title={p.label}
                  sub={p.hint}
                  onClick={() => pickPaper(p.key)}
                />
              ))}
            </Group>

            <Group label="حجم النصّ">
              {SCALES.map((s) => (
                <Opt
                  key={s.key}
                  on={scale === s.key}
                  brand={brand}
                  title={s.label}
                  sub={s.hint}
                  onClick={() => pickScale(s.key)}
                />
              ))}
            </Group>

            <Group label="لغة الطابعة">
              {LANGS.map((l) => (
                <Opt
                  key={l.key}
                  on={lang === l.key}
                  brand={brand}
                  title={l.label}
                  sub={l.hint}
                  onClick={() => pickLang(l.key)}
                />
              ))}
            </Group>
            <p className="-mt-2 mb-5 text-[11px] leading-relaxed text-white/40">
              اللغة الخطأ تُخرج ورقاً فارغاً أو رموزاً — الجهاز يفهم واحدةً فقط.
            </p>

            <div>
              <div className="mb-2 text-xs font-black text-white/60">
                الطابعات المكتشفة
              </div>
              {!silentPrintingAvailable ? (
                <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[11px] leading-relaxed text-white/40">
                  الطباعة الصامتة (إرسال الأوامر إلى الطابعة مباشرة) تحتاج نداءً
                  أصلياً من تطبيق سطح المكتب — غير مُفعّلة بعد. الطباعة الآن تمرّ
                  بنافذة ويندوز، وهي تعمل مع أي طابعة مثبَّتة بما فيها الحرارية،
                  فاختر فيها الطابعة وحجم الورق المطابقَين لما اخترته هنا.
                </p>
              ) : null}
            </div>
          </div>

          {/* الشعار — حالته هنا، وضبطه في شاشة الهوية */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-3 text-sm font-black text-white/70">شعار المؤسسة</h2>

            {logo.src ? (
              <div className="flex items-center gap-4">
                <div className="grid place-items-center rounded-xl bg-white p-3">
                  <img
                    src={logo.src}
                    alt=""
                    style={{ width: `${logo.widthMm}mm`, filter: logo.filter }}
                  />
                </div>
                <div className="flex-1 text-[11px] text-white/45">
                  عرض {logo.widthMm} مم · تباين {logo.contrast}% · وضوح {logo.clarity}%
                  <div className="mt-0.5 text-white/30">
                    يظهر أعلى كل فاتورة وإيصال
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-xs text-white/45">
                <ImageOff className="h-4 w-4 shrink-0" />
                لا شعار مرفوع — الترويسة تبدأ بالاسم
              </div>
            )}

            <button
              onClick={() => navigate(PATHS.settingsSchool)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold transition hover:bg-white/20"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {logo.src ? "تعديل الشعار وضبطه" : "رفع شعار"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={doPrint}
              className="flex items-center gap-2 rounded-xl px-6 py-3.5 font-black text-[#04121c] transition hover:brightness-110"
              style={{ background: brand }}
            >
              <Printer className="h-5 w-5" />
              طباعة تجريبية
            </button>

            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
              {DOCS.map((d) => (
                <button
                  key={d.k}
                  onClick={() => setKind(d.k)}
                  title={d.hint}
                  className="rounded-lg px-3 py-2 text-xs font-bold transition"
                  style={
                    kind === d.k
                      ? { background: `${brand}22`, color: brand }
                      : { color: "rgba(255,255,255,0.5)" }
                  }
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {printed && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-relaxed text-white/60"
            >
              <div className="mb-2 flex items-center gap-2 font-bold text-white">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                افحص الورقة الخارجة
              </div>
              <ul className="list-inside list-disc space-y-1">
                <li>هل ظهرت العربية كاملة غير مقلوبة؟</li>
                <li>هل المبالغ بترتيبها الصحيح لا معكوسة؟</li>
                <li>هل أعمدة الجدول داخل الورقة بلا قصّ؟</li>
                {logo.src && <li>هل الشعار حادّ الحوافّ لا بقعة سوداء ولا باهتاً؟</li>}
                <li>هل الباركود مقروء بالماسح؟</li>
                <li>هل النصّ بحجم مريح؟ إن صغر فارفع «حجم النصّ».</li>
              </ul>
              <button
                onClick={() => setPrinted(false)}
                className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40 transition hover:text-white"
              >
                <RotateCcw className="h-3 w-3" />
                إخفاء
              </button>
            </motion.div>
          )}
        </motion.div>

        {/* ================= المعاينة ================= */}
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: MOTION.duration.normal, delay: 0.06, ease: MOTION.easing.enter }}
          className="lg:sticky lg:top-6 lg:self-start"
        >
          <div className="mb-2 text-xs text-white/40">
            المعاينة — هذا ما سيُطبع بالضبط
          </div>

          <div className="max-h-[76vh] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex justify-center">
              <div
                className={paperClass(paper)}
                style={printAreaStyle(paper, scale)}
              >
                {kind === "invoice" && <InvoiceDoc invoice={SAMPLE_INVOICE} />}
                {kind === "receipt" && <ReceiptDoc payment={SAMPLE_PAYMENT} />}
                {kind === "probe" && <ProbeSheet />}
              </div>
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}

// --------------------------------------------------
// قطع الواجهة
// --------------------------------------------------

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2 text-xs font-black text-white/60">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Opt({
  on, brand, title, sub, onClick,
}: {
  on: boolean;
  brand: string;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="min-w-27 flex-1 rounded-xl border px-4 py-2.5 text-center transition"
      style={
        on
          ? { borderColor: `${brand}88`, background: `${brand}14` }
          : { borderColor: "rgba(255,255,255,0.1)" }
      }
    >
      <div className="text-sm font-black" style={{ color: on ? brand : undefined }}>
        {title}
      </div>
      <div className="text-[11px] text-white/40">{sub}</div>
    </button>
  );
}

// --------------------------------------------------
// الاختبار التقني — يقيس الطابعة لا المستند
// --------------------------------------------------

const rcp = (n: number) => `calc(var(--rcp, 3.5mm) * ${n})`;

function ProbeSheet() {
  const stamp = new Date().toLocaleString("fr-DZ", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div
      className="receipt-card bg-white px-2 py-2 text-center text-black"
      style={{ fontFamily: '"Tahoma","Arial",sans-serif' }}
    >
      <Header title="اختبار تقني للطابعة" />

      <div
        className="mt-2 flex flex-col gap-1 border-t border-black pt-1.5 text-right"
        style={{ fontSize: rcp(1) }}
      >
        <div className="flex justify-between">
          <span>التاريخ والوقت :</span>
          <span dir="ltr">{stamp}</span>
        </div>
        <div className="flex justify-between">
          <span>سطر مختلط :</span>
          <span>الفوج A-12 · 1 500.00 دج</span>
        </div>
      </div>

      {/* تدرّج الكثافة: يكشف ضعف الحرارة أو الحبر */}
      <div
        className="mt-2 flex items-center justify-between gap-2 border-t border-black pt-2"
        style={{ fontSize: rcp(0.91) }}
      >
        <span>تدرّج الكثافة</span>
        <span className="flex gap-0.5">
          {["#000", "#444", "#888", "#bbb"].map((c) => (
            <span
              key={c}
              style={{
                width: "6mm",
                height: "3mm",
                background: c,
                printColorAdjust: "exact",
                WebkitPrintColorAdjust: "exact",
              }}
            />
          ))}
        </span>
      </div>

      {/* مسطرة الحوافّ: تكشف القصّ والهامش */}
      <div className="mt-1 tracking-widest" style={{ fontSize: rcp(0.8) }} dir="ltr">
        |----+----|----+----|----+----|
      </div>

      {/* خطوط رفيعة: تكشف فقد الأسطر الدقيقة على الحراري */}
      <div className="mt-2">
        {[0.1, 0.2, 0.3, 0.5].map((w) => (
          <div key={w} style={{ borderTop: `${w}mm solid #000`, marginBottom: "1.5mm" }} />
        ))}
      </div>

      {/* جدول بأضيق أعمدة: يكشف انهيار التخطيط على 72 مم */}
      <table
        className="mt-1 w-full table-fixed border-collapse"
        style={{ fontSize: rcp(1) }}
      >
        <tbody>
          <tr>
            <td className="border border-black px-1 py-1 text-right wrap-anywhere">
              اسم مادة طويل جداً لاختبار الالتفاف
            </td>
            <td className="border border-black px-1 py-1 tabular-nums" dir="ltr">
              10/2026
            </td>
            <td className="border border-black px-1 py-1 font-bold tabular-nums">
              12 500.00
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-2 border-t border-black pt-1.5" style={{ fontSize: rcp(0.91) }}>
        إن اختفى أرفع خط أو بهت أغمق مربّع، فالمشكلة في الطابعة لا في النموذج
      </div>
    </div>
  );
}
