import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
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
import {
  createTeacher,
  deleteTeacher,
  dmy,
  listTeachers,
  updateTeacher,
  yearsOfService,
  GENDER_LABEL,
  type Gender,
  type Pagination,
  type TeacherBody,
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
// إضافة أستاذ وتعديله
//
// الراتب في النموذج لا في الجدول: يُكتب مرّةً عند التوظيف ويُقرأ
// نادراً، وإظهاره في القائمة يعرّضه لكل عابر.
// --------------------------------------------------

const iso = (value: string | null) => (value ? value.slice(0, 10) : "");

function TeacherDialog({
  teacher,
  onClose,
  onDone,
}: {
  teacher: TeacherRow | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [form, setForm] = useState<TeacherBody>({
    firstName: teacher?.firstName ?? "",
    lastName: teacher?.lastName ?? "",
    gender: teacher?.gender ?? "MALE",
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
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof TeacherBody>(key: K, value: TeacherBody[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    /* الفراغ يُرسَل null لا "" — الخادم يرفض بريداً فارغاً لا بريداً غائباً */
    const body: TeacherBody = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      gender: form.gender,
      hireDate: form.hireDate,
      email: form.email?.trim() || null,
      phone: form.phone?.trim() || null,
      birthDate: form.birthDate || null,
      qualification: form.qualification?.trim() || null,
      specialization: form.specialization?.trim() || null,
      address: form.address?.trim() || null,
      salary: form.salary || null,
    };

    try {
      if (teacher) {
        await updateTeacher(teacher.id, body);
        onDone("حُفظ الأستاذ");
      } else {
        await createTeacher(body);
        onDone("أُضيف الأستاذ");
      }
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

  return (
    <FormDialog
      icon={UserRound}
      title={teacher ? "تعديل الأستاذ" : "أستاذ جديد"}
      subtitle="الاسم واللقب وتاريخ التوظيف إلزامية، وما عداها يُكمَّل لاحقاً."
      tone={ACCENT}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitDisabled={!valid}
      submitLabel={teacher ? "حفظ" : "إضافة"}
      submitIcon={<Plus className="h-4.5 w-4.5" />}
      error={error}
    >
      <FormGrid>
        <FormRow>
          <Input label="الاسم" required value={form.firstName} onChange={(v) => set("firstName", v)} />
        </FormRow>
        <FormRow>
          <Input label="اللقب" required value={form.lastName} onChange={(v) => set("lastName", v)} />
        </FormRow>

        <FormRow>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">الجنس</span>
            <select
              value={form.gender}
              onChange={(e) => set("gender", e.target.value as Gender)}
              className={fieldClass}
            >
              <option value="MALE" className="bg-[#0a0f1a]">ذكر</option>
              <option value="FEMALE" className="bg-[#0a0f1a]">أنثى</option>
            </select>
          </label>
        </FormRow>

        <FormRow>
          <Input
            label="تاريخ التوظيف"
            required
            type="date"
            value={form.hireDate}
            onChange={(v) => set("hireDate", v)}
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
            value={form.salary === null ? "" : String(form.salary)}
            onChange={(v) => set("salary", v ? Number(v) : null)}
            ltr
            hint="اختياري — لا يظهر في القائمة"
          />
        </FormRow>

        <FormRow wide>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">العنوان</span>
            <textarea
              value={form.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
              rows={2}
              maxLength={200}
              className={`${fieldClass} resize-none`}
            />
          </label>
        </FormRow>
      </FormGrid>
    </FormDialog>
  );
}

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none transition focus:border-white/30";

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
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-white/60">
        {label}
        {required && <span className="text-rose-300"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={ltr ? "ltr" : undefined}
        className={fieldClass}
      />
      {hint && <span className="mt-1 block text-[11px] text-white/35">{hint}</span>}
    </label>
  );
}
