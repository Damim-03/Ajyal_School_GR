import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  Pencil,
  School,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  VenusAndMars,
  X,
} from "lucide-react";

import {
  groupLabel,
  useAcademicYears,
  useLevels,
  useStudyGroups,
  useSubjects,
} from "../../core/api/reference.api";

import { AppHeader } from "../../components/AppHeader";
import { Avatar } from "../../components/shared/Avatar";
import { useAuthStore } from "../../core/stores/auth.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { StudentForm } from "./StudentForm";
import { StudentRegisterDialog } from "./StudentRegisterDialog";
import {
  deleteStudent,
  listStudents,
  updateStudent,
  type Gender,
  type Pagination,
  type Student,
} from "./student.api";

const ACCENT = "#7dd3fc";
const PAGE_SIZE = 15;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-DZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

/** العمر مشتقّ لا مخزَّن — المخطّط يحفظ تاريخ الميلاد وحده */
const ageOf = (birthDate: string | null): number | null => {
  if (!birthDate) return null;

  const born = new Date(birthDate);
  const now = new Date();

  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age--;

  return age >= 0 && age < 120 ? age : null;
};

export default function StudentsPage() {
  const exitToHome = useScreenExit();
  const navigate = useNavigate();

  const can = useAuthStore((s) => s.hasPermission);

  const [rows, setRows] = useState<Student[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [subjectId, setSubjectId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [studyGroupId, setStudyGroupId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [page, setPage] = useState(1);

  /* البيانات المرجعية للقوائم المنسدلة */
  const subjects = useSubjects();
  const levels = useLevels();
  const groups = useStudyGroups();
  const years = useAcademicYears();

  const [editing, setEditing] = useState<Student | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirming, setConfirming] = useState<Student | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  /* البحث لا يُرسَل مع كل ضغطة مفتاح */
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  /* أي تغيير في المرشِّحات يُعيد إلى الصفحة الأولى — وإلا بقيت صفحة 7 لنتيجة من صفحتين */
  useEffect(
    () => setPage(1),
    [debounced, gender, active, subjectId, levelId, studyGroupId, academicYearId],
  );

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(debounced && { search: debounced }),
      ...(gender && { gender }),
      ...(active && { isActive: active === "true" }),
      ...(subjectId && { subjectId }),
      ...(levelId && { levelId }),
      ...(studyGroupId && { studyGroupId }),
      ...(academicYearId && { academicYearId }),
    }),
    [page, debounced, gender, active, subjectId, levelId, studyGroupId, academicYearId],
  );

  const fetchRows = async () => {
    setLoading(true);
    setError(null);

    try {
      const { students, pagination: p } = await listStudents(query);
      setRows(students);
      setPagination(p);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string } } }).response;
      setError(response?.data?.message ?? "تعذّر جلب الطلبة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const toggleActive = async (student: Student) => {
    setRowBusy(student.id);

    try {
      await updateStudent(student.id, { isActive: !student.isActive });
      await fetchRows();
    } catch {
      setError("تعذّر تغيير الحالة");
    } finally {
      setRowBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!confirming) return;

    setRowBusy(confirming.id);

    try {
      await deleteStudent(confirming.id);
      setConfirming(null);
      await fetchRows();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string } } }).response;
      setError(response?.data?.message ?? "تعذّر الحذف");
      setConfirming(null);
    } finally {
      setRowBusy(null);
    }
  };

  const filtersOn =
    !!debounced || !!gender || !!active || !!subjectId || !!levelId ||
    !!studyGroupId || !!academicYearId;

  const clearFilters = () => {
    setSearch("");
    setGender("");
    setActive("");
    setSubjectId("");
    setLevelId("");
    setStudyGroupId("");
    setAcademicYearId("");
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="الطلبة" subtitle="شؤون الطلبة">
        <button
          onClick={() => exitToHome(PATHS.students)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-350 p-6">
        {/* ================= شريط الأدوات ================= */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
          className="mb-5 flex flex-wrap items-center gap-3"
        >
          <div className="relative min-w-70 flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الهاتف أو هاتف ولي الأمر…"
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pe-4 ps-10 outline-none transition focus:border-white/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-white/40 transition hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Segmented
            icon={<VenusAndMars className="h-4 w-4" />}
            value={gender}
            onChange={(v) => setGender(v as Gender | "")}
            options={[
              { value: "", label: "الكل" },
              { value: "MALE", label: "ذكور" },
              { value: "FEMALE", label: "إناث" },
            ]}
          />

          <Segmented
            value={active}
            onChange={(v) => setActive(v as "" | "true" | "false")}
            options={[
              { value: "", label: "الكل" },
              { value: "true", label: "نشط" },
              { value: "false", label: "معطّل" },
            ]}
          />

          {can("student.create") && (
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-black text-[#04121c] transition hover:brightness-110"
              style={{ background: ACCENT }}
            >
              <UserPlus className="h-4.5 w-4.5" />
              طالب جديد
            </button>
          )}
        </motion.div>

        {/* ===== الفلاتر التي تمرّ عبر التسجيل ===== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, delay: 0.05 }}
          className="mb-5 flex flex-wrap items-center gap-3"
        >
          <Dropdown
            icon={<CalendarDays className="h-4 w-4" />}
            label="السنة الدراسية"
            value={academicYearId}
            onChange={setAcademicYearId}
            options={years.data ?? []}
          />
          <Dropdown
            icon={<BookOpen className="h-4 w-4" />}
            label="المادة"
            value={subjectId}
            onChange={setSubjectId}
            options={subjects.data ?? []}
          />
          <Dropdown
            icon={<Layers className="h-4 w-4" />}
            label="المستوى"
            value={levelId}
            onChange={setLevelId}
            options={levels.data ?? []}
          />
          <Dropdown
            icon={<School className="h-4 w-4" />}
            label="الفوج"
            value={studyGroupId}
            onChange={setStudyGroupId}
            /* «فوج 1» وحده لا يميّز: الاسم فريد داخل المستوى فقط */
            options={(groups.data ?? []).map((g) => ({ id: g.id, name: groupLabel(g) }))}
          />

          {filtersOn && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white/50 transition hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              إزالة الكل
            </button>
          )}
        </motion.div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ================= الجدول ================= */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/50">
                <th className="px-4 py-3 text-start font-bold">الطالب</th>
                <th className="px-4 py-3 text-start font-bold">الجنس</th>
                <th className="px-4 py-3 text-start font-bold">هاتف ولي الأمر</th>
                <th className="px-4 py-3 text-start font-bold">هاتف الطالب</th>
                <th className="px-4 py-3 text-start font-bold">التسجيل</th>
                <th className="px-4 py-3 text-center font-bold">المواد</th>
                <th className="px-4 py-3 text-center font-bold">الحالة</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-white/40">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Users className="mx-auto mb-3 h-10 w-10 text-white/15" />
                    <p className="text-white/50">
                      {filtersOn ? "لا نتائج تطابق البحث" : "لا طلبة مسجّلون بعد"}
                    </p>
                    {filtersOn && (
                      <button onClick={clearFilters} className="mt-3 text-xs text-sky-300 underline">
                        إزالة المرشِّحات
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((student, i) => {
                  const name = `${student.firstName} ${student.lastName}`;
                  const enrollments = student._count?.enrollments ?? 0;
                  const age = ageOf(student.birthDate);

                  return (
                    <motion.tr
                      key={student.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.015, 0.2) }}
                      className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
                    >
                      {/*
                        الاسم وحده هو ما يفتح التفصيل — لا الصفّ كلّه:
                        الصفّ يحمل أزرار تعديل وحذف، وجعلُه قابلاً للنقر
                        يجعل كلّ ضغطةٍ خاطئة تغادر الشاشة.
                      */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(PATHS.studentDetail(student.id))}
                          className="group flex items-center gap-3 text-start"
                        >
                          <Avatar src={student.avatar} name={name} gender={student.gender} size={38} />
                          <div className="min-w-0">
                            <div className="truncate font-bold transition group-hover:text-sky-300">
                              {name}
                            </div>
                            <div className="truncate text-[11px] text-white/40">
                              {age !== null ? `${age} سنة` : "—"}
                              {student.schoolName && ` · ${student.schoolName}`}
                            </div>
                          </div>
                        </button>
                      </td>

                      <td className="px-4 py-3 text-white/70">
                        {student.gender === "MALE" ? "ذكر" : "أنثى"}
                      </td>

                      <td className="px-4 py-3 text-white/70" dir="ltr">
                        {student.parentPhone}
                      </td>

                      <td className="px-4 py-3 text-white/50" dir="ltr">
                        {student.phone || "—"}
                      </td>

                      <td className="px-4 py-3 text-white/50" dir="ltr">
                        {fmtDate(student.registrationDate)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-xs">
                          <BookMarked className="h-3.5 w-3.5 text-white/40" />
                          {enrollments}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                          style={
                            student.isActive
                              ? { background: "rgba(134,239,172,0.14)", color: "#86efac" }
                              : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)" }
                          }
                        >
                          {student.isActive ? "نشط" : "معطّل"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {can("student.update") && (
                            <>
                              <IconButton
                                title="تعديل"
                                onClick={() => {
                                  setEditing(student);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </IconButton>

                              <IconButton
                                title={student.isActive ? "تعطيل" : "تفعيل"}
                                busy={rowBusy === student.id}
                                onClick={() => toggleActive(student)}
                              >
                                {student.isActive ? (
                                  <UserX className="h-4 w-4" />
                                ) : (
                                  <UserCheck className="h-4 w-4" />
                                )}
                              </IconButton>
                            </>
                          )}

                          {can("student.delete") && (
                            /*
                             * الحذف يُعطَّل مسبقاً حين يكون للطالب تسجيلات.
                             * الخادم يرفضه بـ409 على أي حال، لكن زرّاً يعمل
                             * ثم يفشل أسوأ من زرٍّ يقول سببه قبل الضغط.
                             */
                            <IconButton
                              title={
                                enrollments > 0
                                  ? `لا يمكن الحذف: للطالب ${enrollments} تسجيل — عطّله بدل ذلك`
                                  : "حذف"
                              }
                              disabled={enrollments > 0}
                              danger
                              onClick={() => setConfirming(student)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ================= الترقيم ================= */}
        {pagination && pagination.total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-white/50">
            <span>
              {pagination.total} طالب · صفحة {pagination.page} من {pagination.totalPages}
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 transition hover:bg-white/20 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 transition hover:bg-white/20 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =================
          النموذج — بلا AnimatePresence عمداً

          ‏`AnimatePresence` لا تُفكِّك طفلها في هذا الإعداد: جرّبتُها
          بمكوّنٍ مخصّص ثمّ بعنصر motion.div مباشر، وفي الحالتين بقيت
          اللوحة في الشجرة بعد إغلاقها — لا بعد الحفظ ولا بزرّ الإلغاء.
          والسبب الجذري لم يُحسم (نفس إصدار motion ونفس إعداد
          React Compiler يعملان في SKK).

          فالظهور متحرّك والاختفاء فوري. لوحةٌ لا تُغلق عيبٌ يوقف العمل،
          وحركةُ خروجٍ ناقصة عيبٌ تجميلي.
          ================= */}
      {/*
        التسجيل غير التعديل: الجديد يمرّ بخطوتين — المعلومات ثمّ الوثائق —
        لأنّ رفع الوثائق يحتاج معرّف الطالب فلا يُعرض قبل حفظه. والتعديل
        معلوماتٌ وحدها؛ وثائقُ القائم تُدار من «ملفات الطلبة».
      */}
      {formOpen && (
        editing ? (
          <StudentForm
            key={editing.id}
            student={editing}
            onClose={() => setFormOpen(false)}
            onSaved={() => {
              setFormOpen(false);
              fetchRows();
            }}
          />
        ) : (
          <StudentRegisterDialog
            onClose={() => {
              setFormOpen(false);
              /* الطالب حُفظ بعد الخطوة الأولى — فالقائمة تُنعش مهما أُغلقت النافذة */
              fetchRows();
            }}
          />
        )
      )}

      {/* ================= تأكيد الحذف =================
          بلا AnimatePresence للسبب نفسه المشروح أعلاه */}
      {confirming && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirming(null)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: MOTION.duration.fast, ease: MOTION.easing.enter }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-100 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0a0f1a] p-6"
            >
              <h3 className="mb-2 text-lg font-black">حذف الطالب</h3>
              <p className="mb-5 text-sm text-white/60">
                سيُحذف{" "}
                <span className="font-bold text-white">
                  {confirming.firstName} {confirming.lastName}
                </span>{" "}
                نهائياً. لا يمكن التراجع.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={confirmDelete}
                  disabled={rowBusy === confirming.id}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 font-bold transition hover:bg-rose-400 disabled:opacity-50"
                >
                  {rowBusy === confirming.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  حذف
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold transition hover:bg-white/20"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </>
        )}
    </div>
  );
}

// --------------------------------------------------
// عناصر مساعدة
// --------------------------------------------------

function IconButton({
  title,
  onClick,
  children,
  disabled,
  danger,
  busy,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      title={title}
      disabled={disabled || busy}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-lg transition ${
        danger ? "hover:bg-rose-500/20 hover:text-rose-300" : "hover:bg-white/15"
      } text-white/60 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

/**
 * قائمة منسدلة للفلاتر المرجعية.
 *
 * `select` أصلية لا قائمة مخصّصة: عناصرها قد تبلغ المئات (الأفواج)،
 * والقائمة الأصلية تدعم البحث بالكتابة والتمرير بلوحة المفاتيح مجاناً.
 */
function Dropdown({
  label,
  value,
  onChange,
  options,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  icon?: React.ReactNode;
}) {
  const chosen = !!value;

  return (
    <div
      className="flex items-center gap-2 rounded-xl border bg-black/30 px-3 py-1.5 transition"
      style={{
        borderColor: chosen ? `${ACCENT}55` : "rgba(255,255,255,0.1)",
      }}
    >
      <span style={{ color: chosen ? ACCENT : "rgba(255,255,255,0.35)" }}>
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent py-1 text-xs font-bold outline-none"
        style={{ color: chosen ? ACCENT : "rgba(255,255,255,0.6)" }}
      >
        <option value="" className="bg-[#0a0f1a] text-white">
          {label}: الكل
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-[#0a0f1a] text-white">
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
      {icon && <span className="ps-2 text-white/40">{icon}</span>}
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="rounded-lg px-3 py-1.5 text-xs font-bold transition"
          style={
            value === o.value
              ? { background: `${ACCENT}22`, color: ACCENT }
              : { color: "rgba(255,255,255,0.5)" }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
