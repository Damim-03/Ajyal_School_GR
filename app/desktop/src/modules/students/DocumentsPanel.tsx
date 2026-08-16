import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Download,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

import { assetUrl } from "../../lib/asset-url";
import {
  deleteStudentDocument,
  getStudentFile,
  putStudentDocument,
  uploadImage,
  type CatalogueEntry,
  type StudentFile,
} from "./student.api";

const ACCENT = "#7dd3fc";

/**
 * ملف وثائق الطالب.
 *
 * يعرض **خانةً لكل نوع** لا الموجودَ فقط: الغرض من هذه الشاشة معرفة
 * ما ينقص، وقائمةٌ بالمرفوع وحده تُجيب عن السؤال المعاكس.
 *
 * الرفع من خطوتين — الملف إلى /uploads ثم مساره إلى الوثيقة — لكنّهما
 * تبدوان واحدة للمستخدم.
 */
export function DocumentsPanel({
  studentId,
  onChange,
}: {
  studentId: string;
  onChange?: (file: StudentFile) => void;
}) {
  const [file, setFile] = useState<StudentFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const apply = (next: StudentFile) => {
    setFile(next);
    onChange?.(next);
  };

  useEffect(() => {
    let alive = true;

    getStudentFile(studentId)
      .then((f) => alive && apply(f))
      .catch(() => alive && setError("تعذّر جلب ملف الطالب"))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const attach = async (type: string, picked: File) => {
    setBusyType(type);
    setError(null);

    try {
      const path = await uploadImage(picked);
      apply(await putStudentDocument(studentId, type, { filePath: path, fileName: picked.name }));
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string } } }).response;
      setError(response?.data?.message ?? "تعذّر رفع الوثيقة");
    } finally {
      setBusyType(null);
    }
  };

  const remove = async (type: string) => {
    setBusyType(type);
    setError(null);

    try {
      apply(await deleteStudentDocument(studentId, type));
    } catch {
      setError("تعذّر حذف الوثيقة");
    } finally {
      setBusyType(null);
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-14 text-white/40">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {error ?? "تعذّر جلب ملف الطالب"}
      </div>
    );
  }

  const { completeness } = file;

  return (
    <div className="space-y-4">
      {/* شريط الاكتمال */}
      <div
        className="flex items-center gap-3 rounded-xl border px-4 py-3"
        style={
          completeness.isComplete
            ? { borderColor: "rgba(134,239,172,0.3)", background: "rgba(134,239,172,0.08)" }
            : { borderColor: "rgba(252,211,77,0.3)", background: "rgba(252,211,77,0.08)" }
        }
      >
        {completeness.isComplete ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
        ) : (
          <Circle className="h-5 w-5 text-amber-300" />
        )}
        <div className="flex-1">
          <div className="text-sm font-bold">
            {completeness.isComplete
              ? "الملف مكتمل"
              : `ينقصه ${completeness.required - completeness.presentRequired} من ${completeness.required}`}
          </div>
          <div className="text-[11px] text-white/45">
            الوثائق الإلزامية: {completeness.presentRequired} / {completeness.required}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* خانة لكل نوع */}
      <div className="grid gap-3 sm:grid-cols-2">
        {file.catalogue.map((entry) => (
          <DocumentSlot
            key={entry.key}
            entry={entry}
            busy={busyType === entry.key}
            inputRef={(el) => (inputs.current[entry.key] = el)}
            onPick={() => inputs.current[entry.key]?.click()}
            onFile={(f) => attach(entry.key, f)}
            onRemove={() => remove(entry.key)}
          />
        ))}
      </div>
    </div>
  );
}

function DocumentSlot({
  entry,
  busy,
  inputRef,
  onPick,
  onFile,
  onRemove,
}: {
  entry: CatalogueEntry;
  busy: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onPick: () => void;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const present = !!entry.document;
  const url = assetUrl(entry.document?.filePath);

  return (
    <div
      className="rounded-xl border p-3.5 transition"
      style={{
        borderColor: present
          ? "rgba(134,239,172,0.25)"
          : entry.required
            ? "rgba(252,211,77,0.25)"
            : "rgba(255,255,255,0.08)",
        background: present ? "rgba(134,239,172,0.04)" : "rgba(0,0,0,0.2)",
      }}
    >
      <div className="mb-2 flex items-start gap-2">
        {present ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        ) : (
          <FileText
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: entry.required ? "#fcd34d" : "rgba(255,255,255,0.3)" }}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-bold">
            {entry.label}
            {entry.required && <span className="text-rose-300">*</span>}
          </div>
          {entry.hint && !present && (
            <div className="text-[11px] text-white/35">{entry.hint}</div>
          )}
          {present && (
            <div className="truncate text-[11px] text-white/45">
              {entry.document!.fileName ?? "ملف مرفوع"}
            </div>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPick}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold transition hover:bg-white/20 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {present ? "استبدال" : "رفع"}
        </button>

        {present && (
          <>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold transition hover:bg-white/20"
            >
              <Download className="h-3.5 w-3.5" />
              عرض
            </a>

            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="ms-auto grid h-7 w-7 place-items-center rounded-lg text-white/40 transition hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-40"
              title="حذف الوثيقة"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export { ACCENT as STUDENT_ACCENT };
