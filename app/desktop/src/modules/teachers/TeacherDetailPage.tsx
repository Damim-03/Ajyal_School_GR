import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BookMarked,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ScrollText,
  Users,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { Avatar } from "../../components/shared/Avatar";
import { useAcademicYears } from "../../core/api/reference.api";
import { useAuthStore } from "../../core/stores/auth.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";
import { DAYS, subjectTone, SESSION_TONE } from "../schedules/schedules.api";
import { EmploymentCertificatePreview } from "./EmploymentCertificate";
import { TeacherDocumentsPanel } from "./TeacherDocuments";
import {
  countTeacherStudents,
  dmy,
  getTeacher,
  listTeacherSchedules,
  listTeacherSessions,
  yearsOfService,
  GENDER_LABEL,
  type TeacherDetail,
  type TeacherScheduleRow,
  type TeacherSessionRow,
} from "./teachers.api";

const ACCENT = "#5eead4";

/**
 * ملف الأستاذ.
 *
 * أربعُ نوافذ على شيءٍ واحد: هويّتُه، وما أُسند إليه، ومتى يدرّسه في
 * الأسبوع، وماذا وقع منه فعلاً. وجمعُها في صفحة يُغني الإدارة عن
 * التنقّل بين أربع شاشات لتجيب عن سؤالٍ واحد: «ماذا يفعل هذا الأستاذ؟»
 *
 * ولا مالَ هنا: تخليصُ الأستاذ وحدةٌ مستقلّة لم تُبنَ بعد.
 */
export default function TeacherDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const exitTo = useScreenExit();
  const can = useAuthStore((s) => s.hasPermission);

  const yearsQuery = useAcademicYears();
  const years = yearsQuery.data ?? [];
  const [yearId, setYearId] = useState("");

  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [schedules, setSchedules] = useState<TeacherScheduleRow[]>([]);
  const [sessions, setSessions] = useState<TeacherSessionRow[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [students, setStudents] = useState<{
    byAssignment: Map<string, number>;
    distinctStudents: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /*
   * الشهادةُ تتبع السنةَ المعروضة ولا تتجمّد على ما فُتحت عليه.
   *
   * اسمُ السنة يُقرأ عند الرسم لا عند الفتح: من بدّل السنةَ والمعاينةُ
   * مفتوحة كانت إسناداتُها تتبدّل والعنوانُ يبقى — فتخرج ورقةٌ تقول
   * سنةً وتعدّد موادَّ سنةٍ أخرى.
   */
  const [certificate, setCertificate] = useState(false);
  const [documentCount, setDocumentCount] = useState<number | null>(null);

  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId((years.find((y) => y.isCurrent) ?? years[0]).id);
  }, [years, yearId]);

  const load = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const detail = await getTeacher(id);
      setTeacher(detail);

      if (yearId) {
        const [scheduleRows, sessionResult, studentResult] = await Promise.all([
          listTeacherSchedules(id, yearId),
          listTeacherSessions({ teacherId: id, academicYearId: yearId, limit: 30 }),
          countTeacherStudents(id, yearId),
        ]);

        setSchedules(scheduleRows);
        setSessions(sessionResult.sessions);
        setSessionTotal(sessionResult.pagination.total);
        setStudents(studentResult);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر جلب ملف الأستاذ");
    } finally {
      setLoading(false);
    }
  }, [id, yearId]);

  useEffect(() => {
    load();
  }, [load]);

  const yearAssignments = (teacher?.teachingAssignments ?? []).filter(
    (a) => !yearId || a.academicYear.id === yearId,
  );

  if (loading && !teacher) {
    return (
      <div className="min-h-screen bg-[#05070d] text-white">
        <AppHeader title="ملف الأستاذ" />
        <div className="grid place-items-center py-32">
          <Loader2 className="h-7 w-7 animate-spin text-white/30" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader
        title={teacher ? `${teacher.lastName} ${teacher.firstName}` : "ملف الأستاذ"}
        subtitle={teacher?.specialization ?? "الملف الإداري"}
      >
        <select
          value={yearId}
          onChange={(e) => setYearId(e.target.value)}
          className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs font-bold text-white outline-none"
        >
          {years.map((y) => (
            <option key={y.id} value={y.id} className="bg-[#0a0f1a]">
              {y.name}
            </option>
          ))}
        </select>

        {teacher && (
          <button
            onClick={() => setCertificate(true)}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-[#041f1c] transition hover:brightness-110"
            style={{ background: ACCENT }}
          >
            <ScrollText className="h-4 w-4" />
            شهادة عمل
          </button>
        )}

        <button
          onClick={() => exitTo(PATHS.teachersList)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      {certificate && teacher && (
        <EmploymentCertificatePreview
          teacher={teacher}
          assignments={yearAssignments}
          academicYear={years.find((y) => y.id === yearId)?.name ?? "—"}
          /* صورةٌ تُضاف من المعاينة تظهر في الملفّ خلفها بلا إعادة جلب */
          onTeacherChange={setTeacher}
          onClose={() => setCertificate(false)}
        />
      )}

      <div className="mx-auto max-w-[1500px] p-6">
        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        )}

        {teacher && (
          <>
            {/* ================= الهوية ================= */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
              className="mb-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5"
            >
              <div className="flex flex-wrap items-start gap-6">
                <Avatar
                  src={teacher.avatar}
                  name={`${teacher.lastName} ${teacher.firstName}`}
                  gender={teacher.gender}
                  size={64}
                  ring={ACCENT}
                />

                <div className="min-w-60 flex-1">
                  <h2 className="text-xl font-black">
                    {teacher.lastName} {teacher.firstName}
                  </h2>
                  <p className="mt-0.5 text-sm text-white/50">
                    {GENDER_LABEL[teacher.gender]}
                    {teacher.qualification && ` · ${teacher.qualification}`}
                    {teacher.specialization && ` · ${teacher.specialization}`}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[13px] text-white/60">
                    {teacher.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-white/30" />
                        <span dir="ltr">{teacher.phone}</span>
                      </span>
                    )}
                    {teacher.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-white/30" />
                        <span dir="ltr">{teacher.email}</span>
                      </span>
                    )}
                    {teacher.address && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-white/30" />
                        {teacher.address}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Stat
                    label="التوظيف"
                    value={dmy(teacher.hireDate)}
                    hint={`${yearsOfService(teacher.hireDate)} سنة خدمة`}
                  />
                  <Stat label="الإسنادات" value={String(yearAssignments.length)} tone={ACCENT} />
                  <Stat
                    label="الطلبة"
                    value={students ? String(students.distinctStudents) : "…"}
                    hint="بلا تكرار"
                  />
                  <Stat label="الحصص" value={String(sessionTotal)} hint="هذه السنة" />
                  <Stat
                    label="الحالة"
                    value={teacher.isActive ? "نشط" : "معطَّل"}
                    tone={teacher.isActive ? "#86efac" : "rgba(255,255,255,0.5)"}
                  />
                </div>
              </div>
            </motion.div>

            <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
              {/* ================= الإسنادات ================= */}
              <Panel
                icon={BookMarked}
                title="ما يدرّسه"
                hint={`${yearAssignments.length} إسناداً في هذه السنة`}
                action={
                  can("teaching-assignment.view")
                    ? { label: "إدارة الإسناد", to: PATHS.assignments }
                    : undefined
                }
              >
                {yearAssignments.length === 0 ? (
                  <Blank text="لا إسناد لهذا الأستاذ في السنة المختارة." />
                ) : (
                  <div className="space-y-2">
                    {yearAssignments.map((a) => {
                      const tone = subjectTone(a.subject.name);
                      const count = students?.byAssignment.get(a.id) ?? 0;

                      return (
                        <div
                          key={a.id}
                          className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5"
                          style={{ borderColor: `${tone}33`, background: `${tone}0f` }}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold" style={{ color: tone }}>
                              {a.subject.name}
                            </span>
                            <span className="block truncate text-[11px] text-white/50">
                              {a.studyGroup.level.name} — {a.studyGroup.name}
                            </span>
                          </span>

                          <span className="flex items-center gap-1.5 text-[12px] text-white/60">
                            <Users className="h-3.5 w-3.5 text-white/30" />
                            {count}
                          </span>

                          {!a.isActive && (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/45">
                              معطَّل
                            </span>
                          )}

                          <button
                            title="كشف حضور هذا الإسناد"
                            onClick={() => {
                              uiSound("navigate");
                              navigate(PATHS.attendanceDaily);
                            }}
                            className="grid h-7 w-7 place-items-center rounded-lg text-white/45 transition hover:bg-white/15 hover:text-white"
                          >
                            <ClipboardCheck className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>

              {/* ================= الجدول الأسبوعي ================= */}
              <Panel
                icon={CalendarDays}
                title="جدوله الأسبوعي"
                hint={`${schedules.length} خانة`}
                action={{ label: "الشبكة كاملة", to: PATHS.schedulesWeekly }}
              >
                {schedules.length === 0 ? (
                  <Blank text="لا خانات لهذا الأستاذ في الجدول الأسبوعي." />
                ) : (
                  <div className="space-y-2">
                    {DAYS.map((day) => {
                      /* بالوقت لا بـ order: الترتيب رقمٌ داخل أوقات صاحب
                         الفترة، وجدولُ الأستاذ يخلط فتراتِه بالفترات
                         العامّة — فرقمُ 1 فيهما وقتان مختلفان. */
                      const items = schedules
                        .filter((s) => s.dayOfWeek === day.key)
                        .sort((a, b) => a.lessonSlot.startTime.localeCompare(b.lessonSlot.startTime));

                      if (items.length === 0) return null;

                      return (
                        <div key={day.key} className="flex gap-3">
                          <span className="w-14 shrink-0 pt-1.5 text-[12px] font-bold text-white/45">
                            {day.label}
                          </span>
                          <div className="flex flex-1 flex-wrap gap-1.5">
                            {items.map((s) => {
                              const tone = subjectTone(s.teachingAssignment.subject.name);

                              return (
                                <span
                                  key={s.id}
                                  className="rounded-lg border px-2.5 py-1.5 text-[11px]"
                                  style={{ borderColor: `${tone}33`, background: `${tone}0f` }}
                                  title={`${s.lessonSlot.startTime} – ${s.lessonSlot.endTime}`}
                                >
                                  <span className="font-bold" style={{ color: tone }}>
                                    {s.teachingAssignment.subject.name}
                                  </span>
                                  <span className="text-white/45">
                                    {" "}
                                    · {s.teachingAssignment.studyGroup.name}
                                  </span>
                                  <span className="block text-white/30" dir="ltr">
                                    {s.lessonSlot.startTime}
                                    {s.classroom && ` · ${s.classroom.name}`}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </div>

            {/* ================= الحصص ================= */}
            <div className="mt-5">
              <Panel
                icon={CalendarClock}
                title="حصصه"
                hint={
                  sessionTotal > sessions.length
                    ? `أحدث ${sessions.length} من ${sessionTotal}`
                    : `${sessionTotal} حصة`
                }
              >
                {sessions.length === 0 ? (
                  <Blank text="لا حصص مسجَّلة لهذا الأستاذ في السنة المختارة." />
                ) : (
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-xs text-white/45">
                          <th className="px-3 py-2 text-start font-bold">التاريخ</th>
                          <th className="px-3 py-2 text-start font-bold">المادة</th>
                          <th className="px-3 py-2 text-start font-bold">الفوج</th>
                          <th className="px-3 py-2 text-start font-bold">التوقيت</th>
                          <th className="px-3 py-2 text-center font-bold">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => {
                          const ta = s.schedule.teachingAssignment;
                          const tone = subjectTone(ta.subject.name);
                          const st = SESSION_TONE[s.status];

                          return (
                            <tr
                              key={s.id}
                              className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
                            >
                              <td className="px-3 py-2 font-bold" dir="ltr">
                                {dmy(s.sessionDate)}
                              </td>
                              <td className="px-3 py-2 font-bold" style={{ color: tone }}>
                                {ta.subject.name}
                              </td>
                              <td className="px-3 py-2 text-white/60">
                                {ta.studyGroup.level.name} — {ta.studyGroup.name}
                              </td>
                              <td className="px-3 py-2 text-white/45" dir="ltr">
                                {s.schedule.lessonSlot.startTime} – {s.schedule.lessonSlot.endTime}
                                {s.schedule.classroom && (
                                  <span className="text-white/30"> · {s.schedule.classroom.name}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span
                                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                                  style={{ background: st.bg, color: st.fg }}
                                >
                                  {st.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>

            {/* ================= ملفّ وثائقه ================= */}
            <div className="mt-5">
              <Panel
                icon={FileText}
                title="وثائق ملفّه"
                hint={
                  documentCount === null
                    ? undefined
                    : documentCount === 0
                      ? "لا وثيقة بعد"
                      : `${documentCount} مسلَّمة`
                }
              >
                {/*
                  الرفعُ هنا لمن يملك التعديل وحده — ومن لا يملكه يرى ما
                  سُلّم ولا يمسّه. والعرضُ لا يُخفى عنه: سؤالُ «هل سلّم
                  شهادته؟» يسأله الاستقبالُ لا الإدارةُ وحدها.
                */}
                <TeacherDocumentsPanel
                  teacherId={teacher.id}
                  readOnly={!can("teacher.update")}
                  onChange={(f) => setDocumentCount(f.delivered)}
                />
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
      <div className="text-[11px] text-white/40">{label}</div>
      <div className="font-black" style={{ color: tone }}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-white/30">{hint}</div>}
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  hint,
  action,
  children,
}: {
  icon: typeof BookMarked;
  title: string;
  hint?: string;
  action?: { label: string; to: string };
  children: React.ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <Icon className="h-4.5 w-4.5" style={{ color: ACCENT }} />
        <h3 className="font-black">{title}</h3>
        {hint && <span className="text-[11px] text-white/35">{hint}</span>}

        {action && (
          <button
            onClick={() => {
              uiSound("navigate");
              navigate(action.to);
            }}
            className="ms-auto rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-white/55 transition hover:bg-white/15 hover:text-white"
          >
            {action.label}
          </button>
        )}
      </div>

      {children}
    </section>
  );
}

function Blank({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-white/35">{text}</p>;
}
