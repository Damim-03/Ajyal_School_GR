import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Info,
  Loader2,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { FormDialog } from "../../components/shared/FormDialog";
import { useAcademicYears } from "../../core/api/reference.api";
import { useAuthStore } from "../../core/stores/auth.store";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { listStudents, type Student } from "../students/student.api";
import {
  fullName,
  listAssignments,
  listEnrollments,
  transferEnrollment,
  type Assignment,
  type Enrollment,
} from "./enrollments.api";

const ACCENT = "#c4b5fd";

/**
 * نقل الطالب من فوج إلى فوج.
 *
 * الشاشة تبدأ من **إسنادٍ قائم** لا من طالبٍ فارغ: النقل تصحيحُ وضعٍ
 * موجود، فالمدخل هو الصفّ الخطأ لا الطالب.
 *
 * والوجهات المعروضة مقصورةٌ على **نفس المادة**: النقل يغيّر الفوج أو
 * الأستاذ ويُبقي المادة. وتغييرُ المادة ليس نقلاً بل إلغاءٌ وإسنادٌ
 * جديد — والخادم يرفضه صراحةً.
 */
export default function TransferPage() {
  const exitTo = useScreenExit();
  const can = useAuthStore((s) => s.hasPermission);

  const yearsQuery = useAcademicYears();
  const years = yearsQuery.data ?? [];
  const [yearId, setYearId] = useState("");

  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(false);

  const [moving, setMoving] = useState<Enrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId((years.find((y) => y.isCurrent) ?? years[0]).id);
  }, [years, yearId]);

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      listStudents({ limit: 100, isActive: true, search: search || undefined })
        .then((res) => alive && setStudents(res.students))
        .catch(() => {});
    }, 250);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    if (!yearId) return;
    let alive = true;

    listAssignments(yearId)
      .then((rows) => alive && setAssignments(rows))
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [yearId]);

  const load = useCallback(async () => {
    if (!selected || !yearId) {
      setEnrollments([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await listEnrollments({
        studentId: selected.id,
        academicYearId: yearId,
        limit: 100,
      });

      /* النقل يخصّ النشط وحده — المعطَّل تاريخٌ لا وضعٌ يُصحَّح */
      setEnrollments(res.enrollments.filter((e) => e.isActive));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر جلب إسنادات الطالب");
    } finally {
      setLoading(false);
    }
  }, [selected, yearId]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 3200);
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="نقل بين الأفواج" subtitle="تصحيح فوج الطالب في مادة">
        <button
          onClick={() => exitTo(PATHS.enrollments)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-[1500px] p-6">
        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span className="whitespace-pre-line leading-relaxed">{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold text-white/45">
              السنة الدراسية
            </span>
            <select
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
              className={selectClass}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id} className="bg-[#0a0f1a]">
                  {y.name}
                </option>
              ))}
            </select>
          </label>

          <p className="mb-1 flex items-center gap-2 text-[11px] text-white/35">
            <Info className="h-3.5 w-3.5" />
            النقل يُبقي المادة ويغيّر الفوج أو الأستاذ — والقديم يُعطَّل بفواتيره
            وحضوره ولا يُمحى
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="border-b border-white/10 p-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث عن طالب…"
                  className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pe-4 ps-10 text-sm outline-none transition focus:border-white/30"
                />
              </div>
            </div>

            <div className="max-h-[62vh] overflow-y-auto">
              {students.map((student) => (
                <button
                  key={student.id}
                  onClick={() => {
                    setSelected(student);
                    setError(null);
                  }}
                  className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-2.5 text-start transition last:border-0"
                  style={
                    selected?.id === student.id
                      ? { background: `${ACCENT}1f` }
                      : undefined
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {fullName(student)}
                    </span>
                    <span className="block text-[11px] text-white/35" dir="ltr">
                      {student.parentPhone}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
            {!selected ? (
              <div className="grid place-items-center px-6 py-24 text-center">
                <ArrowRightLeft className="mb-3 h-11 w-11 text-white/15" />
                <p className="text-white/60">اختر طالباً</p>
                <p className="mt-1.5 max-w-md text-xs text-white/35">
                  تظهر مواده النشطة، ومن كلٍّ منها يمكن نقله إلى فوجٍ آخر يدرّس
                  المادة نفسها.
                </p>
              </div>
            ) : loading ? (
              <div className="grid place-items-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              </div>
            ) : enrollments.length === 0 ? (
              <div className="grid place-items-center px-6 py-20 text-center">
                <TriangleAlert className="mb-3 h-10 w-10 text-white/15" />
                <p className="text-white/60">لا إسنادات نشطة لهذا الطالب</p>
                <p className="mt-1.5 text-xs text-white/35">
                  أسنده أولاً من شاشة «إسناد طالب».
                </p>
              </div>
            ) : (
              <>
                <div className="border-b border-white/10 p-4">
                  <h2 className="text-lg font-black">{fullName(selected)}</h2>
                  <p className="text-xs text-white/40">
                    {enrollments.length} مادة نشطة — اختر المادة التي تريد نقله
                    فيها
                  </p>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-white/50">
                      <th className="px-4 py-3 text-start font-bold">المادة</th>
                      <th className="px-4 py-3 text-start font-bold">الأستاذ</th>
                      <th className="px-4 py-3 text-start font-bold">الفوج الحالي</th>
                      <th className="w-32 px-3 py-3" />
                    </tr>
                  </thead>

                  <tbody>
                    {enrollments.map((row) => {
                      /* وجهات النقل: نفس المادة، موضعٌ آخر */
                      const targets = assignments.filter(
                        (a) =>
                          a.subject.id === row.teachingAssignment.subject.id &&
                          a.id !== row.teachingAssignmentId,
                      );

                      return (
                        <tr
                          key={row.id}
                          className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
                        >
                          <td className="px-4 py-2.5 font-bold">
                            {row.teachingAssignment.subject.name}
                          </td>
                          <td className="px-4 py-2.5 text-white/70">
                            {fullName(row.teachingAssignment.teacher)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                              style={{ background: `${ACCENT}1f`, color: ACCENT }}
                            >
                              {row.teachingAssignment.studyGroup.level.name} ·{" "}
                              {row.teachingAssignment.studyGroup.name}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-end">
                            {can("enrollment.update") && (
                              <button
                                onClick={() => setMoving(row)}
                                disabled={targets.length === 0}
                                title={
                                  targets.length === 0
                                    ? "لا فوج آخر يدرّس هذه المادة"
                                    : "نقل"
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black text-[#160a2e] transition hover:brightness-110 disabled:opacity-30"
                                style={{ background: ACCENT }}
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                                انقل
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>

      {moving && (
        <TransferDialog
          row={moving}
          targets={assignments.filter(
            (a) =>
              a.subject.id === moving.teachingAssignment.subject.id &&
              a.id !== moving.teachingAssignmentId,
          )}
          onClose={() => setMoving(null)}
          onDone={async (message) => {
            setMoving(null);
            await load();
            flash(message);
          }}
        />
      )}

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-violet-400/30 bg-violet-500/15 px-5 py-2.5 text-sm font-bold text-violet-100 backdrop-blur"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}

// --------------------------------------------------

function TransferDialog({
  row,
  targets,
  onClose,
  onDone,
}: {
  row: Enrollment;
  targets: Assignment[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = useMemo(
    () => targets.find((t) => t.id === targetId) ?? null,
    [targets, targetId],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target || busy) return;

    setBusy(true);
    setError(null);

    try {
      const result = await transferEnrollment(row.id, target.id);

      onDone(
        `نُقل ${fullName(row.student)} في ${row.teachingAssignment.subject.name}: ` +
          `${result.from.studyGroup} ← ${target.studyGroup.name}` +
          (result.revived ? " (أُحيي إسنادٌ سابق)" : ""),
      );
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر النقل");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      icon={ArrowRightLeft}
      title="نقل بين الأفواج"
      subtitle={`${fullName(row.student)} — ${row.teachingAssignment.subject.name}`}
      tone={ACCENT}
      width="md"
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitDisabled={!target}
      submitLabel="انقل"
      submitIcon={<ArrowRightLeft className="h-4.5 w-4.5" />}
      error={error}
    >
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3.5">
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] text-white/40">من</p>
            <p className="truncate text-sm font-black">
              {row.teachingAssignment.studyGroup.name}
            </p>
            <p className="truncate text-[11px] text-white/40">
              {fullName(row.teachingAssignment.teacher)}
            </p>
          </div>

          <ArrowLeft className="h-5 w-5 shrink-0" style={{ color: ACCENT }} />

          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] text-white/40">إلى</p>
            <p className="truncate text-sm font-black" style={{ color: target ? ACCENT : undefined }}>
              {target ? target.studyGroup.name : "—"}
            </p>
            <p className="truncate text-[11px] text-white/40">
              {target ? fullName(target.teacher) : "اختر الوجهة"}
            </p>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-white/60">
            الفوج الجديد
          </span>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none"
          >
            <option value="" className="bg-[#0a0f1a]">— اختر —</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id} className="bg-[#0a0f1a]">
                {t.studyGroup.level.name} · {t.studyGroup.name} — {fullName(t.teacher)}
              </option>
            ))}
          </select>
        </label>

        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-white/35">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          الإسناد القديم يُعطَّل ولا يُحذف: فواتيره وحضورُه تبقى معلَّقةً به، فلا
          يضيع تاريخ الطالب في الفوج الذي غادره.
        </p>
    </FormDialog>
  );
}

const selectClass =
  "rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-bold outline-none transition focus:border-white/30";
