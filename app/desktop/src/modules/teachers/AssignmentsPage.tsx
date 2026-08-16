import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  Loader2,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import {
  activeOnly,
  findActiveFee,
  fullName,
  groupLabel,
  useAcademicYears,
  useStudyGroups,
  useSubjects,
  type GroupOption,
  type Option,
} from "../../core/api/reference.api";
import { useAuthStore } from "../../core/stores/auth.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { subjectTone } from "../schedules/schedules.api";
import {
  createAssignment,
  deleteAssignment,
  listAllTeachers,
  listAssignmentsPage,
  updateAssignment,
  type AssignmentRow,
  type Pagination,
  type TeacherRow,
} from "./teachers.api";

const ACCENT = "#a5f3fc";
const PAGE_SIZE = 20;

/**
 * الإسناد التدريسي.
 *
 * علاقةٌ لا كيان: أستاذ + مادة + فوج + سنة. وهي حجر الأساس لما بعدها —
 * الجدول الأسبوعي يُبنى عليها، والتسجيل يشير إليها، وكشف الحضور يقوم
 * عليها. لذلك شاشةٌ مستقلّة تُقرأ أفقياً: «من يدرّس هذه المادة لهذا
 * الفوج؟» — سؤالٌ لا يُجاب من داخل ملف أستاذٍ بعينه.
 */
export default function AssignmentsPage() {
  const exitTo = useScreenExit();
  const can = useAuthStore((s) => s.hasPermission);

  const yearsQuery = useAcademicYears();
  const years = yearsQuery.data ?? [];
  const subjects = useSubjects();
  const groups = useStudyGroups();

  const [yearId, setYearId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [page, setPage] = useState(1);

  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<AssignmentRow | null>(null);

  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId((years.find((y) => y.isCurrent) ?? years[0]).id);
  }, [years, yearId]);

  useEffect(() => setPage(1), [yearId, teacherId, subjectId, groupId]);

  /* الأساتذة النشطون — لا يُسند إلى معطَّل، والخادم يرفضه أيضاً */
  useEffect(() => {
    let alive = true;
    listAllTeachers({ isActive: true })
      .then((rows) => alive && setTeachers(rows))
      .catch(() => {
        /* القائمة تبقى فارغة فيمتنع الإنشاء */
      });
    return () => {
      alive = false;
    };
  }, []);

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(yearId && { academicYearId: yearId }),
      ...(teacherId && { teacherId }),
      ...(subjectId && { subjectId }),
      ...(groupId && { studyGroupId: groupId }),
    }),
    [page, yearId, teacherId, subjectId, groupId],
  );

  const fetchRows = useCallback(async () => {
    if (!yearId) return;

    setLoading(true);
    setError(null);
    try {
      const r = await listAssignmentsPage(query);
      setRows(r.assignments);
      setPagination(r.pagination);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر جلب الإسنادات");
    } finally {
      setLoading(false);
    }
  }, [query, yearId]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 2400);
  };

  const toggleActive = async (row: AssignmentRow) => {
    setBusyId(row.id);
    const before = rows;

    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)),
    );

    try {
      await updateAssignment(row.id, { isActive: !row.isActive });
      flash(row.isActive ? "عُطِّل الإسناد" : "فُعِّل الإسناد");
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
      await deleteAssignment(removing.id);
      setRemoving(null);
      await fetchRows();
      flash("حُذف الإسناد");
    } catch (err: any) {
      setError(
        err?.response?.status === 409
          ? "لا يُحذف إسنادٌ بُني عليه جدولٌ أو تسجيلٌ أو حضور — عطّله بدل حذفه."
          : (err?.response?.data?.message ?? "تعذّر الحذف"),
      );
      setRemoving(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="الإسناد التدريسي" subtitle="أستاذ · مادة · فوج · سنة">
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
          className="mb-5 flex flex-wrap items-end gap-3"
        >
          <Field label="السنة الدراسية">
            <select value={yearId} onChange={(e) => setYearId(e.target.value)} className={selectClass}>
              {years.map((y) => (
                <option key={y.id} value={y.id} className="bg-[#0a0f1a]">{y.name}</option>
              ))}
            </select>
          </Field>

          <Field label="الأستاذ">
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={selectClass}>
              <option value="" className="bg-[#0a0f1a]">الكل</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#0a0f1a]">{fullName(t)}</option>
              ))}
            </select>
          </Field>

          {/*
            التصفية تعرض المعطَّل موسوماً — لأنّ إسنادات السنوات الماضية
            تشير إليه، وإخفاؤه من هنا يجعلها غير قابلة للتصفية إطلاقاً.
            أمّا نافذة الإنشاء فتُخفيه: يُصفَّى به القديم ولا يُبنى عليه جديد.
          */}
          <Field label="المادة">
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={selectClass}>
              <option value="" className="bg-[#0a0f1a]">الكل</option>
              {(subjects.data ?? []).map((s) => (
                <option key={s.id} value={s.id} className="bg-[#0a0f1a]">
                  {s.name}
                  {s.isActive === false ? " (معطَّلة)" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="الفوج">
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={selectClass}>
              <option value="" className="bg-[#0a0f1a]">الكل</option>
              {(groups.data ?? []).map((g) => (
                <option key={g.id} value={g.id} className="bg-[#0a0f1a]">
                  {groupLabel(g)}
                  {g.isActive === false ? " (معطَّل)" : ""}
                </option>
              ))}
            </select>
          </Field>

          {loading && <Loader2 className="mb-2.5 h-4 w-4 animate-spin text-white/40" />}

          {can("teaching-assignment.create") && (
            <button
              onClick={() => setAdding(true)}
              className="mb-0.5 ms-auto flex items-center gap-2 rounded-xl px-4 py-2.5 font-black text-[#04252b] transition hover:brightness-110"
              style={{ background: ACCENT }}
            >
              <Plus className="h-4.5 w-4.5" />
              إسناد جديد
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
                <th className="px-4 py-3 text-start font-bold">المادة</th>
                <th className="px-4 py-3 text-start font-bold">الأستاذ</th>
                <th className="px-4 py-3 text-start font-bold">الطور</th>
                <th className="px-4 py-3 text-start font-bold">المستوى</th>
                <th className="px-4 py-3 text-start font-bold">الفوج</th>
                <th className="px-3 py-3 text-center font-bold">الحالة</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-white/30" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <BookMarked className="mx-auto mb-3 h-10 w-10 text-white/15" />
                    <p className="text-white/55">
                      {teacherId || subjectId || groupId
                        ? "لا إسناد يطابق هذه التصفية"
                        : "لا إسنادات في هذه السنة — ابدأ بإسناد مادة إلى أستاذ"}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const tone = subjectTone(row.subject.name);

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-2.5 font-bold" style={{ color: tone }}>
                        {row.subject.name}
                      </td>
                      <td className="px-4 py-2.5 font-bold">{fullName(row.teacher)}</td>
                      <td className="px-4 py-2.5 text-white/60">
                        {row.studyGroup.level.educationStage.name}
                      </td>
                      <td className="px-4 py-2.5 text-white/60">{row.studyGroup.level.name}</td>
                      <td className="px-4 py-2.5 text-white/70">{row.studyGroup.name}</td>
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
                          {can("teaching-assignment.update") && (
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
                          )}
                          {can("teaching-assignment.delete") && (
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-white/50">
            <span>
              {pagination.total} إسناداً · صفحة {pagination.page} من {pagination.totalPages}
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

      {adding && (
        <AddDialog
          yearId={yearId}
          yearName={years.find((y) => y.id === yearId)?.name ?? ""}
          teachers={teachers}
          subjects={activeOnly(subjects.data)}
          groups={activeOnly(groups.data)}
          onClose={() => setAdding(false)}
          onDone={async () => {
            setAdding(false);
            await fetchRows();
            flash("أُضيف الإسناد");
          }}
        />
      )}

      {removing && (
        <>
          <div onClick={() => setRemoving(null)} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-105 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0a0f1a] p-6">
            <h3 className="mb-2 text-lg font-black">حذف الإسناد</h3>
            <p className="mb-5 text-sm leading-relaxed text-white/60">
              <span className="font-bold text-white">{removing.subject.name}</span> —{" "}
              {fullName(removing.teacher)} ·{" "}
              {removing.studyGroup.level.educationStage.name} ·{" "}
              {removing.studyGroup.level.name} · {removing.studyGroup.name}.
              <br />
              إن بُني عليه جدولٌ أو تسجيلٌ أو حضور فسيمنع الخادمُ الحذف.
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

const selectClass =
  "rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-bold outline-none transition focus:border-white/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold text-white/45">{label}</span>
      {children}
    </label>
  );
}

function AddDialog({
  yearId,
  yearName,
  teachers,
  subjects,
  groups,
  onClose,
  onDone,
}: {
  yearId: string;
  yearName: string;
  teachers: TeacherRow[];
  subjects: Option[];
  groups: GroupOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * ما يُفحص بعد اكتمال (مادة + فوج) — قبل الحفظ لا بعده:
   *   • حقّ الاشتراك الساري: غيابه يوقف الفوترة لاحقاً.
   *   • أستاذٌ آخر يدرّس المادة نفسها لهذا الفوج: مسموح لكنّه يُعرَض،
   *     لأنّ الطالب لا يُسجَّل إلا عند واحدٍ منهما.
   */
  const [fee, setFee] = useState<number | null | "loading">(null);
  const [peers, setPeers] = useState<AssignmentRow[]>([]);

  useEffect(() => {
    if (!subjectId || !groupId) {
      setFee(null);
      setPeers([]);
      return;
    }

    let alive = true;
    setFee("loading");

    findActiveFee(subjectId, groupId)
      .then((amount) => alive && setFee(amount))
      .catch(() => alive && setFee(null));

    listAssignmentsPage({
      subjectId,
      studyGroupId: groupId,
      academicYearId: yearId,
      isActive: true,
      limit: 100,
    })
      .then((r) => alive && setPeers(r.assignments))
      .catch(() => alive && setPeers([]));

    return () => {
      alive = false;
    };
  }, [subjectId, groupId, yearId]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await createAssignment({
        teacherId,
        subjectId,
        studyGroupId: groupId,
        academicYearId: yearId,
      });
      onDone();
    } catch (err: any) {
      setError(
        err?.response?.status === 409
          ? "هذا الإسناد موجود سلفاً — الأستاذ نفسه يدرّس هذه المادة لهذا الفوج في هذه السنة."
          : (err?.response?.data?.message ?? "تعذّرت الإضافة"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: MOTION.duration.fast }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-115 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0a0f1a] p-6"
      >
        <h3 className="mb-1 text-lg font-black">إسناد جديد</h3>
        <p className="mb-5 text-xs leading-relaxed text-white/45">
          في سنة <span className="font-bold text-white/70">{yearName}</span>. لا يتكرّر
          الإسناد نفسه، ولا يُسند إلى أستاذٍ معطَّل.
        </p>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">الأستاذ</span>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none"
            >
              <option value="" className="bg-[#0a0f1a]">— اختر —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#0a0f1a]">{fullName(t)}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">المادة</span>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none"
            >
              <option value="" className="bg-[#0a0f1a]">— اختر —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#0a0f1a]">{s.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">الفوج</span>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none"
            >
              <option value="" className="bg-[#0a0f1a]">— اختر —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id} className="bg-[#0a0f1a]">{groupLabel(g)}</option>
              ))}
            </select>
          </label>

          {subjectId && groupId && fee !== "loading" && (
            <>
              {fee === null ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    لا حقّ اشتراك ساري لهذه المادة مع هذا الفوج. الإسناد يمرّ،
                    لكن فاتورة الطالب لن تُولَّد حتى يُضبط السعر في
                    <span className="font-bold"> الإعدادات ← حقوق الاشتراك</span>.
                  </span>
                </div>
              ) : (
                <p className="text-xs text-white/45">
                  حقّ الاشتراك الساري:{" "}
                  <span className="font-bold text-emerald-300">{fee.toLocaleString("en")} دج</span>{" "}
                  شهرياً.
                </p>
              )}

              {peers.length > 0 && (
                <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-white/55">
                  يدرّس هذه المادة لهذا الفوج حالياً:{" "}
                  <span className="font-bold text-white/80">
                    {peers.map((p) => fullName(p.teacher)).join("، ")}
                  </span>
                  . التعدّد مسموح، والطالب يُسجَّل عند أستاذٍ واحد منهم لا عند اثنين.
                </p>
              )}
            </>
          )}

          {error && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm leading-relaxed text-rose-200">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={submit}
              disabled={busy || !teacherId || !subjectId || !groupId}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 font-black text-[#04252b] transition hover:brightness-110 disabled:opacity-40"
              style={{ background: ACCENT }}
            >
              {busy ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Plus className="h-4.5 w-4.5" />}
              إضافة
            </button>
            <button
              onClick={onClose}
              className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
            >
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
