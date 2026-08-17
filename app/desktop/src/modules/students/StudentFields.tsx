import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Avatar } from "../../components/shared/Avatar";
import { ImageIntake } from "../../components/shared/ImageIntake";
import { activeOnly, stagesOf, useLevels } from "../../core/api/reference.api";
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
  formId,
  onValidityChange,
}: {
  student?: Student | null;
  onSubmit: (payload: StudentInput) => void;
  busy: boolean;
  error: string | null;
  submitLabel?: string;
  submitIcon?: ReactNode;
  footerExtra?: ReactNode;
  /**
   * معرّفٌ يربط زرَّ حفظٍ **خارج** هذه الحقول بنموذجها.
   *
   * تمرّره النافذةُ المركزية لأنّ زرَّها ملتصقٌ بقاعها لا بآخر الحقول،
   * ووجودُه يُخفي الذيل المحلّي — وإلّا ظهر زرّا حفظٍ في نافذةٍ واحدة.
   * ويبقى غائباً في المعالج حيث الزرّ في مجرى الصفحة طبيعياً.
   */
  formId?: string;
  /** يُبلِّغ النافذةَ متى يصلح الحفظ — زرُّها خارج هذه الحقول فلا يرى تمامها */
  onValidityChange?: (valid: boolean) => void;
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
    levelId: student?.levelId ?? null,
    note: student?.note ?? "",
    isActive: student?.isActive ?? true,
  });

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /*
   * ===== الطور والمستوى — من «البنية الدراسية» لا من قائمة مكتوبة =====
   *
   * الإدارة تُنشئ الأطوار والمستويات مرّةً في السنة، وهذه القائمة هي
   * إيّاها: مستوًى جديد يظهر هنا فور إنشائه، ومستوًى عُطّل يختفي —
   * بلا تعديلٍ في هذا الملف.
   *
   * والطور مرشّحٌ لا حقلٌ يُحفظ: المرسَل `levelId` وحده، والطور
   * مقروءٌ من المستوى نفسِه (`Level.educationStageId`). فلا يُحفظ
   * طورٌ يناقض مستواه لأنّ لا محلَّ يُحفظ فيه.
   */
  const { data: levels, isLoading: levelsLoading } = useLevels();

  /*
   * المعطَّل لا يُختار للجديد — إلّا مستوى هذا الطالب نفسِه.
   *
   * مستوًى يُعطَّل بعد أن سُجّل فيه طلبة يبقى مستواهم كما كان. ولو
   * حُذف من القائمة لظهر الحقل فارغاً أمام محرِّر ملفّه بينما القيمة
   * محفوظة، فيحفظ ظانّاً أنّه لم يمسّه — والخادم يردّه بـ«مستوى
   * معطَّل» عن حقلٍ لم يلمسه أصلاً.
   */
  const active = useMemo(() => {
    const rows = activeOnly(levels);
    const own = (levels ?? []).find((l) => l.id === student?.levelId);
    return own && !rows.some((l) => l.id === own.id) ? [...rows, own] : rows;
  }, [levels, student?.levelId]);

  const stages = useMemo(() => stagesOf(active), [active]);

  /*
   * الطور المعروض يتبع المستوى المحفوظ — لا حالةً مستقلّة تُهيَّأ مرّة.
   * الاشتقاق يعني أنّ فتح ملفّ طالبٍ في «ثانية ثانوي» يُظهر «ثانوي»
   * مختاراً بلا مزامنة، وأنّ الحالتين لا تفترقان أصلاً.
   */
  const [stageId, setStageId] = useState<string>(
    () => student?.level?.educationStage.id ?? "",
  );

  const stageOfSelected = active.find((l) => l.id === form.levelId)
    ?.educationStage.id;

  const currentStage = stageOfSelected ?? stageId;

  const levelsInStage = currentStage
    ? active.filter((l) => l.educationStage?.id === currentStage)
    : [];

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
      levelId: form.levelId || null,
      note: clean(form.note),
      isActive: form.isActive,
    });
  };

  const invalid =
    !form.firstName.trim() || !form.lastName.trim() || !form.parentPhone.trim();

  useEffect(() => {
    onValidityChange?.(!invalid);
  }, [invalid, onValidityChange]);

  return (
    <form id={formId} onSubmit={submit} className="space-y-5">
      {/* ===== الصورة ===== */}
      <div className="flex items-center gap-4">
        <Avatar src={form.avatar} name={fullName} gender={form.gender} size={72} />

        <div className="flex flex-col gap-2">
          {/*
            نسبة 3:4 مفروضة لا مقترحة: خانة الصورة على البطاقة
            19 × 25.3 مم، وصورةٌ بنسبةٍ أخرى إمّا تُمطّ أو يُقتصّ منها
            آلياً — والقصّ الآلي يقطع الذقن أو أعلى الرأس. فالقصّ يجري
            هنا وبعينِ من يرى الوجه.
          */}
          <ImageIntake
            aspect="3:4"
            editorTitle="صورة الطالب"
            busy={uploading}
            onFile={pickPhoto}
          >
            {form.avatar ? "تغيير الصورة" : "إضافة صورة"}
          </ImageIntake>

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

        {/*
          ===== الطور ثمّ المستوى =====
          مرتّبان كما يفكّر الموظّف: «متوسط» ثمّ «أولى متوسط». والمستوى
          مقفلٌ حتى يُختار الطور — قائمةٌ بكل مستويات المؤسسة مجتمعةً
          تُطيل البحث وتُغري بمستوى الطور الخطأ.
        */}
        <Field label="الطور" hint="من البنية الدراسية">
          <select
            value={currentStage}
            disabled={levelsLoading || stages.length === 0}
            onChange={(e) => {
              setStageId(e.target.value);
              /* تبديل الطور يُسقط مستوى الطور السابق — وإلّا بقي
                 «أولى متوسط» محفوظاً تحت «ثانوي» في الحقل التالي */
              set("levelId", null);
            }}
            className={inputClass}
          >
            <option value="">
              {levelsLoading ? "جارٍ التحميل…" : "— اختر الطور —"}
            </option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="المستوى" hint="يظهر على بطاقة الطالب">
          <select
            value={form.levelId ?? ""}
            disabled={!currentStage}
            onChange={(e) => set("levelId", e.target.value || null)}
            className={inputClass}
          >
            <option value="">
              {currentStage ? "— اختر المستوى —" : "اختر الطور أوّلاً"}
            </option>
            {levelsInStage.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
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

      {/* الخطأ تعرضه النافذة في ذيلها حين تملك الزرّ — فلا يُطبع مرّتين */}
      {error && !formId && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {!formId && (
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
      )}
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
