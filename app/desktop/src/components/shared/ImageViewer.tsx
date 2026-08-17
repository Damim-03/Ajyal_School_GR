import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  FileWarning,
  Loader2,
  Maximize2,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { FormDialog } from "./FormDialog";

/**
 * عارض الوثيقة — داخل التطبيق لا في لسان متصفّح.
 *
 * كان زرّ «عرض» رابطاً بـ`target="_blank"`، فيخرج الموظّف من البرنامج
 * إلى نافذةٍ أخرى تحمل عنوان الخادم، ويعود إليه بحثاً عن اللسان الذي
 * تركه — وقد فقد موضعه في ملفّ الطالب. والوثيقةُ تُفتح للتحقّق السريع
 * («أهذه شهادة الميلاد فعلاً؟») لا للدراسة، فمحلُّها فوق ما كان يُنظر
 * إليه لا بدلاً منه.
 *
 * والتقريب ليس زينة: شهادة ميلادٍ ممسوحة بدقّة 300 تُعرض مصغَّرةً في
 * نافذة، وأرقامُها لا تُقرأ إلّا بالتكبير — وهو أوّلُ ما يُحتاج إليه
 * عند التحقّق من تاريخ ميلادٍ أو رقم عقد.
 */

/** حدّا التقريب — دونهما تختفي الصورة، وفوقهما تصير بكسلاتٍ بلا معنى */
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

export function ImageViewer({
  src,
  title,
  subtitle,
  onClose,
}: {
  src: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [zoom, setZoom] = useState(1);
  const [quarter, setQuarter] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const drag = useRef<{ x: number; y: number } | null>(null);

  /* التقريب يعود إلى أصله مع كل وثيقةٍ جديدة — لا تُورَّث حالةُ سابقتها */
  useEffect(() => {
    setState("loading");
    setZoom(1);
    setQuarter(0);
    setOffset({ x: 0, y: 0 });
  }, [src]);

  /*
   * التقريب بمُحدِّثٍ دالّي لا بقراءة `zoom` من الإغلاق.
   *
   * عجلة الفأرة تُطلق عشرات الأحداث قبل أن يُعاد الرسم، وكلُّها كانت
   * تقرأ القيمة نفسها فتكتب النتيجة نفسها: دورةٌ كاملة للعجلة ترفع
   * التقريب خطوةً واحدة، فيبدو العارض ثقيلاً لا يستجيب. (قِيس: اثنتا
   * عشرة ضغطة متتابعة على «تكبير» تُنهي عند 140٪ لا عند الحدّ.)
   */
  const zoomBy = useCallback((factor: number) => {
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(z * factor, MAX_ZOOM)));
  }, []);

  /* ملءُ الإطار يُعيد التوسيط — وإلّا بقيت الصورة منزاحةً بإزاحةٍ لا
     معنى لها بعد أن صارت كلُّها ظاهرة */
  useEffect(() => {
    if (zoom === MIN_ZOOM) setOffset({ x: 0, y: 0 });
  }, [zoom]);

  return (
    <FormDialog
      icon={FileText}
      title={title}
      subtitle={subtitle}
      tone="#fcd34d"
      width="xl"
      onClose={onClose}
      headerExtra={
        <div className="flex flex-wrap items-center gap-2">
          <Tool onClick={() => zoomBy(1 / 1.4)} disabled={zoom <= MIN_ZOOM} title="تصغير">
            <ZoomOut className="h-4 w-4" />
          </Tool>

          <span className="min-w-14 text-center text-xs font-bold tabular-nums text-white/50" dir="ltr">
            {Math.round(zoom * 100)}%
          </span>

          <Tool onClick={() => zoomBy(1.4)} disabled={zoom >= MAX_ZOOM} title="تكبير">
            <ZoomIn className="h-4 w-4" />
          </Tool>

          <Tool onClick={() => setZoom(MIN_ZOOM)} disabled={zoom === MIN_ZOOM} title="ملء الإطار">
            <Maximize2 className="h-4 w-4" />
          </Tool>

          <Tool onClick={() => setQuarter((q) => (q + 1) % 4)} title="تدوير">
            <RotateCw className="h-4 w-4" />
          </Tool>

          {/*
            فتحُ الوثيقة خارج البرنامج يبقى متاحاً — للطباعة أو للحفظ،
            وهما ما لا يفعله العارض. ولم يعد الطريق الوحيد.
          */}
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="ms-auto flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold transition hover:bg-white/20"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            فتح خارج التطبيق
          </a>
        </div>
      }
    >
      <div
        className="relative h-[62vh] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/50"
        style={{ cursor: zoom > 1 ? "grab" : "default", touchAction: "none" }}
        onPointerDown={(e) => {
          if (zoom <= 1) return;
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

          setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
        }}
        onPointerUp={(e) => {
          drag.current = null;
          e.currentTarget.style.cursor = zoom > 1 ? "grab" : "default";
        }}
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15)}
      >
        {state === "loading" && (
          <div className="absolute inset-0 grid place-items-center text-white/40">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {state === "failed" ? (
          <div className="absolute inset-0 grid place-items-center gap-2 p-6 text-center">
            <FileWarning className="mx-auto h-10 w-10 text-white/15" />
            <p className="text-sm text-white/55">تعذّر عرض هذه الوثيقة هنا</p>
            <p className="mx-auto max-w-sm text-[11px] leading-relaxed text-white/35">
              قد تكون بصيغةٍ لا يعرضها البرنامج، أو حُذف ملفّها من الخادم.
              جرّب فتحها خارج التطبيق.
            </p>
          </div>
        ) : (
          <img
            src={src}
            alt={title}
            draggable={false}
            onLoad={() => setState("ready")}
            onError={() => setState("failed")}
            className="absolute inset-0 m-auto max-h-full max-w-full select-none object-contain"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${quarter * 90}deg)`,
              /* الإزاحة تسبق التصغير في السلسلة، فالتحريك يبقى بسرعة
                 المؤشّر مهما بلغ التقريب */
              transformOrigin: "center",
              opacity: state === "ready" ? 1 : 0,
              transition: drag.current ? "none" : "opacity 0.2s",
            }}
          />
        )}
      </div>

      {/* التلميح لما يُعرض — وفوق وثيقةٍ تعذّر عرضُها يصير سخريةً */}
      {state === "ready" && (
        <p className="mt-3 text-center text-[11px] text-white/30">
          عجلة الفأرة تقرّب وتبعّد، والسحب يحرّك الصورة حين تكون مكبَّرة.
        </p>
      )}
    </FormDialog>
  );
}

function Tool({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 transition hover:bg-white/20 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
