import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, FolderOpen, Loader2, Scan, ScanLine } from "lucide-react";

import {
  canScan,
  listScanners,
  scanPage,
  SCAN_COLORS,
  SCAN_RESOLUTIONS,
  type ScanColor,
  type Scanner,
} from "../../lib/scanner";
import { FormDialog, FormGrid, FormRow } from "./FormDialog";
import { ImageEditor, type AspectKey } from "./ImageEditor";

/**
 * إدخال صورة — من الحاسوب أو من الماسح الضوئي، ثمّ المحرّر.
 *
 * مكوّنٌ واحد لأنّ المسارين ينتهيان إلى الشيء نفسه: ملفُّ صورةٍ يمرّ
 * على المحرّر ثمّ يُسلَّم إلى الأب. وفصلُهما كان يعني تكرار المحرّر
 * ومنطقِ الأخطاء في كل موضعٍ يقبل صورة — وهما موضعان اليوم (صورة
 * الطالب وخانات الوثائق) وسيصيران أكثر.
 *
 * والأب لا يعرف من أين جاء الملف ولا يعنيه: يستقبل `File` جاهزاً
 * ويرفعه كما كان يرفع ما يختاره المستخدم بيده.
 */

type Stage =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "editing"; file: File };

export function ImageIntake({
  aspect = "free",
  editorTitle,
  busy = false,
  disabled = false,
  onFile,
  children,
}: {
  aspect?: AspectKey;
  editorTitle?: string;
  /** انشغالُ الرفع عند الأب — يقفل الأزرار ويُظهر الدوّارة */
  busy?: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
  /** تسمية زرّ الحاسوب — «إضافة صورة» أو «رفع» بحسب الموضع */
  children?: ReactNode;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [scanOpen, setScanOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const scannerAvailable = canScan();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          /* التفريغ قبل أيّ شيء: اختيارُ الملفّ نفسِه مرّتين لا يُطلق
             الحدث ثانيةً إن بقيت قيمتُه — فيبدو الزرّ معطّلاً */
          e.target.value = "";
          if (picked) {
            setError(null);
            setStage({ kind: "editing", file: picked });
          }
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold transition hover:bg-white/20 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FolderOpen className="h-3.5 w-3.5" />
          )}
          {children ?? "من الحاسوب"}
        </button>

        {/*
          زرّ الماسح يظهر داخل Tauri وحده. في المتصفّح أثناء التطوير لا
          جسرَ إلى WIA، وزرٌّ يعتذر عند الضغط أسوأ من زرٍّ لا يظهر.
        */}
        {scannerAvailable && (
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => {
              setError(null);
              setScanOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold transition hover:bg-white/20 disabled:opacity-50"
          >
            <ScanLine className="h-3.5 w-3.5" />
            من الماسح
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-rose-300">{error}</p>
      )}

      {scanOpen && (
        <ScanDialog
          onClose={() => setScanOpen(false)}
          onScanned={(file) => {
            setScanOpen(false);
            setStage({ kind: "editing", file });
          }}
        />
      )}

      {stage.kind === "editing" && (
        <ImageEditor
          file={stage.file}
          aspect={aspect}
          title={editorTitle}
          busy={busy}
          onCancel={() => setStage({ kind: "idle" })}
          onDone={(edited) => {
            setStage({ kind: "idle" });
            onFile(edited);
          }}
        />
      )}
    </>
  );
}

// --------------------------------------------------
// نافذة المسح — اختيار الجهاز وإعداده ثمّ سحب الصفحة
// --------------------------------------------------

const DEVICE_KEY = "ajyal_scanner";

function ScanDialog({
  onClose,
  onScanned,
}: {
  onClose: () => void;
  onScanned: (file: File) => void;
}) {
  const [devices, setDevices] = useState<Scanner[] | null>(null);
  const [device, setDevice] = useState<string>(() => {
    try {
      return localStorage.getItem(DEVICE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const [dpi, setDpi] = useState(300);
  const [color, setColor] = useState<ScanColor>("color");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    listScanners()
      .then((rows) => {
        if (!alive) return;
        setDevices(rows);

        /* المحفوظ إن كان لا يزال متّصلاً، وإلّا فأوّلُ ما وُجد — فلا
           يبقى اختيارٌ يشير إلى ماسحٍ رُفع من المكتب */
        setDevice((current) =>
          rows.some((r) => r.id === current) ? current : (rows[0]?.id ?? ""),
        );
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setDevices([]);
        setError(String((err as Error)?.message ?? err));
      });

    return () => {
      alive = false;
    };
  }, []);

  const run = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const file = await scanPage({ device, dpi, color });

      try {
        localStorage.setItem(DEVICE_KEY, device);
      } catch {
        /* وضع خاص يمنع التخزين — الاختيار يبقى للجلسة */
      }

      onScanned(file);
    } catch (err: unknown) {
      setError(String((err as Error)?.message ?? err));
      setBusy(false);
    }
  };

  const none = devices !== null && devices.length === 0;

  return (
    <FormDialog
      icon={Scan}
      title="مسح ضوئي"
      subtitle="ضع الورقة في الماسح ثمّ اختر الدقّة والألوان"
      tone="#7dd3fc"
      width="md"
      onClose={onClose}
      onSubmit={run}
      busy={busy}
      submitDisabled={none || devices === null}
      submitLabel={busy ? "جارٍ المسح…" : "امسح الآن"}
      submitIcon={<ScanLine className="h-4.5 w-4.5" />}
      error={error}
    >
      {devices === null ? (
        <div className="grid place-items-center gap-3 py-10 text-white/40">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-xs">جارٍ البحث عن أجهزة المسح…</span>
        </div>
      ) : none ? (
        <div className="grid place-items-center gap-2 py-10 text-center">
          <Camera className="h-10 w-10 text-white/12" />
          <p className="text-sm text-white/55">لا ماسح ضوئي متّصل</p>
          <p className="max-w-sm text-[11px] leading-relaxed text-white/35">
            تأكّد أنّ الطابعة موصولة ومشغَّلة، وأنّ مشغّلها مثبَّت على هذا
            الجهاز. ويمكنك دائماً إضافة الصورة من الحاسوب بدل المسح.
          </p>
        </div>
      ) : (
        <FormGrid>
          <FormRow wide>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-white/60">الجهاز</span>
              <select
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                className={selectClass}
              >
                {devices.map((row) => (
                  <option key={row.id} value={row.id} className="bg-[#0a0f1a]">
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          </FormRow>

          <FormRow>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-white/60">الدقّة</span>
              <select
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value))}
                className={selectClass}
              >
                {SCAN_RESOLUTIONS.map((row) => (
                  <option key={row.value} value={row.value} className="bg-[#0a0f1a]">
                    {row.label}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-[11px] text-white/40">
                {SCAN_RESOLUTIONS.find((r) => r.value === dpi)?.hint}
              </span>
            </label>
          </FormRow>

          <FormRow>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-white/60">الألوان</span>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value as ScanColor)}
                className={selectClass}
              >
                {SCAN_COLORS.map((row) => (
                  <option key={row.value} value={row.value} className="bg-[#0a0f1a]">
                    {row.label}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-[11px] text-white/40">
                {SCAN_COLORS.find((c) => c.value === color)?.hint}
              </span>
            </label>
          </FormRow>

          <FormRow wide>
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] leading-relaxed text-white/45">
              المسح يستغرق من ثوانٍ إلى دقيقة بحسب الدقّة، ولا يمكن إيقافه
              بعد بدئه. وما يخرج منه يُفتح في المحرّر لتقصّه وتضبطه قبل
              الحفظ.
            </p>
          </FormRow>
        </FormGrid>
      )}
    </FormDialog>
  );
}

const selectClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none transition focus:border-white/30";
