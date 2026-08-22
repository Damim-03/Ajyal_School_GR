import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Building2,
  Check,
  ImagePlus,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { apiClient } from "../../core/api/client";
import { LOGO_RANGES, logoSpec } from "../../components/print/logo";
import { useAuthStore } from "../../core/stores/auth.store";
import { useSchoolStore } from "../../core/stores/school.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";
import { uploadImage } from "../../modules/students/student.api";

/**
 * هوية المدرسة.
 *
 * **كانت ثوابت في الشيفرة** — اسم المركز مكتوب في `HomePage` و
 * `BootScreen` وصفحة الدخول، أي أنّ تشغيل النظام في مدرسة أخرى كان
 * يحتاج مبرمجاً وإعادة بناء. صارت بيانات.
 *
 * والمعاينة بجانب الحقول لا تحتها: هذه القيم لا معنى لها مجرّدة —
 * معناها كيف تبدو في الترويسة وعلى الإيصال. وكتابتها بلا رؤية أثرها
 * تجعل المستخدم يحفظ ثمّ يخرج ثمّ يعود ليرى.
 */

interface Field {
  key: string;
  label: string;
  hint?: string;
  area?: boolean;
  color?: boolean;
  dir?: "rtl" | "ltr";
}

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "الاسم",
    fields: [
      { key: "school.name_ar", label: "اسم المدرسة", hint: "يظهر في الدخول ويُطبع على الإيصالات" },
      { key: "school.name_en", label: "الاسم اللاتيني", dir: "ltr" },
      { key: "school.short_name", label: "الاسم المختصر", hint: "شعار الترويسة — كلمة واحدة" },
      { key: "school.short_suffix", label: "لاحقة الشعار", hint: "الجزء الملوَّن بعد الاسم المختصر", dir: "ltr" },
      { key: "school.tagline", label: "السطر التعريفي" },
    ],
  },
  {
    title: "التواصل",
    fields: [
      { key: "school.address", label: "العنوان" },
      { key: "school.phone", label: "الهاتف", hint: "يُطبع إن مُلئ فقط", dir: "ltr" },
      { key: "school.email", label: "البريد الإلكتروني", dir: "ltr" },
    ],
  },
  {
    title: "المال",
    fields: [
      { key: "school.currency", label: "رمز العملة" },
      {
        key: "school.registration_fee",
        label: "حقوق التسجيل",
        hint: "مبلغٌ يُقبض مرّةً عند تسجيل طالب جديد — يُملأ وحده في نافذة التسجيل، ويبقى قابلاً للتغيير فيها",
        dir: "ltr",
      },
    ],
  },
  {
    title: "المظهر والطباعة",
    fields: [
      { key: "school.brand_color", label: "لون الهوية", hint: "يصبغ الإقلاع والدخول والشعار", color: true },
      { key: "school.receipt_note", label: "ملاحظة أسفل الإيصال", area: true },
      { key: "school.receipt_thanks", label: "سطر الشكر", hint: "آخر سطر في الورقة" },
    ],
  },
];

/** مفاتيح الشعار — خارج GROUPS لأنّ لها واجهتها الخاصة لا حقلَ نصّ */
const LOGO_KEYS = [
  "school.logo_path",
  "school.logo_width_mm",
  "school.logo_contrast",
  "school.logo_clarity",
];

const ALL_KEYS = [...GROUPS.flatMap((g) => g.fields.map((f) => f.key)), ...LOGO_KEYS];

export default function SchoolIdentityPage() {
  const exitToHome = useScreenExit();

  const settings = useSchoolStore((s) => s.settings);
  const configured = useSchoolStore((s) => s.configured);
  const applyStore = useSchoolStore((s) => s.apply);
  const loadStore = useSchoolStore((s) => s.load);

  const canEdit = useAuthStore((s) => s.hasPermission("settings.update"));

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  const value = (key: string) => draft[key] ?? settings[key] ?? "";

  /*
   * المسوّدة تحمل المتغيَّر وحده لا كل الحقول: الحفظ يرسل ما تغيّر
   * فقط، فلا يُسجَّل حقلٌ لم يلمسه المستخدم كأنّه «مضبوط» ويفقد
   * تتبّعه للافتراضي.
   */
  const changed = useMemo(
    () => Object.keys(draft).filter((k) => draft[k] !== (settings[k] ?? "")),
    [draft, settings],
  );

  const set = (key: string, next: string) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: next }));
  };

  const save = async () => {
    if (changed.length === 0 || busy) return;

    setBusy(true);
    setError(null);

    try {
      const payload = Object.fromEntries(changed.map((k) => [k, draft[k]]));

      const { data } = await apiClient.patch("/settings/school", payload);

      applyStore(data.data);
      setDraft({});
      setSaved(true);
      uiSound("success");
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string; errors?: { field: string; message: string }[] } } }).response;

      setError(
        response?.data?.errors?.[0]?.message ??
          response?.data?.message ??
          "تعذّر الحفظ",
      );
      uiSound("error");
    } finally {
      setBusy(false);
    }
  };

  const resetAll = async () => {
    if (busy || configured.length === 0) return;

    setBusy(true);
    setError(null);

    try {
      const keys = configured.filter((k) => ALL_KEYS.includes(k));

      if (keys.length === 0) return;

      const { data } = await apiClient.post("/settings/school/reset", { keys });

      applyStore(data.data);
      setDraft({});
      setSaved(true);
    } catch {
      setError("تعذّرت إعادة الضبط");
    } finally {
      setBusy(false);
    }
  };

  const brand = value("school.brand_color") || "#7dd3fc";

  /*
   * المعاينة تقرأ المسوّدة لا المحفوظ: تحريك مؤشّر التباين يجب أن
   * يُرى قبل الحفظ، وإلّا صار الضبط تخميناً ثمّ تحقّقاً.
   */
  const previewLogo = logoSpec(settings, {
    path: draft["school.logo_path"],
    width: draft["school.logo_width_mm"],
    contrast: draft["school.logo_contrast"],
    clarity: draft["school.logo_clarity"],
  });

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="هوية المدرسة" subtitle="ما يظهر في التطبيق وعلى المطبوعات">
        <button
          onClick={() => exitToHome(PATHS.home)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto grid max-w-300 gap-6 p-6 lg:grid-cols-[1fr_380px]">
        {/* ================= الحقول ================= */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
          className="space-y-6"
        >
          {!canEdit && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              لا تملك صلاحية تعديل الإعدادات — الحقول للعرض فقط.
            </div>
          )}

          {GROUPS.map((group, gi) => (
            <motion.section
              key={group.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: MOTION.duration.normal,
                delay: 0.06 * gi,
                ease: MOTION.easing.enter,
              }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <h2 className="mb-4 text-sm font-black text-white/70">{group.title}</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                {group.fields.map((field) => (
                  <label
                    key={field.key}
                    className={field.area ? "sm:col-span-2 block" : "block"}
                  >
                    <span className="mb-1.5 block text-xs font-bold text-white/60">
                      {field.label}
                      {configured.includes(field.key) && (
                        <span className="ms-2 text-[10px] font-normal text-white/35">
                          مضبوط
                        </span>
                      )}
                    </span>

                    {field.color ? (
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          disabled={!canEdit}
                          value={value(field.key)}
                          onChange={(e) => set(field.key, e.target.value)}
                          className="h-11 w-16 cursor-pointer rounded-lg border border-white/10 bg-black/30 disabled:cursor-not-allowed"
                        />
                        <input
                          disabled={!canEdit}
                          value={value(field.key)}
                          onChange={(e) => set(field.key, e.target.value)}
                          dir="ltr"
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-left outline-none transition focus:border-white/30 disabled:opacity-50"
                        />
                      </div>
                    ) : field.area ? (
                      <textarea
                        disabled={!canEdit}
                        value={value(field.key)}
                        onChange={(e) => set(field.key, e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none transition focus:border-white/30 disabled:opacity-50"
                      />
                    ) : (
                      <input
                        disabled={!canEdit}
                        value={value(field.key)}
                        onChange={(e) => set(field.key, e.target.value)}
                        dir={field.dir ?? "rtl"}
                        className={`w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none transition focus:border-white/30 disabled:opacity-50 ${
                          field.dir === "ltr" ? "text-left" : ""
                        }`}
                      />
                    )}

                    {field.hint && (
                      <span className="mt-1 block text-[11px] text-white/40">
                        {field.hint}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </motion.section>
          ))}

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: MOTION.duration.normal,
              delay: 0.06 * GROUPS.length,
              ease: MOTION.easing.enter,
            }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <LogoPanel
              canEdit={canEdit}
              value={value}
              set={set}
              configured={configured}
              onError={setError}
            />
          </motion.section>

          {error && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          {canEdit && (
            <div className="flex items-center gap-3">
              <button
                onClick={save}
                disabled={changed.length === 0 || busy}
                className="flex items-center gap-2 rounded-xl px-5 py-3 font-black text-[#04121c] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: brand }}
              >
                {busy ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : saved && changed.length === 0 ? (
                  <Check className="h-4.5 w-4.5" />
                ) : (
                  <Save className="h-4.5 w-4.5" />
                )}
                {saved && changed.length === 0
                  ? "حُفظ"
                  : changed.length > 0
                    ? `حفظ ${changed.length} تغييراً`
                    : "حفظ"}
              </button>

              <button
                onClick={resetAll}
                disabled={busy || configured.length === 0}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                title="حذف القيم المخصّصة والعودة إلى الافتراضي"
              >
                <RotateCcw className="h-4 w-4" />
                إعادة الضبط
              </button>
            </div>
          )}
        </motion.div>

        {/* ================= المعاينة ================= */}
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: MOTION.duration.normal, delay: 0.1, ease: MOTION.easing.enter }}
          className="space-y-4 lg:sticky lg:top-6 lg:self-start"
        >
          <h2 className="text-sm font-black text-white/70">المعاينة</h2>

          {/* شعار الترويسة */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 text-[11px] text-white/40">شعار الترويسة</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black">{value("school.short_name")}</span>
              <span className="text-2xl font-black" style={{ color: brand }}>
                {value("school.short_suffix")}
              </span>
            </div>
            <div className="mt-1 text-sm text-white/60">{value("school.name_ar")}</div>
          </div>

          {/* بطاقة الدخول */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 text-[11px] text-white/40">شاشة الدخول</div>
            <div className="flex flex-col items-center gap-2 rounded-xl bg-black/30 p-5 text-center">
              <span
                className="grid h-12 w-12 place-items-center rounded-2xl"
                style={{ background: `${brand}22` }}
              >
                <Building2 className="h-6 w-6" style={{ color: brand }} />
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black">{value("school.short_name")}</span>
                <span className="text-lg font-black" style={{ color: brand }}>
                  {value("school.short_suffix")}
                </span>
              </div>
              <div className="text-[11px] text-white/50">{value("school.name_ar")}</div>
            </div>
          </div>

          {/* الإيصال */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 text-[11px] text-white/40">ترويسة الإيصال</div>
            <div className="rounded-lg bg-white px-4 py-4 text-center text-black">
              {/* الشعار بمرشّحه كما سيُطبع — لا نسخة مكبَّرة نظيفة */}
              {previewLogo.src && (
                <img
                  src={previewLogo.src}
                  alt=""
                  className="mx-auto mb-1 block h-auto object-contain"
                  style={{ width: `${previewLogo.widthMm}mm`, filter: previewLogo.filter }}
                />
              )}
              <div className="text-base font-black">{value("school.name_ar")}</div>
              {value("school.name_en") && (
                <div className="text-[11px] text-black/60">{value("school.name_en")}</div>
              )}
              {value("school.address") && (
                <div className="mt-1 text-[11px] text-black/70">{value("school.address")}</div>
              )}
              {value("school.phone") && (
                <div className="text-[11px] text-black/70" dir="ltr">
                  {value("school.phone")}
                </div>
              )}
              <div className="my-2 border-t border-dashed border-black/30" />
              <div className="text-[11px] text-black/60">
                المبلغ: 1 500 {value("school.currency")}
              </div>
              {value("school.receipt_note") && (
                <div className="mt-2 text-[10px] text-black/60">
                  {value("school.receipt_note")}
                </div>
              )}
              {value("school.receipt_thanks") && (
                <div className="mt-1 text-[11px] font-bold text-black/80">
                  {value("school.receipt_thanks")}
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}

// --------------------------------------------------
// الشعار — رفعه وضبطه للطباعة
// --------------------------------------------------

interface LogoPanelProps {
  canEdit: boolean;
  configured: string[];
  value: (key: string) => string;
  set: (key: string, next: string) => void;
  onError: (message: string | null) => void;
}

const SLIDERS: {
  key: string;
  label: string;
  hint: string;
  range: readonly [number, number];
  unit: string;
  step: number;
}[] = [
  {
    key: "school.logo_width_mm",
    label: "العرض",
    hint: "عرض الشعار على الورقة بالمليمتر. ورق الإيصالات 72 أو 80 مم، فـ18 مم نحو ربع العرض.",
    range: LOGO_RANGES.width,
    unit: "مم",
    step: 1,
  },
  {
    key: "school.logo_contrast",
    label: "التباين",
    hint: "يشدّ الرمادي نحو الأبيض والأسود. ارفعه إن خرجت الحوافّ مهترئة على الطابعة الحرارية.",
    range: LOGO_RANGES.contrast,
    unit: "%",
    step: 5,
  },
  {
    key: "school.logo_clarity",
    label: "الوضوح",
    hint: "يزيح العتبة التي يصير عندها الرمادي أسود: ارفعه إن خرج الشعار كتلةً سوداء، واخفضه إن خرج باهتاً.",
    range: LOGO_RANGES.clarity,
    unit: "%",
    step: 5,
  },
];

function LogoPanel({ canEdit, configured, value, set, onError }: LogoPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const spec = logoSpec(
    {},
    {
      path: value("school.logo_path"),
      width: value("school.logo_width_mm"),
      contrast: value("school.logo_contrast"),
      clarity: value("school.logo_clarity"),
    },
  );

  const pick = async (file: File | undefined) => {
    if (!file) return;

    setUploading(true);
    onError(null);

    try {
      /*
       * الرفع فوريّ لكنّ المسار يدخل المسوّدة لا الإعدادات: لا يصير
       * الشعار شعارَ المؤسّسة قبل أن يضغط المستخدم «حفظ».
       */
      set("school.logo_path", await uploadImage(file));
      uiSound("success");
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string } } }).response;
      onError(response?.data?.message ?? "تعذّر رفع الشعار");
      uiSound("error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <h2 className="mb-1 text-sm font-black text-white/70">
        شعار المؤسسة
        {LOGO_KEYS.some((k) => configured.includes(k)) && (
          <span className="ms-2 text-[10px] font-normal text-white/35">مضبوط</span>
        )}
      </h2>
      <p className="mb-4 text-[11px] leading-relaxed text-white/40">
        يُطبع فوق الاسم في كل فاتورة وإيصال. الطابعة الحرارية ثنائية
        اللون، لذلك يُضبط التباين والوضوح هنا لا في برنامج الصور.
      </p>

      <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
        {/* المعاينة على أبيض — الورق أبيض لا داكن */}
        <div>
          <div className="mb-2 flex min-h-33 items-center justify-center rounded-xl bg-white p-3">
            {spec.src ? (
              <img
                src={spec.src}
                alt="شعار المؤسسة"
                className="h-auto max-w-full object-contain"
                style={{ width: `${spec.widthMm}mm`, filter: spec.filter }}
              />
            ) : (
              <span className="text-xs text-black/35">لا شعار</span>
            )}
          </div>

          {canEdit && (
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-bold transition hover:bg-white/20 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" />
                )}
                {spec.src ? "استبدال" : "رفع شعار"}
              </button>

              {spec.src && (
                <button
                  onClick={() => set("school.logo_path", "")}
                  title="إزالة الشعار"
                  className="grid h-9.5 w-9.5 place-items-center rounded-xl bg-white/10 text-white/60 transition hover:bg-rose-500/20 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <p className="mt-2 text-[10px] leading-relaxed text-white/30">
            PNG أو JPG أو WEBP · 3 ميغابايت كحدّ أقصى. الخلفية الشفافة
            تُطبع بيضاء.
          </p>
        </div>

        {/* المؤشّرات — معطّلة بلا شعار فلا يُضبط ما لا يُرى */}
        <div className="space-y-4">
          {SLIDERS.map((s) => {
            const current = Number(value(s.key)) || s.range[0];

            return (
              <div key={s.key}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-xs font-bold text-white/60">{s.label}</span>
                  <span className="text-[11px] text-white/40" dir="ltr">
                    {current} {s.unit}
                  </span>
                </div>

                <input
                  type="range"
                  disabled={!canEdit || !spec.src}
                  min={s.range[0]}
                  max={s.range[1]}
                  step={s.step}
                  value={current}
                  onChange={(e) => set(s.key, e.target.value)}
                  className="w-full accent-sky-300 disabled:opacity-30"
                  dir="ltr"
                />

                <p className="mt-1 text-[10px] leading-relaxed text-white/35">{s.hint}</p>
              </div>
            );
          })}

          {!spec.src && (
            <p className="text-[11px] text-white/30">ارفع شعاراً أولاً لتضبطه.</p>
          )}
        </div>
      </div>
    </>
  );
}
