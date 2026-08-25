import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, FilePlus2, FileText, Loader2, Plus, Trash2 } from "lucide-react";

import { ImageIntake } from "../../components/shared/ImageIntake";
import { ImageViewer } from "../../components/shared/ImageViewer";
import { FormDialog } from "../../components/shared/FormDialog";
import { assetUrl } from "../../lib/asset-url";
import {
  customDocumentKey,
  deleteTeacherDocument,
  getTeacherFile,
  putTeacherDocument,
  uploadImage,
  type TeacherCatalogueEntry,
  type TeacherFile,
} from "./teachers.api";

const ACCENT = "#5eead4";

/**
 * وثائق ملفّ الأستاذ — شقُّ المسح في نافذته وفي ملفّه.
 *
 * وهي غيرُ وثائق الطالب في أمرين:
 *
 * **الأنواع مفتوحة.** الخانات الافتراضية اقتراحٌ لا حصر، وزرُّ «وثيقة
 * أخرى» يبقى قائماً في كل الأحوال — فما تطلبه الإدارةُ اليوم غيرُ ما
 * طلبته أمس، ووثيقةٌ لا خانةَ لها تُوضع في خانةٍ ليست لها فتضيع.
 *
 * **ولا شارةَ اكتمال.** ملفُّ الطالب له إلزامٌ يعرفه من كتبه، وملفُّ
 * التوظيف إلزامُه عند الإدارة لا عندنا — فنقول «سُلّم كذا» ولا نقول
 * «ينقصه كذا».
 *
 * والرفعُ فوريّ: مسارُ الوثيقة `/teachers/:id/documents` يحتاج رقمَ
 * الأستاذ، فلا تُفتح هذه اللوحةُ إلّا بعد حفظه — ولذلك كانت النافذة
 * خطوتين لا شقّين متزامنين.
 */

// --------------------------------------------------
// ما يُعرض في الخانة — مصدرُه الخادمُ أو الذاكرة
// --------------------------------------------------

interface Slot {
  key: string;
  label: string;
  hint?: string;
  custom: boolean;
  /** الملفُّ الحاضر — مرفوعاً كان أو منتظِراً الحفظ */
  present: { name: string; url?: string; meta?: string } | null;
}

// --------------------------------------------------
// ملفُّ أستاذٍ قائم — الرفع فوريّ
// --------------------------------------------------

export function TeacherDocumentsPanel({
  teacherId,
  readOnly = false,
  onChange,
}: {
  teacherId: string;
  readOnly?: boolean;
  onChange?: (file: TeacherFile) => void;
}) {
  const [file, setFile] = useState<TeacherFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = (next: TeacherFile) => {
    setFile(next);
    onChange?.(next);
  };

  useEffect(() => {
    let alive = true;

    getTeacherFile(teacherId)
      .then((f) => alive && apply(f))
      .catch(() => alive && setError("تعذّر جلب وثائق الأستاذ"))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  const attach = async (
    key: string,
    picked: File,
    label?: string,
  ) => {
    setBusyKey(key);
    setError(null);

    try {
      const path = await uploadImage(picked);
      apply(
        await putTeacherDocument(teacherId, key, {
          filePath: path,
          fileName: picked.name,
          ...(label ? { label } : {}),
        }),
      );
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string } } }).response;
      setError(response?.data?.message ?? "تعذّر رفع الوثيقة");
    } finally {
      setBusyKey(null);
    }
  };

  const remove = async (key: string) => {
    setBusyKey(key);
    setError(null);

    try {
      apply(await deleteTeacherDocument(teacherId, key));
    } catch {
      setError("تعذّر حذف الوثيقة");
    } finally {
      setBusyKey(null);
    }
  };

  const slots: Slot[] = useMemo(
    () => (file?.catalogue ?? []).map(entryToSlot),
    [file],
  );

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
        {error ?? "تعذّر جلب وثائق الأستاذ"}
      </div>
    );
  }

  return (
    <Board
      slots={slots}
      delivered={file.delivered}
      busyKey={busyKey}
      error={error}
      readOnly={readOnly}
      onFile={(slot, picked) => attach(slot.key, picked, slot.custom ? slot.label : undefined)}
      onRemove={(slot) => remove(slot.key)}
      onAdd={(label, picked) => attach(customDocumentKey(), picked, label)}
    />
  );
}

// --------------------------------------------------
// العرض
// --------------------------------------------------

const entryToSlot = (entry: TeacherCatalogueEntry): Slot => ({
  key: entry.key,
  label: entry.label,
  hint: entry.hint,
  custom: entry.custom,
  present: entry.document
    ? {
        name: entry.document.fileName ?? "ملف مرفوع",
        url: assetUrl(entry.document.filePath),
        meta: [
          entry.document.uploadedBy?.username,
          new Date(entry.document.createdAt).toLocaleDateString("fr-DZ", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
        ]
          .filter(Boolean)
          .join(" · "),
      }
    : null,
});

function Board({
  slots,
  delivered,
  busyKey,
  error,
  readOnly = false,
  onFile,
  onRemove,
  onAdd,
}: {
  slots: Slot[];
  delivered: number;
  busyKey: string | null;
  error: string | null;
  readOnly?: boolean;
  onFile: (slot: Slot, file: File) => void;
  onRemove: (slot: Slot) => void;
  onAdd: (label: string, file: File) => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <FileText className="h-5 w-5" style={{ color: ACCENT }} />

        <div className="flex-1">
          <div className="text-sm font-bold">
            {delivered === 0
              ? "لا وثيقة مسلَّمة بعد"
              : `${delivered} ${delivered === 1 ? "وثيقة مسلَّمة" : "وثائق مسلَّمة"}`}
          </div>
          <div className="text-[11px] text-white/45">
            الخانات اقتراحٌ لا إلزام — والإدارة تضيف ما تطلبه بزرّ «وثيقة أخرى».
          </div>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-black text-[#041f1c] transition hover:brightness-110"
            style={{ background: ACCENT }}
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            وثيقة أخرى
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {slots.map((slot) => (
          <DocumentSlot
            key={slot.key}
            slot={slot}
            busy={busyKey === slot.key}
            readOnly={readOnly}
            onFile={(picked) => onFile(slot, picked)}
            onRemove={() => onRemove(slot)}
          />
        ))}
      </div>

      {adding && (
        <AddDocumentDialog
          onClose={() => setAdding(false)}
          onDone={(label, picked) => {
            setAdding(false);
            onAdd(label, picked);
          }}
        />
      )}
    </div>
  );
}

function DocumentSlot({
  slot,
  busy,
  readOnly,
  onFile,
  onRemove,
}: {
  slot: Slot;
  busy: boolean;
  readOnly: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const [viewing, setViewing] = useState(false);

  const present = !!slot.present;

  return (
    <div
      className="rounded-xl border p-3.5 transition"
      style={{
        borderColor: present ? "rgba(134,239,172,0.25)" : "rgba(255,255,255,0.08)",
        background: present ? "rgba(134,239,172,0.04)" : "rgba(0,0,0,0.2)",
      }}
    >
      <div className="mb-2 flex items-start gap-2">
        {present ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        ) : (
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-bold">
            {slot.label}
            {slot.custom && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/45">
                مضافة
              </span>
            )}
          </div>
          {slot.hint && !present && (
            <div className="text-[11px] text-white/35">{slot.hint}</div>
          )}
          {present && (
            <div className="truncate text-[11px] text-white/45">{slot.present!.name}</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/*
          نسبةٌ حرّة لا مقاسٌ مفروض: وثائق التوظيف مقاساتُها شتّى —
          شهادةٌ جامعية A4 وبطاقةُ تعريفٍ صغيرة وصورةٌ شمسية.
        */}
        {!readOnly && (
          <ImageIntake
            aspect={slot.key === "photo" ? "3:4" : "a4"}
            editorTitle={slot.label}
            busy={busy}
            onFile={onFile}
          >
            {present ? "استبدال" : "رفع"}
          </ImageIntake>
        )}

        {present && (
          <>
            {slot.present!.url && (
              <button
                type="button"
                onClick={() => setViewing(true)}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold transition hover:bg-white/20"
              >
                <Eye className="h-3.5 w-3.5" />
                عرض
              </button>
            )}

            {!readOnly && (
              <button
                type="button"
                onClick={onRemove}
                disabled={busy}
                className="ms-auto grid h-7 w-7 place-items-center rounded-lg text-white/40 transition hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-40"
                title="حذف الوثيقة"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>

      {viewing && slot.present?.url && (
        <ImageViewer
          src={slot.present.url}
          title={slot.label}
          subtitle={slot.present.meta}
          onClose={() => setViewing(false)}
        />
      )}
    </div>
  );
}

// --------------------------------------------------
// وثيقةٌ تسمّيها الإدارة
//
// التسميةُ والملفُّ معاً في خطوةٍ واحدة: خانةٌ مسمّاةٌ بلا ملفّ لا
// تُحفظ في شيء، فسؤالُ الاسم وحده يُنتج اسماً يضيع.
// --------------------------------------------------

function AddDocumentDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (label: string, file: File) => void;
}) {
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const valid = label.trim().length >= 2 && !!file;

  return (
    <FormDialog
      icon={FilePlus2}
      title="وثيقة أخرى"
      subtitle="سمِّ الوثيقة ثمّ امسحها أو اخترها من الحاسوب"
      tone={ACCENT}
      width="md"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onDone(label.trim(), file!);
      }}
      submitDisabled={!valid}
      submitLabel="إضافة"
      submitIcon={<Plus className="h-4.5 w-4.5" />}
    >
      <div className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-white/60">
            تسمية الوثيقة<span className="text-rose-300"> *</span>
          </span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            placeholder="شهادة الخبرة، رخصة السياقة…"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none transition focus:border-white/30"
          />
          <span className="mt-1 block text-[11px] text-white/35">
            هي ما سيُقرأ في الملفّ وفي شهادة العمل — فاكتبها كما تُسمّيها الإدارة.
          </span>
        </label>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="mb-2 text-xs font-bold text-white/60">
            الملف<span className="text-rose-300"> *</span>
          </div>

          {file ? (
            <div className="mb-2.5 flex items-center gap-2 text-[12px] text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              <span className="truncate">{file.name}</span>
            </div>
          ) : (
            <p className="mb-2.5 text-[11px] text-white/35">
              لا ملف بعد — امسح الورقة أو اخترها من الحاسوب.
            </p>
          )}

          <ImageIntake aspect="a4" editorTitle={label || "وثيقة"} onFile={setFile}>
            {file ? "استبدال" : "رفع"}
          </ImageIntake>
        </div>
      </div>
    </FormDialog>
  );
}

