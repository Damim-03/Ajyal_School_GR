import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { Avatar } from "../../components/shared/Avatar";
import { uploadImage, type Student, type StudentInput } from "./student.api";

const ACCENT = "#7dd3fc";

/**
 * حقول الطالب — مشتركة بين اللوحة الجانبية ومعالج التسجيل.
 *
 * استُخرجت لأنّ الشاشتين تحرّران **الشيء نفسه**: نسختان من الحقول
 * تفترقان عند أوّل حقلٍ يُضاف إلى إحداهما دون الأخرى.
 */

const iso = (value?: string | null) => (value ? value.slice(0, 10) : "");

export function StudentFields({
  student,
  onSubmit,
  busy,
  error,
  submitLabel,
  submitIcon,
  footerExtra,
}: {
  student?: Student | null;
  onSubmit: (payload: StudentInput) => void;
  busy: boolean;
  error: string | null;
  submitLabel: string;
  submitIcon?: ReactNode;
  footerExtra?: ReactNode;
}) {
  const [form, setForm] = useState<StudentInput>({
    firstName: student?.firstName ?? "",
    lastName: student?.lastName ?? "",
    gender: student?.gender ?? "MALE",
    birthDate: iso(student?.birthDate),
    avatar: student?.avatar ?? null,
    phone: student?.phone ?? "",
    parentPhone: student?.parentPhone ?? "",
    address: student?.address ?? "",
    schoolName: student?.schoolName ?? "",
    emergencyPhone: student?.emergencyPhone ?? "",
    note: student?.note ?? "",
    isActive: student?.isActive ?? true,
  });

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof StudentInput>(key: K, value: StudentInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const fullName = `${form.firstName} ${form.lastName}`.trim() || "طالب جديد";

  const pickPhoto = async (file: File) => {
    setUploading(true);
    setUploadError(null);

    try {
      set("avatar", await uploadImage(file));
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string } } }).response;
      setUploadError(response?.data?.message ?? "تعذّر رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    /* الفراغ يعني «لا قيمة» لا نصّاً فارغاً — الخادم يرفض النصوص القصيرة */
    const clean = (v?: string | null) => {
      const t = (v ?? "").trim();
      return t.length > 0 ? t : null;
    };

    onSubmit({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      gender: form.gender,
      birthDate: clean(form.birthDate),
      avatar: form.avatar || null,
      phone: clean(form.phone),
      parentPhone: (form.parentPhone ?? "").trim(),
      address: clean(form.address),
      schoolName: clean(form.schoolName),
      emergencyPhone: clean(form.emergencyPhone),
      note: clean(form.note),
      isActive: form.isActive,
    });
  };

  const invalid =
    !form.firstName.trim() || !form.lastName.trim() || !form.parentPhone.trim();

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* ===== الصورة ===== */}
      <div className="flex items-center gap-4">
        <Avatar src={form.avatar} name={fullName} gender={form.gender} size={72} />

        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) pickPhoto(file);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold transition hover:bg-white/20 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            {form.avatar ? "تغيير الصورة" : "إضافة صورة"}
          </button>

          {form.avatar && (
            <button
              type="button"
              onClick={() => set("avatar", null)}
              className="flex items-center gap-2 px-3 py-1 text-xs text-white/50 transition hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
              إزالة
            </button>
          )}

          {uploadError && (
            <span className="text-[11px] text-rose-300">{uploadError}</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم" required>
          <input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputClass} />
        </Field>

        <Field label="اللقب" required>
          <input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputClass} />
        </Field>

        <Field label="الجنس" required>
          <div className="flex gap-2">
            {(["MALE", "FEMALE"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => set("gender", g)}
                className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition"
                style={
                  form.gender === g
                    ? { borderColor: ACCENT, background: `${ACCENT}1f`, color: ACCENT }
                    : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)" }
                }
              >
                {g === "MALE" ? "ذكر" : "أنثى"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="تاريخ الميلاد">
          <input type="date" dir="ltr" value={form.birthDate ?? ""} onChange={(e) => set("birthDate", e.target.value)} className={inputClass} />
        </Field>

        <Field label="هاتف ولي الأمر" required hint="وسيلة التواصل الأساسية">
          <input dir="ltr" value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} className={inputClass} />
        </Field>

        <Field label="هاتف الطالب">
          <input dir="ltr" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className={inputClass} />
        </Field>

        <Field label="هاتف الطوارئ">
          <input dir="ltr" value={form.emergencyPhone ?? ""} onChange={(e) => set("emergencyPhone", e.target.value)} className={inputClass} />
        </Field>

        <Field label="المدرسة الأصلية" hint="المؤسسة التي يدرس فيها الطالب">
          <input value={form.schoolName ?? ""} onChange={(e) => set("schoolName", e.target.value)} className={inputClass} />
        </Field>

        <div className="sm:col-span-2">
          <Field label="العنوان">
            <input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} className={inputClass} />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="ملاحظة">
            <textarea value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </Field>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
          className="h-4 w-4 accent-sky-400"
        />
        <span className="text-sm font-bold">طالب نشط</span>
      </label>

      {error && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy || invalid}
          className="flex items-center gap-2 rounded-xl px-5 py-3 font-black text-[#04121c] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {busy ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : submitIcon}
          {submitLabel}
        </button>

        {footerExtra}
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none transition focus:border-white/30";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-white/60">
        {label}
        {required && <span className="ms-1 text-rose-300">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-white/40">{hint}</span>}
    </label>
  );
}
