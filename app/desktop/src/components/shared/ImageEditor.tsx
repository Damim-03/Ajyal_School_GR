import { useCallback, useEffect, useRef, useState } from "react";
import {
  Crop,
  Loader2,
  RotateCcw,
  RotateCw,
  Save,
  SlidersHorizontal,
  ZoomIn,
} from "lucide-react";

import { FormDialog } from "./FormDialog";

/**
 * محرّر الصورة — قصٌّ وتدويرٌ وضبطٌ قبل الرفع.
 *
 * لأنّ ما يدخل النظام لا يُصلَح بعده: صورةُ الهوية تُصوَّر بالهاتف مائلةً
 * وحولها طاولة، والوثيقة تخرج من الماسح مقلوبةً أو باهتة. فتُطبع البطاقة
 * بوجهٍ في زاوية الإطار، أو تُحفظ شهادةٌ لا تُقرأ. والتصحيح هنا أرخص من
 * إعادة التصوير أو المسح.
 *
 * **إطارٌ ثابت والصورة تتحرّك خلفه** — لا مستطيلُ قصٍّ يُسحب بأركانه.
 * الأركان تحتاج ثمانيةَ مقابض ومنطقَ حدودٍ لكلٍّ منها، وتُخرج نسبةً
 * عشوائية بينما صورة البطاقة نسبتُها 3:4 مفروضة. والإطار الثابت يجعل
 * النسبة صحيحةً بالبناء، ويترك للمستخدم ما يهمّه فعلاً: أين يقع الوجه
 * داخل الإطار وبأيّ تقريب.
 *
 * والمعاينة تُرسم على لوحٍ لا بـCSS: المخرَج يُرسم بالتحويلات نفسها على
 * لوحٍ ثانٍ، فما يُرى هو ما يُحفظ بالبكسل — لا تقريبٌ يفاجئ عند الطباعة.
 */

export type AspectKey = "3:4" | "1:1" | "a4" | "free";

const ASPECTS: { key: AspectKey; label: string; ratio: number | null }[] = [
  { key: "3:4", label: "صورة 3:4", ratio: 3 / 4 },
  { key: "1:1", label: "مربّع", ratio: 1 },
  { key: "a4", label: "وثيقة A4", ratio: 210 / 297 },
  { key: "free", label: "الصورة كاملة", ratio: null },
];

/** أقصى بُعدٍ للمخرَج — صفحةٌ ممسوحة بدقّة 600 تبلغ خمسة آلاف بكسل بلا داعٍ */
const MAX_OUTPUT = 2000;

interface View {
  /** بكسل معاينةٍ لكل بكسل صورة */
  scale: number;
  /** إزاحة مركز الصورة عن مركز الإطار، بوحدات المعاينة */
  x: number;
  y: number;
}

export function ImageEditor({
  file,
  aspect: initialAspect = "free",
  title = "تعديل الصورة",
  busy = false,
  onCancel,
  onDone,
}: {
  file: File;
  aspect?: AspectKey;
  title?: string;
  /** انشغالُ الرفع — يملكه الأب لأنّه هو من يرفع */
  busy?: boolean;
  onCancel: () => void;
  onDone: (edited: File) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [aspect, setAspect] = useState<AspectKey>(initialAspect);
  const [quarter, setQuarter] = useState(0); // عدد أرباع الدورة
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  /* ===== تحميل الصورة من الملف ===== */
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => setImage(img);
    img.onerror = () => setError("تعذّر قراءة الصورة — الملفّ تالف أو ليس صورة");
    img.src = url;

    return () => URL.revokeObjectURL(url);
  }, [file]);

  /* ===== قياس مساحة المعاينة ===== */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const measure = () =>
      setStage({ w: el.clientWidth, h: el.clientHeight });

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [image]);

  /*
   * الصورة بعد التدوير — مصدرُ كل الحسابات بعدها.
   *
   * التدوير يُطبَّق مرّةً على لوحٍ منفصل بدل أن يدخل في مصفوفة الرسم
   * كلَّ إطار: بذلك يبقى حساب التصغير والإزاحة في مستوًى واحد بلا زوايا،
   * ويصير عرض الصورة وارتفاعُها بعد الدوران قيمتين مقروءتين لا مقلوبتين
   * بشرطٍ في كل سطر.
   */
  const rotated = useRotated(image, quarter);

  const ratio = ASPECTS.find((a) => a.key === aspect)!.ratio;

  /** الإطار داخل مساحة المعاينة — أكبرُ ما يدخل فيها بهذه النسبة */
  const frame = frameOf(stage, ratio, rotated);

  /** أصغرُ تصغيرٍ يملأ الإطار — دونه تظهر فجوةٌ بيضاء في المخرَج */
  const minScale =
    rotated && frame.w > 0
      ? Math.max(frame.w / rotated.width, frame.h / rotated.height)
      : 1;

  /* ===== إعادة الضبط عند تبدّل الصورة أو النسبة أو الدوران ===== */
  useEffect(() => {
    setView({ scale: minScale, x: 0, y: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotated, aspect, frame.w, frame.h]);

  /* ===== الرسم ===== */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rotated || stage.w === 0) return;

    /* دقّة الشاشة: لوحٌ بمقاس CSS وحده يبدو ضبابياً على شاشةٍ مضاعفة */
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = stage.w * dpr;
    canvas.height = stage.h * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, stage.w, stage.h);

    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    drawImage(ctx, rotated, frame, view);
    ctx.filter = "none";

    /* تعتيمُ ما خارج الإطار — يقول أين يقع القصّ بلا شرح */
    ctx.fillStyle = "rgba(3,6,12,0.72)";
    ctx.beginPath();
    ctx.rect(0, 0, stage.w, stage.h);
    ctx.rect(frame.x, frame.y, frame.w, frame.h);
    ctx.fill("evenodd");

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(frame.x + 0.75, frame.y + 0.75, frame.w - 1.5, frame.h - 1.5);

    /* أثلاثٌ خفيفة — قاعدةُ التأطير التي يعرفها كل مصوّر */
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      const x = frame.x + (frame.w * i) / 3;
      const y = frame.y + (frame.h * i) / 3;
      ctx.beginPath();
      ctx.moveTo(x, frame.y);
      ctx.lineTo(x, frame.y + frame.h);
      ctx.moveTo(frame.x, y);
      ctx.lineTo(frame.x + frame.w, y);
      ctx.stroke();
    }
  }, [rotated, stage, frame, view, brightness, contrast]);

  /* ===== السحب والتقريب ===== */
  const drag = useRef<{ x: number; y: number } | null>(null);

  const clamp = useCallback(
    (next: View): View => {
      if (!rotated) return next;

      const scale = Math.max(minScale, Math.min(next.scale, minScale * 8));

      /* أقصى إزاحةٍ تُبقي الإطار مملوءاً — نصفُ الفائض عن كل جانب */
      const maxX = Math.max(0, (rotated.width * scale - frame.w) / 2);
      const maxY = Math.max(0, (rotated.height * scale - frame.h) / 2);

      return {
        scale,
        x: Math.max(-maxX, Math.min(next.x, maxX)),
        y: Math.max(-maxY, Math.min(next.y, maxY)),
      };
    },
    [rotated, minScale, frame.w, frame.h],
  );

  const zoomTo = (scale: number) =>
    setView((v) => clamp({ ...v, scale }));

  /* ===== الحفظ ===== */
  const save = () => {
    if (!rotated) return;

    const output = document.createElement("canvas");

    /* المخرَج بدقّة الصورة الأصلية داخل الإطار، لا بدقّة المعاينة:
       المعاينة عرضُها بضع مئات من البكسلات، والحفظ بها يُتلف صورةً
       جاءت من ماسحٍ بدقّة 300 */
    const sourceW = frame.w / view.scale;
    const sourceH = frame.h / view.scale;
    const cap = Math.min(1, MAX_OUTPUT / Math.max(sourceW, sourceH));

    output.width = Math.max(1, Math.round(sourceW * cap));
    output.height = Math.max(1, Math.round(sourceH * cap));

    const ctx = output.getContext("2d");
    if (!ctx) {
      setError("تعذّر تجهيز الصورة للحفظ");
      return;
    }

    /* خلفيةٌ بيضاء: JPEG بلا قناة شفافية، وPNG شفاف يخرج أسودَ بدونها */
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, output.width, output.height);

    /*
     * التحويل يُترجَم من فضاء المعاينة إلى فضاء المخرَج، ولا يُنقل كما هو.
     *
     * `view.scale` بكسلُ معاينةٍ لكل بكسل صورة، والمخرَج يريد بكسلَ
     * مخرَجٍ لكل بكسل صورة — وهو `cap` وحده. ونقلُ `view.scale` كما هو
     * كان يرسم الصورة بحجم المعاينة داخل لوحٍ بحجم الصورة: أشرطةٌ بيضاء
     * حول قصٍّ لا يطابق ما رآه المستخدم في الإطار.
     *
     * والإزاحة بالنسبة نفسِها (`cap / view.scale`): هي مقيسةٌ ببكسلات
     * المعاينة، فتُضرب بعدد بكسلات المخرَج لكلٍّ منها.
     */
    const k = cap / view.scale;

    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    drawImage(
      ctx,
      rotated,
      { x: 0, y: 0, w: output.width, h: output.height },
      { scale: cap, x: view.x * k, y: view.y * k },
    );

    output.toBlob(
      (blob) => {
        if (!blob) {
          setError("تعذّر تجهيز الصورة للحفظ");
          return;
        }

        const name = file.name.replace(/\.[^.]+$/, "") || "صورة";
        onDone(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  };

  const zoomPercent = Math.round((view.scale / minScale) * 100);

  return (
    <FormDialog
      icon={Crop}
      title={title}
      subtitle="حرّك الصورة داخل الإطار، وقرّبها بعجلة الفأرة"
      tone="#7dd3fc"
      width="lg"
      onClose={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      busy={busy}
      submitDisabled={!rotated}
      submitLabel="حفظ الصورة"
      submitIcon={<Save className="h-4.5 w-4.5" />}
      error={error}
    >
      {/* ===== النسبة ===== */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-white/45">الإطار:</span>
        {ASPECTS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setAspect(option.key)}
            className="rounded-lg border px-3 py-1.5 text-xs font-bold transition"
            style={
              aspect === option.key
                ? { borderColor: "#7dd3fc", background: "#7dd3fc1f", color: "#7dd3fc" }
                : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }
            }
          >
            {option.label}
          </button>
        ))}

        <div className="ms-auto flex items-center gap-1.5">
          <button
            type="button"
            title="تدوير لليسار"
            onClick={() => setQuarter((q) => (q + 3) % 4)}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 transition hover:bg-white/20"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="تدوير لليمين"
            onClick={() => setQuarter((q) => (q + 1) % 4)}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 transition hover:bg-white/20"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ===== المعاينة ===== */}
      <div
        ref={stageRef}
        className="relative h-90 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40"
        style={{ cursor: rotated ? "grab" : "default", touchAction: "none" }}
        onPointerDown={(e) => {
          if (!rotated) return;
          drag.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.style.cursor = "grabbing";
        }}
        onPointerMove={(e) => {
          const start = drag.current;
          if (!start) return;

          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          drag.current = { x: e.clientX, y: e.clientY };

          setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
        }}
        onPointerUp={(e) => {
          drag.current = null;
          e.currentTarget.style.cursor = "grab";
        }}
        onWheel={(e) => {
          if (!rotated) return;
          /* خطوةٌ ضربية لا جمعية — التقريب يبدو خطّياً للعين بها وحدها */
          setView((v) => clamp({ ...v, scale: v.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12) }));
        }}
      >
        {!image && !error && (
          <div className="grid h-full place-items-center text-white/40">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          style={{ display: image ? "block" : "none" }}
        />
      </div>

      {/* ===== الضبط ===== */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Slider
          icon={<ZoomIn className="h-3.5 w-3.5" />}
          label="التقريب"
          value={zoomPercent}
          suffix="٪"
          min={100}
          max={800}
          onChange={(percent) => zoomTo((percent / 100) * minScale)}
        />
        <Slider
          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          label="السطوع"
          value={brightness}
          suffix="٪"
          min={50}
          max={160}
          onChange={setBrightness}
        />
        <Slider
          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          label="التباين"
          value={contrast}
          suffix="٪"
          min={50}
          max={200}
          onChange={setContrast}
        />
      </div>

      <button
        type="button"
        onClick={() => {
          setQuarter(0);
          setBrightness(100);
          setContrast(100);
          setView({ scale: minScale, x: 0, y: 0 });
        }}
        className="mt-3 text-[11px] font-bold text-white/40 transition hover:text-white/70"
      >
        إعادة الضبط
      </button>
    </FormDialog>
  );
}

// --------------------------------------------------
// الرسم — دالّةٌ واحدة تخدم المعاينة والمخرَج معاً
//
// نسختان منها كانتا ستفترقان بمقدار بكسلٍ أو اثنين، وهو بالضبط الفرق
// الذي يجعل الوجه في المعاينة وسط الإطار وفي البطاقة على حافّته.
// --------------------------------------------------

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function drawImage(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource & { width: number; height: number },
  frame: Rect,
  view: View,
) {
  const w = source.width * view.scale;
  const h = source.height * view.scale;

  ctx.drawImage(
    source,
    frame.x + frame.w / 2 - w / 2 + view.x,
    frame.y + frame.h / 2 - h / 2 + view.y,
    w,
    h,
  );
}

/** أكبرُ إطارٍ بهذه النسبة يدخل في مساحة المعاينة، بهامشٍ يفصله عن الحافّة */
function frameOf(
  stage: { w: number; h: number },
  ratio: number | null,
  source: { width: number; height: number } | null,
): Rect {
  const pad = 16;
  const availW = Math.max(0, stage.w - pad * 2);
  const availH = Math.max(0, stage.h - pad * 2);

  /* «الصورة كاملة» = نسبةُ الصورة نفسِها، فلا يُقتصّ منها شيء */
  const target = ratio ?? (source ? source.width / source.height : 1);

  let w = availW;
  let h = w / target;

  if (h > availH) {
    h = availH;
    w = h * target;
  }

  return {
    x: (stage.w - w) / 2,
    y: (stage.h - h) / 2,
    w,
    h,
  };
}

/**
 * الصورة مدوَّرةً أرباعَ دورة — تُحسب مرّةً عند كل تدوير لا كل إطار.
 *
 * والدوران بأرباع الدورة وحدها: تصحيحُ صفحةٍ خرجت من الماسح مقلوبةً أو
 * أفقية هو كلُّ ما يُحتاج، وزاويةٌ حرّة تُدخل حوافَّ مائلةً بيضاء تحتاج
 * قصّاً يُفسد النسبة — حلٌّ لمشكلةٍ لا يشكوها أحد.
 */
function useRotated(image: HTMLImageElement | null, quarter: number) {
  const [out, setOut] = useState<HTMLCanvasElement | HTMLImageElement | null>(null);

  useEffect(() => {
    if (!image) {
      setOut(null);
      return;
    }

    if (quarter % 4 === 0) {
      setOut(image);
      return;
    }

    const turned = quarter % 2 === 1;
    const canvas = document.createElement("canvas");
    canvas.width = turned ? image.height : image.width;
    canvas.height = turned ? image.width : image.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((quarter * Math.PI) / 2);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);

    setOut(canvas);
  }, [image, quarter]);

  return out;
}

function Slider({
  icon,
  label,
  value,
  suffix,
  min,
  max,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-white/60">
        {icon}
        {label}
        <span className="ms-auto tabular-nums text-white/35" dir="ltr">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sky-300"
      />
    </label>
  );
}
