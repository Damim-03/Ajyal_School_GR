import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { FormDialog } from "../../components/shared/FormDialog";
import {
  createLessonSlot,
  fullName,
  useAcademicYears,
  useAssignments,
  useClassrooms,
  useLessonSlots,
  type Assignment,
  type LessonSlot,
  type Option,
} from "../../core/api/reference.api";
import { useAuthStore } from "../../core/stores/auth.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import {
  countLabel,
  createSchedule,
  deleteSchedule,
  durationLabel,
  listSchedules,
  slotDuration,
  subjectTone,
  DAYS,
  type DayOfWeek,
  type ScheduleRow,
} from "./schedules.api";
import { sizeSuggestion } from "./lesson-size";

const ACCENT = "#c7d2fe";

/** مجالٌ زمني — صفٌّ واحد في الشبكة، وتحته فتراتُ من يدرّس فيه */
interface TimeBand {
  key: string;
  startTime: string;
  endTime: string;
  /** فترات هذا المجال: فترةٌ لكل أستاذٍ يدرّس فيه، وربّما فترةٌ عامّة */
  slots: LessonSlot[];
}

/**
 * الجدول الأسبوعي.
 *
 * شبكةٌ لا قائمة: الجدول يُقرأ بالمسح — «ما الذي يقع الاثنينَ في الحصة
 * الثانية؟» — وقائمةُ صفوفٍ تُجيب عن هذا السؤال بالبحث لا بالنظر.
 * الأسطر أعمدةُ الأيام والصفوف مجالاتُ الوقت، وهو ترتيبُ الورقة التي
 * تُعلَّق على الحائط.
 *
 * والتوازي أصلٌ في مركز الدعم لا استثناء: تُدرَّس الإنجليزية من 08:00
 * إلى 10:00 وتُدرَّس الفيزياء في الوقت نفسه، كلٌّ عند أستاذها وفي قاعته.
 *
 * **والصفّ مجالٌ زمني لا فترة.** الفترة صارت مملوكةً لأستاذ في الخادم
 * (`LessonSlot.teacherId`) — وهو ما يجعل التوازي ممكناً — لكنّ عرضها
 * صفوفاً يمزّق الساعة الواحدة إلى ثلاثة أسطر متطابقة الأرقام، فتُقرأ
 * ثلاثَ ساعاتٍ وهي ساعة. فالفترات تُجمع بمجالها: 08:00–10:00 خانةٌ
 * واحدة يوم الجمعة تحمل الإنجليزية والفيزياء معاً، ومِلكيةُ الفترة
 * سباكةٌ تحتها لا يراها المستخدم — تُختار عند الإضافة، وتُنشأ إن لم
 * تكن.
 *
 * ولأنّ الخانة تجمع أساتذة، عاد اسمُ الأستاذ إليها: هو ما يفرّق بين
 * درسٍ ودرس في السطر نفسه.
 *
 * والتعارض ليس مسؤولية هذه الشاشة: الخادم يرفض ازدواج الأستاذ أو القاعة
 * أو الفوج في الوقت نفسه — ولو وقع في فترتين مختلفتين — ويشرح السبب،
 * والشاشة تعرض شرحه كما هو.
 */
export default function WeeklySchedulePage() {
  const exitTo = useScreenExit();
  const can = useAuthStore((s) => s.hasPermission);
  const queryClient = useQueryClient();

  const yearsQuery = useAcademicYears();
  const years = yearsQuery.data ?? [];

  const [yearId, setYearId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [classroomId, setClassroomId] = useState("");

  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ day: DayOfWeek; band: TimeBand } | null>(null);
  const [removing, setRemoving] = useState<ScheduleRow | null>(null);
  const [busy, setBusy] = useState(false);

  const slots = useLessonSlots(yearId || undefined);
  const assignments = useAssignments(yearId || undefined);
  const classrooms = useClassrooms();

  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId((years.find((y) => y.isCurrent) ?? years[0]).id);
  }, [years, yearId]);

  const teachers = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const a of assignments.data ?? []) {
      if (!seen.has(a.teacher.id)) seen.set(a.teacher.id, { id: a.teacher.id, name: fullName(a.teacher) });
    }
    return [...seen.values()];
  }, [assignments.data]);

  const groups = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const a of assignments.data ?? []) {
      if (!seen.has(a.studyGroup.id))
        seen.set(a.studyGroup.id, {
          id: a.studyGroup.id,
          name: `${a.studyGroup.level.name} — ${a.studyGroup.name}`,
        });
    }
    return [...seen.values()];
  }, [assignments.data]);

  const fetchRows = useCallback(async () => {
    if (!yearId) return;

    setLoading(true);
    setError(null);

    try {
      setRows(
        await listSchedules({
          academicYearId: yearId,
          ...(teacherId && { teacherId }),
          ...(groupId && { studyGroupId: groupId }),
          ...(classroomId && { classroomId }),
        }),
      );
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر جلب الجدول");
    } finally {
      setLoading(false);
    }
  }, [yearId, teacherId, groupId, classroomId]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  /**
   * خانة الشبكة: يوم × مجال زمني.
   *
   * كل ما يقع في هذا الوقت من هذا اليوم مهما كان صاحب فترته — فالخانة
   * تجمع ما تفرّقه الفترات.
   */
  const cellOf = (day: DayOfWeek, band: TimeBand) => {
    const ids = new Set(band.slots.map((s) => s.id));

    return rows
      .filter((r) => r.dayOfWeek === day && ids.has(r.lessonSlotId))
      .sort((a, b) =>
        fullName(a.teachingAssignment.teacher).localeCompare(
          fullName(b.teachingAssignment.teacher),
          "ar",
        ),
      );
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteSchedule(removing.id);
      setRemoving(null);
      await fetchRows();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر الحذف");
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  };

  /**
   * صفوف الشبكة — مجالات الوقت لا الفترات.
   *
   * الفترات المتطابقة وقتاً تُطوى في مجالٍ واحد: ثلاثةُ أساتذة يدرّسون
   * 08:00–10:00 صفٌّ واحد لا ثلاثة. وهو أيضاً ما يجعل الشبكة مستقرّةً
   * عند التصفية بأستاذ: الصفوف هي هي، وما يتغيّر محتوى الخانات.
   */
  const bands = useMemo(() => {
    const map = new Map<string, TimeBand>();

    for (const slot of slots.data ?? []) {
      const key = `${slot.startTime}-${slot.endTime}`;
      const band =
        map.get(key) ??
        { key, startTime: slot.startTime, endTime: slot.endTime, slots: [] };

      band.slots.push(slot);
      map.set(key, band);
    }

    return [...map.values()].sort(
      (a, b) =>
        a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime),
    );
  }, [slots.data]);

  const editable = can("schedule.create");

  /** المجال بوقته — عنوانُ نافذة الإضافة */
  const bandTime = (band: TimeBand) =>
    `${band.startTime} – ${band.endTime} (${slotDuration(band.startTime, band.endTime)})`;

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="الجدول الأسبوعي" subtitle="يوم · مجال زمني · قاعة">
        <button
          onClick={() => exitTo(PATHS.home)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-[1600px] p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
          className="mb-5 flex flex-wrap items-end gap-3"
        >
          <Field label="السنة الدراسية">
            <select value={yearId} onChange={(e) => setYearId(e.target.value)} className={selectClass}>
              {years.map((y) => (
                <option key={y.id} value={y.id} className="bg-[#0a0f1a]">
                  {y.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="الأستاذ">
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={selectClass}>
              <option value="" className="bg-[#0a0f1a]">كل الأساتذة</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#0a0f1a]">{t.name}</option>
              ))}
            </select>
          </Field>

          <Field label="الفوج">
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={selectClass}>
              <option value="" className="bg-[#0a0f1a]">كل الأفواج</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id} className="bg-[#0a0f1a]">{g.name}</option>
              ))}
            </select>
          </Field>

          <Field label="القاعة">
            <select value={classroomId} onChange={(e) => setClassroomId(e.target.value)} className={selectClass}>
              <option value="" className="bg-[#0a0f1a]">كل القاعات</option>
              {(classrooms.data ?? []).map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0a0f1a]">{c.name}</option>
              ))}
            </select>
          </Field>

          {loading && <Loader2 className="mb-2.5 h-4 w-4 animate-spin text-white/40" />}

          <span className="mb-2.5 ms-auto text-[11px] text-white/35">
            {countLabel(rows.length, {
              none: "لا حصص مبرمجة",
              one: "حصة مبرمجة واحدة",
              two: "حصتان مبرمجتان",
              few: "حصص مبرمجة",
              many: "حصة مبرمجة",
            })}
            {" · "}
            {countLabel(bands.length, {
              none: "لا مجالات زمنية",
              one: "مجال زمني واحد",
              two: "مجالان زمنيان",
              few: "مجالات زمنية",
              many: "مجالاً زمنياً",
            })}
          </span>
        </motion.div>

        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        )}

        {bands.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
            <Clock className="mb-3 h-11 w-11 text-white/15" />
            <p className="text-white/60">لا حصص توقيت في هذه السنة الدراسية.</p>
            <p className="mt-1.5 max-w-md text-xs text-white/35">
              الشبكة صفوفُها مجالاتُ الوقت — اضبط أوّلها من البنية الدراسية،
              وهي تخصّ هذه السنة وحدها. وما بعدها يُضاف من الشبكة نفسها:
              أساتذةٌ كثيرون في المجال الواحد بلا تعارض.
            </p>
            <button
              onClick={() => exitTo(PATHS.academicSlots)}
              className="mt-5 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-[#0e0a2e] transition hover:brightness-110"
              style={{ background: ACCENT }}
            >
              <Settings2 className="h-4 w-4" />
              إعداد حصص التوقيت
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="overflow-x-auto">
              <table
                className="w-full border-separate text-sm"
                style={{ borderSpacing: 0, minWidth: 1000 }}
              >
                {/*
                  الأيام في الأعلى، والتوقيت عمودٌ **آخِر**.

                  وكونُه آخِراً في الترتيب هو ما يضعه على اليسار: الجدول
                  عربيٌّ يبدأ من اليمين، فأوّلُ عمودٍ يقع يميناً وآخرُه
                  يساراً. ولذلك يُثبَّت بـ inset-inline-end لا -start —
                  المنطقية لا الفيزيائية، فلو عُرِّب اللاحقُ إلى لغةٍ من
                  اليسار انتقل العمود معها بلا تعديل.
                */}
                <thead>
                  <tr className="bg-[#0b1120] text-xs text-white/55">
                    {DAYS.map((d) => (
                      <th
                        key={d.key}
                        className="border-b border-e border-white/10 px-2 py-3 text-center font-bold"
                      >
                        {d.label}
                      </th>
                    ))}
                    <th
                      className="sticky z-20 border-b border-white/10 bg-[#0b1120] px-3 py-3 text-center font-bold"
                      style={{ insetInlineEnd: 0, width: 140, minWidth: 140 }}
                    >
                      التوقيت
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {bands.map((band) => (
                    <tr key={band.key}>
                      {DAYS.map((d) => {
                        const items = cellOf(d.key, band);

                        return (
                          <td
                            key={d.key}
                            className="border-b border-e border-white/5 p-1.5 align-top"
                            style={{ minWidth: 150 }}
                          >
                            <div className="space-y-1.5">
                              {items.map((item) => {
                                const tone = subjectTone(item.teachingAssignment.subject.name);

                                return (
                                  <div
                                    key={item.id}
                                    className="group relative rounded-lg border px-2 py-1.5"
                                    style={{
                                      borderColor: `${tone}44`,
                                      background: `${tone}14`,
                                    }}
                                  >
                                    <div className="text-[12px] font-black" style={{ color: tone }}>
                                      {item.teachingAssignment.subject.name}
                                    </div>

                                    {/* الخانة تجمع أساتذة — فالاسم هو ما يفرّق بين درسٍ ودرس */}
                                    <div className="mt-0.5 truncate text-[11px] text-white/60">
                                      {fullName(item.teachingAssignment.teacher)}
                                    </div>

                                    <div className="truncate text-[11px] text-white/40">
                                      {item.teachingAssignment.studyGroup.level.name} —{" "}
                                      {item.teachingAssignment.studyGroup.name}
                                      {item.classroom && ` · ${item.classroom.name}`}
                                    </div>

                                    {can("schedule.delete") && (
                                      <button
                                        onClick={() => setRemoving(item)}
                                        title="حذف من الجدول"
                                        className="absolute end-1 top-1 hidden h-6 w-6 place-items-center rounded-md text-white/50 transition hover:bg-rose-500/25 hover:text-rose-300 group-hover:grid"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}

                              {editable && (
                                <button
                                  onClick={() => setAdding({ day: d.key, band })}
                                  className="grid h-8 w-full place-items-center rounded-lg border border-dashed border-white/10 text-white/25 transition hover:border-white/30 hover:text-white/60"
                                  title={`إضافة في ${d.label}`}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/*
                        التوقيت آخِراً — فيستقرّ على يسار الجدول ويثبت عند
                        التمرير. والوقت وحده بلا اسم الحصة ولا اسم أستاذ:
                        الاسم يقول «حصة فيزياء - علي حبيب» بينما الخانة
                        نفسها تحمل مادةً أخرى لأستاذٍ آخر، والصفُّ صار
                        مجالاً يشترك فيه الجميع فلا صاحبَ له.
                      */}
                      <td
                        className="sticky z-10 border-b border-white/10 bg-[#070b14] px-3 py-2 text-center align-middle"
                        style={{ insetInlineEnd: 0 }}
                      >
                        <div className="font-black tabular-nums" dir="ltr">
                          {band.startTime}
                        </div>
                        <div className="my-0.5 text-[10px] text-white/25">إلى</div>
                        <div className="font-black tabular-nums" dir="ltr">
                          {band.endTime}
                        </div>

                        {/* الحجم الساعي — يُحسب فلا يطرحه القارئ في رأسه */}
                        <div className="mt-1.5 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-white/45">
                          {slotDuration(band.startTime, band.endTime)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-white/30">
          <CalendarDays className="h-3.5 w-3.5" />
          هذا الجدول قاعدةٌ متكرّرة — والحصة الفعلية بتاريخها تُنشأ في كشف الحضور حين يُكتب تاريخ العمود
        </p>
      </div>

      {adding && (
        <AddDialog
          day={adding.day}
          band={adding.band}
          bands={bands}
          bandTime={bandTime(adding.band)}
          rows={rows}
          academicYearId={yearId}
          canCreateSlot={can("lesson-slot.create")}
          assignments={assignments.data ?? []}
          classrooms={classrooms.data ?? []}
          onClose={() => setAdding(null)}
          onDone={async (createdSlot) => {
            setAdding(null);
            /* فترةٌ جديدة تعني مجالاً قد تغيّر — تُجدَّد القائمة قبل الرسم */
            if (createdSlot) {
              await queryClient.invalidateQueries({
                queryKey: ["ref", "lesson-slots", yearId],
              });
            }
            fetchRows();
          }}
        />
      )}

      {removing && (
        <>
          <div onClick={() => setRemoving(null)} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-105 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0a0f1a] p-6">
            <h3 className="mb-2 text-lg font-black">حذف من الجدول</h3>
            <p className="mb-5 text-sm leading-relaxed text-white/60">
              ستُحذف{" "}
              <span className="font-bold text-white">
                {removing.teachingAssignment.subject.name}
              </span>{" "}
              — {DAYS.find((d) => d.key === removing.dayOfWeek)?.label} ·{" "}
              <span dir="ltr">
                {removing.lessonSlot.startTime} – {removing.lessonSlot.endTime}
              </span>
              .
              <br />
              الحصص الفعلية المولَّدة منها سابقاً لا تُحذف.
            </p>
            <div className="flex gap-3">
              <button
                onClick={remove}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 font-bold transition hover:bg-rose-400 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
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

// --------------------------------------------------
// إضافة إلى الخانة
// --------------------------------------------------

function AddDialog({
  day,
  band,
  bands,
  bandTime,
  rows,
  academicYearId,
  canCreateSlot,
  assignments,
  classrooms,
  onClose,
  onDone,
}: {
  day: DayOfWeek;
  band: TimeBand;
  /** كل المجالات — يُقترح منها البديل حين لا يطابق الحجم */
  bands: TimeBand[];
  bandTime: string;
  /** الجدول القائم — منه يُعرف حجمُ هذا الدرس حيث بُرمج سابقاً */
  rows: ScheduleRow[];
  academicYearId: string;
  /** بلا صلاحية إنشاء الفترات لا يظهر إلّا من له فترةٌ في المجال */
  canCreateSlot: boolean;
  assignments: Assignment[];
  classrooms: Option[];
  onClose: () => void;
  onDone: (createdSlot: boolean) => void;
}) {
  const [assignmentId, setAssignmentId] = useState("");
  const [classroom, setClassroom] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** المجال الذي سيُضاف إليه فعلاً — يتغيّر إن قَبِل المستخدم الاقتراح */
  const [targetKey, setTargetKey] = useState<string | null>(null);

  const target = bands.find((b) => b.key === targetKey) ?? band;

  const generalSlot = useMemo(
    () => target.slots.find((s) => !s.teacherId),
    [target],
  );

  /** فترةُ هذا الأستاذ في المجال الهدف — إن كانت */
  const slotOf = (teacherId: string) =>
    target.slots.find((s) => s.teacherId === teacherId);

  /*
    من يُعرض؟ الجميع — ما دامت الفترة تُصنع عند الحاجة.

    كان يُعرض صاحبُ الفترة وحده، فكان المجال الواحد يُغلق دون بقيّة
    الأساتذة لأنّ لهم فتراتٍ لم تُنشأ بعد — وهو تفصيلٌ داخليّ لا يعني
    المستخدم. أمّا بلا صلاحية إنشاء الفترات فيبقى العرض على من له فترةٌ
    قائمة أو على الجميع إن كان في المجال فترةٌ عامّة، حتى لا يُختار ما
    لا يمكن حفظه.
  */
  const scoped = useMemo(
    () =>
      canCreateSlot || generalSlot
        ? assignments
        : assignments.filter((a) => slotOf(a.teacher.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignments, canCreateSlot, generalSlot, band],
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return scoped;

    return scoped.filter((a) =>
      `${a.subject.name} ${fullName(a.teacher)} ${a.studyGroup.level.name} ${a.studyGroup.name}`.includes(q),
    );
  }, [scoped, search]);

  const chosen = assignments.find((a) => a.id === assignmentId);

  /* اختيارُ درسٍ آخر يُلغي اقتراحاً قُبِل لسابقه */
  useEffect(() => setTargetKey(null), [assignmentId]);

  /**
   * الخانة لا تناسب حجم الدرس؟
   *
   * القاعدة نفسُها في `lesson-size` — وحدةٌ نقيّة تُختبر وحدها. وهنا
   * تُترجَم بيانات الشاشة إلى ما تفهمه: مواضعُ الدروس بأوقاتها.
   */
  const suggestion = useMemo(() => {
    if (!chosen) return null;

    return sizeSuggestion(
      { assignmentId: chosen.id, teacherId: chosen.teacher.id },
      band,
      bands,
      rows.map((row) => ({
        assignmentId: row.teachingAssignment.id,
        startTime: row.lessonSlot.startTime,
        endTime: row.lessonSlot.endTime,
      })),
    );
  }, [chosen, band, bands, rows]);

  /**
   * الفترة التي ستستقبل الدرس — تُختار أو تُنشأ.
   *
   * ترتيب التفضيل مقصود: فترةُ الأستاذ نفسِه أوّلاً لأنّها ملكه، ثمّ
   * الفترة العامّة إن كانت (فلا تُنشأ فترةٌ لا حاجة إليها)، وإلّا
   * تُنشأ له فترةٌ بالمجال نفسه. واسمُها من أخواتها في المجال حتى
   * تبقى تسميةُ المؤسسة واحدة.
   */
  const resolveSlot = async (teacherId: string) => {
    const owned = slotOf(teacherId);
    if (owned) return { id: owned.id, created: false };

    if (generalSlot) return { id: generalSlot.id, created: false };

    const slot = await createLessonSlot({
      academicYearId,
      teacherId,
      name: target.slots[0]?.name ?? `${target.startTime} – ${target.endTime}`,
      startTime: target.startTime,
      endTime: target.endTime,
    });

    return { id: slot.id, created: true };
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chosen || busy) return;

    setBusy(true);
    setError(null);
    try {
      const slot = await resolveSlot(chosen.teacher.id);

      await createSchedule({
        teachingAssignmentId: assignmentId,
        lessonSlotId: slot.id,
        dayOfWeek: day,
        ...(classroom && { classroomId: classroom }),
      });
      onDone(slot.created);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّرت الإضافة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      icon={Plus}
      title={`إضافة إلى ${DAYS.find((d) => d.key === day)?.label} · ${bandTime}`}
      subtitle="أساتذةٌ كثيرون في هذا المجال ولا تعارض بينهم — وإنّما يُرفض الإسناد إن كان الأستاذ نفسُه أو الفوج أو القاعة مشغولاً في هذا الوقت."
      tone={ACCENT}
      width="md"
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitDisabled={!assignmentId}
      submitLabel={
        targetKey ? `إضافة في ${target.startTime} – ${target.endTime}` : "إضافة"
      }
      submitIcon={<Plus className="h-4.5 w-4.5" />}
      error={error}
    >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">
              الإسناد التدريسي
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالمادة أو الأستاذ أو الفوج…"
              className="mb-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none transition focus:border-white/30"
            />
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-1.5">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs leading-relaxed text-white/35">
                  {scoped.length === 0 && assignments.length > 0
                    ? "لا يظهر إلّا أساتذةُ هذا المجال — وإنشاء فترةٍ جديدة يحتاج صلاحية «حصص التوقيت»"
                    : "لا إسناد يطابق البحث"}
                </p>
              ) : (
                filtered.map((a) => {
                  const tone = subjectTone(a.subject.name);
                  const active = assignmentId === a.id;

                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAssignmentId(a.id)}
                      className="w-full rounded-lg border px-3 py-2 text-right transition"
                      style={
                        active
                          ? { borderColor: `${tone}88`, background: `${tone}18` }
                          : { borderColor: "transparent" }
                      }
                    >
                      <span className="block text-sm font-bold" style={{ color: tone }}>
                        {a.subject.name}
                      </span>
                      <span className="block text-[11px] text-white/50">
                        {fullName(a.teacher)} · {a.studyGroup.level.name} —{" "}
                        {a.studyGroup.name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">
              القاعة <span className="font-normal text-white/35">(اختيارية)</span>
            </span>
            <select
              value={classroom}
              onChange={(e) => setClassroom(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none"
            >
              <option value="" className="bg-[#0a0f1a]">بلا قاعة محدَّدة</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0a0f1a]">{c.name}</option>
              ))}
            </select>
          </label>

          {/*
            الحجم لا يطابق الخانة.

            يُعرض ولا يُفرض: قد يكون للاستثناء وجهٌ صحيح — حصةٌ تعويضية
            أقصر، أو تقسيمُ ساعتين على يومين. فالزرّ يقترح والقرار قرار
            المستخدم، ويبقى «إضافة» ماضياً حيث ضغط.
          */}
          {suggestion && !targetKey && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
              <p>
                حجم هذا الدرس{" "}
                <span className="font-black">{durationLabel(suggestion.expected)}</span>{" "}
                وهذه الخانة{" "}
                <span className="font-black">{durationLabel(suggestion.current)}</span>.
              </p>
              <button
                type="button"
                onClick={() => setTargetKey(suggestion.to.key)}
                className="mt-2 flex items-center gap-2 rounded-lg bg-amber-400/20 px-3 py-1.5 text-xs font-black text-amber-100 transition hover:bg-amber-400/30"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                أضِفه في{" "}
                <span dir="ltr">
                  {suggestion.to.startTime} – {suggestion.to.endTime}
                </span>{" "}
                بدلاً منها
              </button>
            </div>
          )}

          {targetKey && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
              <span>
                سيُضاف في{" "}
                <span className="font-black" style={{ color: ACCENT }} dir="ltr">
                  {target.startTime} – {target.endTime}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setTargetKey(null)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold transition hover:bg-white/20"
              >
                تراجع
              </button>
            </div>
          )}
        </div>
    </FormDialog>
  );
}
