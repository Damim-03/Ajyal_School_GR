import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  FolderCheck,
  Loader2,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { Avatar } from "../../components/shared/Avatar";
import { FormDialog, FormGrid, FormRow } from "../../components/shared/FormDialog";
import { useAuthStore } from "../../core/stores/auth.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";
import { ImageIntake } from "../../components/shared/ImageIntake";
import { TeacherDocumentsPanel } from "./TeacherDocuments";
import {
  createTeacher,
  deleteTeacher,
  dmy,
  getTeacher,
  listTeachers,
  updateTeacher,
  yearsOfService,
  GENDER_LABEL,
  type Gender,
  uploadImage,
  type Pagination,
  type TeacherBody,
  type TeacherDetail,
  type TeacherRow,
} from "./teachers.api";

const ACCENT = "#5eead4";
const PAGE_SIZE = 15;

/**
 * قائمة الأساتذة.
 *
 * الراتب غائبٌ عن الجدول عمداً — الخادم يستثنيه من تحديد القائمة
 * ويُظهره في الملف وحده. وهو قرارٌ صائب: جدولٌ يُفتح على شاشةٍ في
 * مكتب الاستقبال لا ينبغي أن يحمل رواتب من يمرّ خلفها.
 */
export default function TeachersPage() {
  const exitTo = useScreenExit();
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.hasPermission);

  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [status, setStatus] = useState<"" | "true" | "false">("true");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<TeacherRow | "new" | null>(null);
  const [removing, setRemoving] = useState<TeacherRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [debounced, gender, status]);

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(debounced && { search: debounced }),
      ...(gender && { gender }),
      ...(status && { isActive: status === "true" }),
    }),
    [page, debounced, gender, status],
  );

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listTeachers(query);
      setRows(r.teachers);
      setPagination(r.pagination);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر جلب الأساتذة");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 2400);
  };

  /** التعطيل بديلُ الحذف حين يكون للأستاذ إسناد — وهو الحال الغالب */
  const toggleActive = async (row: TeacherRow) => {
    setBusyId(row.id);
    const before = rows;

    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)),
    );

    try {
      await updateTeacher(row.id, { isActive: !row.isActive });
      flash(row.isActive ? "عُطِّل الأستاذ" : "فُعِّل الأستاذ");
      if (status) await fetchRows();
    } catch (err: any) {
      setRows(before);
      setError(err?.response?.data?.message ?? "تعذّر تغيير الحالة");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusyId(removing.id);
    try {
      await deleteTeacher(removing.id);
      setRemoving(null);
      await fetchRows();
      flash("حُذف الأستاذ");
    } catch (err: any) {
      setError(
        err?.response?.status === 409
          ? "لا يُحذف أستاذٌ له إسناد تدريسي — عطّله بدل حذفه، فحذفُه ييتّم جداوله وحصصه."
          : (err?.response?.data?.message ?? "تعذّر الحذف"),
      );
      setRemoving(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="قائمة الأساتذة" subtitle="الملف الإداري">
        <button
          onClick={() => exitTo(PATHS.teachers)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-350 p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
          className="mb-5 flex flex-wrap items-center gap-3"
        >
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الهاتف أو البريد…"
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pe-4 ps-10 outline-none transition focus:border-white/30"
            />
          </div>

          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender | "")}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-bold outline-none"
          >
            <option value="" className="bg-[#0a0f1a]">الجنس: الكل</option>
            <option value="MALE" className="bg-[#0a0f1a]">ذكر</option>
            <option value="FEMALE" className="bg-[#0a0f1a]">أنثى</option>
          </select>

          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
            {([
              { v: "true", label: "النشطون" },
              { v: "false", label: "المعطَّلون" },
              { v: "", label: "الكل" },
            ] as const).map((o) => (
              <button
                key={o.v}
                onClick={() => setStatus(o.v)}
                className="rounded-lg px-3 py-1.5 text-xs font-bold transition"
                style={
                  status === o.v
                    ? { background: `${ACCENT}22`, color: ACCENT }
                    : { color: "rgba(255,255,255,0.5)" }
                }
              >
                {o.label}
              </button>
            ))}
          </div>

          {can("teacher.create") && (
            <button
              onClick={() => setEditing("new")}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-black text-[#041f1c] transition hover:brightness-110"
              style={{ background: ACCENT }}
            >
              <Plus className="h-4.5 w-4.5" />
              أستاذ جديد
            </button>
          )}
        </motion.div>

        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/50">
                <th className="px-4 py-3 text-start font-bold">الاسم واللقب</th>
                <th className="px-4 py-3 text-start font-bold">الهاتف</th>
                <th className="px-4 py-3 text-start font-bold">التخصّص</th>
                <th className="px-4 py-3 text-start font-bold">المؤهّل</th>
                <th className="px-4 py-3 text-start font-bold">التوظيف</th>
                <th className="px-3 py-3 text-center font-bold">الإسنادات</th>
                <th className="px-3 py-3 text-center font-bold">الحالة</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-white/30" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Users className="mx-auto mb-3 h-10 w-10 text-white/15" />
                    <p className="text-white/55">
                      {debounced || gender || status === "false"
                        ? "لا أستاذ يطابق هذه التصفية"
                        : "لا أساتذة بعد — ابدأ بإضافة أستاذ"}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => {
                          uiSound("navigate");
                          navigate(PATHS.teacherDetail(row.id));
                        }}
                        className="flex items-center gap-2.5 text-start transition hover:text-white"
                      >
                        <Avatar
                          src={row.avatar}
                          name={`${row.lastName} ${row.firstName}`}
                          gender={row.gender}
                          size={32}
                        />
                        <span>
                          <span className="block font-bold">
                            {row.lastName} {row.firstName}
                          </span>
                          <span className="block text-[11px] text-white/35">
                            {GENDER_LABEL[row.gender]}
                            {row.email && ` · ${row.email}`}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-white/70" dir="ltr">
                      {row.phone || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-white/70">{row.specialization || "—"}</td>
                    <td className="px-4 py-2.5 text-white/60">{row.qualification || "—"}</td>
                    <td className="px-4 py-2.5 text-white/60">
                      <span dir="ltr">{dmy(row.hireDate)}</span>
                      <span className="ms-1.5 text-[11px] text-white/35">
                        ({yearsOfService(row.hireDate)} سنة)
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-black" style={{ color: ACCENT }}>
                        {row._count?.teachingAssignments ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={
                          row.isActive
                            ? { background: "rgba(134,239,172,0.14)", color: "#86efac" }
                            : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }
                        }
                      >
                        {row.isActive ? "نشط" : "معطَّل"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {can("teacher.update") && (
                          <>
                            <button
                              title="تعديل"
                              onClick={() => setEditing(row)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-white/55 transition hover:bg-white/15 hover:text-white"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              title={row.isActive ? "تعطيل" : "تفعيل"}
                              disabled={busyId === row.id}
                              onClick={() => toggleActive(row)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-white/55 transition hover:bg-amber-500/20 hover:text-amber-300"
                            >
                              {busyId === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </button>
                          </>
                        )}
                        {can("teacher.delete") && (
                          <button
                            title="حذف"
                            onClick={() => setRemoving(row)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-white/55 transition hover:bg-rose-500/20 hover:text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-white/50">
            <span>
              {pagination.total} أستاذاً · صفحة {pagination.page} من {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs disabled:opacity-30"
              >
                السابق
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs disabled:opacity-30"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <TeacherDialog
          teacher={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={async (message) => {
            setEditing(null);
            await fetchRows();
            flash(message);
          }}
        />
      )}

      {removing && (
        <>
          <div onClick={() => setRemoving(null)} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-105 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0a0f1a] p-6">
            <h3 className="mb-2 text-lg font-black">حذف الأستاذ</h3>
            <p className="mb-5 text-sm leading-relaxed text-white/60">
              سيُحذف{" "}
              <span className="font-bold text-white">
                {removing.lastName} {removing.firstName}
              </span>
              .
              <br />
              إن كان له إسنادٌ تدريسي فسيمنع الخادمُ الحذف — عندها عطّله بدل حذفه.
            </p>
            <div className="flex gap-3">
              <button
                onClick={remove}
                disabled={busyId === removing.id}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 font-bold transition hover:bg-rose-400 disabled:opacity-50"
              >
                {busyId === removing.id && <Loader2 className="h-4 w-4 animate-spin" />}
                حذف
              </button>
              <button
                onClick={() => setRemoving(null)}
                className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold transition hover:bg-white/20"
              >
                تراجع
              </button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-2.5 text-sm font-bold text-emerald-100 backdrop-blur"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}

// --------------------------------------------------
// إضافة أستاذ وتعديله — خطوتان في نافذةٍ واحدة
//
// **معلوماتُه** ثمّ **وثائقُه**، على هيئة تسجيل الطالب نفسِها — وليس
// ذلك تجميلاً ولا تقليداً: مسارُ رفع الوثيقة `/teachers/:id/documents`
// يحتاج رقمَ الأستاذ، فلا سبيل لرفع ورقةٍ قبل حفظ سطوره. وعرضُ
// الخانتين معاً كان سيُظهر خانات مسحٍ لا تعمل.
//
// فالخطوة الأولى تنتهي بحفظٍ حقيقي: الأستاذ موجودٌ قبل الثانية، ومن
// انصرف بعدها بقي مسجَّلاً بملفٍّ ناقص — وهي حالٌ صحيحة يعرضها ملفُّه
// صراحةً. ولهذا يختفي «إلغاء» في الثانية: لم يبقَ ما يُلغى، وإبقاؤه
// يوهم أنّ الضغط عليه يمحو ما حُفظ.
//
// والراتب في النموذج لا في الجدول: يُكتب مرّةً عند التوظيف ويُقرأ
// نادراً، وإظهاره في القائمة يعرّضه لكل عابر.
// --------------------------------------------------

const iso = (value: string | null) => (value ? value.slice(0, 10) : "");

const FORM_ID = "teacher-form";

function TeacherDialog({
  teacher,
  onClose,
  onDone,
}: {
  teacher: TeacherRow | null;
  onClose: () => void;
  /** يُنادى عند إغلاق النافذة بعد عملٍ محفوظ — لتُنعش القائمة خلفها */
  onDone: (message: string) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);

  /** الأستاذ بعد حفظ الخطوة الأولى — إليه تُرفع الوثائق */
  const [saved, setSaved] = useState<TeacherDetail | null>(null);
  const [delivered, setDelivered] = useState(0);

  const [form, setForm] = useState<TeacherBody>({
    firstName: teacher?.firstName ?? "",
    lastName: teacher?.lastName ?? "",
    gender: teacher?.gender ?? "MALE",
    avatar: teacher?.avatar ?? null,
    hireDate: iso(teacher?.hireDate ?? null),
    email: teacher?.email ?? "",
    phone: teacher?.phone ?? "",
    birthDate: iso(teacher?.birthDate ?? null),
    qualification: teacher?.qualification ?? "",
    specialization: teacher?.specialization ?? "",
    address: "",
    salary: null,
  });

  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * العنوانُ والراتب يُجلبان عند التعديل — والقائمة لا تحملهما.
   *
   * الخادم يستثنيهما من تحديد القائمة عمداً (راتبٌ في جدولٍ يراه كلّ
   * عابر)، فالصفُّ الذي تُفتح منه النافذة يصل بلا هذين. وكانا يُرسلان
   * فارغين مع الحفظ فيُمحى راتبُ الأستاذ وعنوانُه بمجرّد تصحيح رقم
   * هاتفه. فما لم يصل لا يُرسَل: `null` هنا معناه «لم يُقرأ بعد» لا
   * «لا قيمة له».
   */
  const [extras, setExtras] = useState<{
    address: string | null;
    salary: number | null;
  } | null>(teacher ? null : { address: null, salary: null });

  const teacherId = teacher?.id;

  useEffect(() => {
    if (!teacherId) return;
    let alive = true;

    getTeacher(teacherId)
      .then((detail) => {
        if (!alive) return;
        setExtras({ address: detail.address, salary: detail.salary });
        setForm((prev) => ({
          ...prev,
          address: detail.address ?? "",
          salary: detail.salary,
        }));
      })
      .catch(() => {
        /* تعذّر الجلب: يبقى `extras` فارغاً فلا يُرسَل الحقلان أصلاً */
      });

    return () => {
      alive = false;
    };
  }, [teacherId]);

  const set = <K extends keyof TeacherBody>(key: K, value: TeacherBody[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /* الصورة تُرفع فور اختيارها ويُحفظ مسارُها — كصورة الطالب */
  const pickPhoto = async (picked: File) => {
    setUploading(true);
    setError(null);

    try {
      set("avatar", await uploadImage(picked));
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string } } }).response;
      setError(response?.data?.message ?? "تعذّر رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    /* الفراغ يُرسَل null لا "" — الخادم يرفض بريداً فارغاً لا بريداً غائباً */
    const body: TeacherBody = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      gender: form.gender,
      avatar: form.avatar || null,
      hireDate: form.hireDate,
      email: form.email?.trim() || null,
      phone: form.phone?.trim() || null,
      birthDate: form.birthDate || null,
      qualification: form.qualification?.trim() || null,
      specialization: form.specialization?.trim() || null,
      /* لا يُرسلان قبل قراءتهما — والإرسالُ الفارغ محوٌ لا حفظ */
      ...(extras && {
        address: form.address?.trim() || null,
        salary: form.salary || null,
      }),
    };

    try {
      const result = teacher
        ? await updateTeacher(teacher.id, body)
        : await createTeacher(body);

      setSaved(result);
      setStep(2);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const valid =
    form.firstName.trim().length >= 2 &&
    form.lastName.trim().length >= 2 &&
    Boolean(form.hireDate);

  const fullName = `${form.lastName} ${form.firstName}`.trim() || "أستاذ جديد";

  /** يبدأ أستاذاً جديداً في النافذة نفسها — الإدارة توظّف دفعةً معاً */
  const again = () => {
    setSaved(null);
    setDelivered(0);
    setError(null);
    setStep(1);
    setExtras({ address: null, salary: null });
    setForm({
      firstName: "",
      lastName: "",
      gender: "MALE",
      avatar: null,
      hireDate: "",
      email: "",
      phone: "",
      birthDate: "",
      qualification: "",
      specialization: "",
      address: "",
      salary: null,
    });
  };

  /* الإنهاء يُغلق النافذة ويُنعش القائمة بخبرٍ يذكر ما سُلّم */
  const finish = () => {
    const head = teacher ? "حُفظ الأستاذ" : "أُضيف الأستاذ";
    onDone(delivered === 0 ? head : `${head} — ${delivered} وثيقة في ملفّه`);
  };

  return (
    <FormDialog
      icon={step === 1 ? UserRound : FolderCheck}
      title={teacher ? "تعديل الأستاذ" : "أستاذ جديد"}
      subtitle="المعلومات ثمّ الوثائق"
      tone={ACCENT}
      /* في الثانية صار العملُ محفوظاً — فالإغلاق إنهاءٌ يُنعش القائمة */
      onClose={step === 2 ? finish : onClose}
      /* الأولى تُرسل حقولَ الأستاذ، والثانية زرُّها إنهاءٌ لا حفظ */
      submitForm={step === 1 ? FORM_ID : undefined}
      onSubmit={
        step === 2
          ? (event) => {
              event.preventDefault();
              finish();
            }
          : undefined
      }
      busy={busy}
      submitDisabled={step === 1 && (!valid || uploading)}
      submitLabel={step === 1 ? "حفظ ومتابعة إلى الوثائق" : "إنهاء"}
      submitIcon={
        step === 1 ? <UserRound className="h-4.5 w-4.5" /> : <Check className="h-4.5 w-4.5" />
      }
      hideCancel={step === 2}
      error={error}
      footerExtra={
        step === 2 && !teacher ? (
          <button
            type="button"
            onClick={again}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
          >
            <Plus className="h-4 w-4" />
            أستاذ آخر
          </button>
        ) : undefined
      }
      headerExtra={<Steps step={step} delivered={delivered} />}
    >
      {step === 1 && (
        /*
          نموذجٌ بمعرّف: زرُّ الحفظ ملتصقٌ بقاع النافذة لا بآخر الحقول،
          و`form="id"` يربطه بنموذجٍ خارجه — وهو الحلّ المعياري لا حيلة.
        */
        <form id={FORM_ID} onSubmit={save} className="space-y-5">
          {/* ===== الصورة ===== */}
          <div className="flex items-center gap-4">
            <Avatar src={form.avatar} name={fullName} gender={form.gender} size={72} />

            <div className="flex flex-col gap-2">
              {/*
                نسبة 3:4 مفروضة لا مقترحة: الصورة تُطبع في إطار 25×32 مم
                على شهادة العمل، وصورةٌ بنسبةٍ أخرى إمّا تُمطّ أو يُقتصّ
                منها آلياً — والقصّ الآلي يقطع الذقن أو أعلى الرأس.
              */}
              <ImageIntake
                aspect="3:4"
                editorTitle="صورة الأستاذ"
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
            </div>
          </div>

          <FormGrid>
            <FormRow>
              <Input label="الاسم" required value={form.firstName} onChange={(v) => set("firstName", v)} />
            </FormRow>
            <FormRow>
              <Input label="اللقب" required value={form.lastName} onChange={(v) => set("lastName", v)} />
            </FormRow>

            <FormRow>
              <Field label="الجنس" required>
                {/* زرّان لا قائمة: خياران اثنان يُريان بلا فتح */}
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
            </FormRow>

            <FormRow>
              <Input
                label="تاريخ التوظيف"
                required
                type="date"
                value={form.hireDate}
                onChange={(v) => set("hireDate", v)}
                hint="منه تُحسب الأقدميّة على شهادة العمل"
              />
            </FormRow>

            <FormRow>
              <Input label="الهاتف" value={form.phone ?? ""} onChange={(v) => set("phone", v)} ltr />
            </FormRow>
            <FormRow>
              <Input label="البريد" value={form.email ?? ""} onChange={(v) => set("email", v)} ltr />
            </FormRow>

            <FormRow>
              <Input
                label="تاريخ الميلاد"
                type="date"
                value={form.birthDate ?? ""}
                onChange={(v) => set("birthDate", v)}
              />
            </FormRow>
            <FormRow>
              <Input
                label="التخصّص"
                value={form.specialization ?? ""}
                onChange={(v) => set("specialization", v)}
              />
            </FormRow>

            <FormRow>
              <Input
                label="المؤهّل"
                value={form.qualification ?? ""}
                onChange={(v) => set("qualification", v)}
              />
            </FormRow>
            <FormRow>
              <Input
                label="الراتب"
                type="number"
                value={form.salary === null || form.salary === undefined ? "" : String(form.salary)}
                onChange={(v) => set("salary", v ? Number(v) : null)}
                ltr
                hint="اختياري — لا يظهر في القائمة"
              />
            </FormRow>

            <FormRow wide>
              <Field label="العنوان">
                <textarea
                  value={form.address ?? ""}
                  onChange={(e) => set("address", e.target.value)}
                  rows={2}
                  maxLength={200}
                  className={`${fieldClass} resize-none`}
                />
              </Field>
            </FormRow>
          </FormGrid>
        </form>
      )}

      {step === 2 && saved && (
        <div className="space-y-5">
          <div className="flex items-center gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-5">
            <Avatar
              src={saved.avatar}
              name={`${saved.lastName} ${saved.firstName}`}
              gender={saved.gender}
              size={52}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-black text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                {teacher ? "حُفظت المعلومات" : "سُجِّل الأستاذ"}
              </div>
              <div className="text-lg font-black">
                {saved.lastName} {saved.firstName}
              </div>
              <div className="text-[11px] text-white/45">
                امسح ما سلّمه من أوراق الآن، أو أنهِ وأكملها لاحقاً من ملفّه.
              </div>
            </div>
          </div>

          <TeacherDocumentsPanel
            teacherId={saved.id}
            onChange={(file) => setDelivered(file.delivered)}
          />
        </div>
      )}
    </FormDialog>
  );
}

/** مؤشّر الخطوتين — ثابتٌ تحت الترويسة لا يتمرّر مع الحقول */
function Steps({ step, delivered }: { step: 1 | 2; delivered: number }) {
  return (
    <div className="flex items-center gap-3">
      <Dot n={1} label="المعلومات" active={step === 1} done={step > 1} />
      <div
        className="h-0.5 flex-1 rounded"
        style={{ background: step > 1 ? ACCENT : "rgba(255,255,255,0.1)" }}
      />
      <Dot n={2} label="الوثائق" active={step === 2} done={delivered > 0} />
    </div>
  );
}

function Dot({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid h-9 w-9 place-items-center rounded-full text-sm font-black transition"
        style={
          done
            ? { background: "rgba(134,239,172,0.18)", color: "#86efac" }
            : active
              ? { background: ACCENT, color: "#04121c" }
              : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }
        }
      >
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      <span
        className="text-sm font-bold"
        style={{ color: active || done ? "#fff" : "rgba(255,255,255,0.4)" }}
      >
        {label}
      </span>
    </div>
  );
}

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none transition focus:border-white/30";

/** تسميةٌ فوق حقلٍ أيّاً كان شكلُه — زرَّين أو منطقةَ نصّ */
function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-xs font-bold text-white/60">
        {label}
        {required && <span className="text-rose-300"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-white/35">{hint}</span>}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
  ltr,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  ltr?: boolean;
  hint?: string;
}) {
  return (
    <Field label={label} required={required} hint={hint}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={ltr ? "ltr" : undefined}
        className={fieldClass}
      />
    </Field>
  );
}
