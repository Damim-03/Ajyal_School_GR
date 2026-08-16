import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BookMarked,
  CalendarDays,
  ClipboardCheck,
  FileText,
  IdCard,
  Loader2,
  Pencil,
  Phone,
  Receipt,
  School,
  User,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { Avatar } from "../../components/shared/Avatar";
import { useAuthStore } from "../../core/stores/auth.store";
import { formatMoney as money } from "../../core/utils/money";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { DocumentsPanel } from "./DocumentsPanel";
import { StudentCardPanel } from "./StudentCardPanel";
import { StudentForm } from "./StudentForm";
import {
  getAttendanceSummary,
  getStudent,
  getStudentEnrollments,
  listStudentAttendance,
  listStudentInvoices,
  type AttendanceRow,
  type AttendanceSummary,
  type Enrollment,
  type Student,
  type StudentInvoice,
} from "./student.api";

const ACCENT = "#7dd3fc";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-DZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

const ageOf = (birthDate: string | null): number | null => {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
};

type Tab = "card" | "enrollments" | "invoices" | "attendance" | "documents";

/**
 * تفصيل الطالب.
 *
 * الأقسام الأربعة تأتي من **أربع نقاط نهاية بأربع صلاحيات مختلفة**،
 * فالقسم يُخفى كاملاً لمن لا يملك صلاحيته — لا يُعرض فارغاً ولا يُعرض
 * ثمّ يُردّ بـ403. الأمانة ترى التسجيلات ولا ترى الفواتير، وهذا صحيح.
 */
export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.hasPermission);

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const tabs: { key: Tab; label: string; icon: typeof BookMarked; allowed: boolean }[] = [
    /*
     * البطاقة أوّلاً: هي ما يُفتح الملفّ لأجله في الاستقبال — تُطبع
     * مرّةً عند التسجيل ثمّ تُعاد طباعتها حين تُفقد.
     * وصلاحيتها `student.view` نفسُها التي فتحت الصفحة: كلّ ما عليها
     * معروضٌ في بطاقة الهوية جانبها.
     */
    { key: "card", label: "البطاقة", icon: IdCard, allowed: true },
    { key: "enrollments", label: "التسجيلات", icon: BookMarked, allowed: can("enrollment.view") },
    { key: "invoices", label: "الفواتير", icon: Receipt, allowed: can("invoice.view") },
    { key: "attendance", label: "الحضور", icon: ClipboardCheck, allowed: can("attendance.view") },
    { key: "documents", label: "الوثائق", icon: FileText, allowed: can("student.view") },
  ];

  const allowedTabs = tabs.filter((t) => t.allowed);
  const [tab, setTab] = useState<Tab>(allowedTabs[0]?.key ?? "documents");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      setStudent(await getStudent(id));
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string } } }).response;
      setError(response?.data?.message ?? "تعذّر جلب بيانات الطالب");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05070d] text-white/40">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-[#05070d] text-white">
        <AppHeader title="الطالب" subtitle="غير موجود">
          <button
            onClick={() => navigate(PATHS.studentsList)}
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
          >
            <ArrowRight className="h-4 w-4" />
            رجوع
          </button>
        </AppHeader>
        <div className="mx-auto max-w-150 p-6">
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error ?? "الطالب غير موجود"}
          </div>
        </div>
      </div>
    );
  }

  const name = `${student.firstName} ${student.lastName}`;
  const age = ageOf(student.birthDate);

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title={name} subtitle="ملف الطالب">
        {can("student.update") && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
          >
            <Pencil className="h-4 w-4" />
            تعديل
          </button>
        )}
        <button
          onClick={() => navigate(PATHS.studentsList)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto grid max-w-325 gap-6 p-6 lg:grid-cols-[340px_1fr]">
        {/* ================= بطاقة الهوية ================= */}
        <motion.aside
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
          className="space-y-4 lg:sticky lg:top-6 lg:self-start"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <div className="mb-4 flex justify-center">
              <Avatar src={student.avatar} name={name} gender={student.gender} size={96} ring={ACCENT} />
            </div>

            <h2 className="text-xl font-black">{name}</h2>

            <div className="mt-1 text-xs text-white/45">
              {student.gender === "MALE" ? "ذكر" : "أنثى"}
              {age !== null && ` · ${age} سنة`}
            </div>

            {/* رقم المؤسسة — ما يُملى في الهاتف وما تحمله البطاقة */}
            <div
              className="mt-2 inline-block rounded-lg bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold tracking-[0.12em] text-white/60 tabular-nums"
              dir="ltr"
              title="رقم الطالب في المؤسسة"
            >
              {student.studentNumber}
            </div>

            <span
              className="mt-3 inline-block rounded-full px-3 py-1 text-[11px] font-bold"
              style={
                student.isActive
                  ? { background: "rgba(134,239,172,0.14)", color: "#86efac" }
                  : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)" }
              }
            >
              {student.isActive ? "نشط" : "معطّل"}
            </span>
          </div>

          <div className="space-y-1 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <Row icon={Phone} label="هاتف ولي الأمر" value={student.parentPhone} ltr strong />
            <Row icon={Phone} label="هاتف الطالب" value={student.phone} ltr />
            <Row icon={Phone} label="هاتف الطوارئ" value={student.emergencyPhone} ltr />
            <Row icon={School} label="المدرسة الأصلية" value={student.schoolName} />
            <Row icon={User} label="العنوان" value={student.address} />
            <Row
              icon={CalendarDays}
              label="تاريخ الميلاد"
              value={student.birthDate ? fmtDate(student.birthDate) : null}
              ltr
            />
            <Row
              icon={CalendarDays}
              label="تاريخ التسجيل"
              value={fmtDate(student.registrationDate)}
              ltr
            />
          </div>

          {student.note && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-1.5 text-[11px] font-bold text-white/45">ملاحظة</div>
              <p className="text-sm leading-relaxed text-white/70">{student.note}</p>
            </div>
          )}
        </motion.aside>

        {/* ================= الأقسام ================= */}
        <motion.main
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, delay: 0.05, ease: MOTION.easing.enter }}
        >
          <div className="mb-5 flex flex-wrap gap-2">
            {allowedTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition"
                style={
                  tab === t.key
                    ? { borderColor: `${ACCENT}55`, background: `${ACCENT}1a`, color: ACCENT }
                    : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }
                }
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            {tab === "card" && <StudentCardPanel student={student} />}
            {tab === "enrollments" && <EnrollmentsTab studentId={student.id} />}
            {tab === "invoices" && <InvoicesTab studentId={student.id} />}
            {tab === "attendance" && <AttendanceTab studentId={student.id} />}
            {tab === "documents" && <DocumentsPanel studentId={student.id} />}
          </div>
        </motion.main>
      </div>

      {editing && (
        <StudentForm
          student={student}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      )}
    </div>
  );
}

// --------------------------------------------------
// التسجيلات
// --------------------------------------------------

function EnrollmentsTab({ studentId }: { studentId: string }) {
  const [rows, setRows] = useState<Enrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStudentEnrollments(studentId)
      .then(setRows)
      .catch(() => setError("تعذّر جلب التسجيلات"));
  }, [studentId]);

  if (error) return <Problem text={error} />;
  if (!rows) return <Spinner />;
  if (rows.length === 0)
    return <Empty icon={BookMarked} text="لم يُسجَّل في أي مادة بعد" />;

  return (
    <div className="space-y-3">
      {rows.map((e) => (
        <div
          key={e.id}
          className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-4"
        >
          <div className="min-w-45 flex-1">
            <div className="font-bold">{e.teachingAssignment.subject.name}</div>
            <div className="text-[11px] text-white/45">
              {e.teachingAssignment.teacher.firstName}{" "}
              {e.teachingAssignment.teacher.lastName}
            </div>
          </div>

          <div className="text-xs text-white/60">
            <div>{e.teachingAssignment.studyGroup.name}</div>
            <div className="text-[11px] text-white/35">
              {e.teachingAssignment.studyGroup.level.name}
            </div>
          </div>

          <div className="text-xs text-white/50">
            {e.teachingAssignment.academicYear.name}
            {e.teachingAssignment.academicYear.isCurrent && (
              <span className="ms-1.5 text-[10px] text-emerald-300">جارية</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-white/40">
            <span>{e._count.invoices} فاتورة</span>
            <span>{e._count.attendances} حضور</span>
          </div>

          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={
              e.isActive
                ? { background: "rgba(134,239,172,0.14)", color: "#86efac" }
                : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)" }
            }
          >
            {e.isActive ? "نشط" : "معطّل"}
          </span>
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------
// الفواتير
// --------------------------------------------------

const INVOICE_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  PAID: { bg: "rgba(134,239,172,0.14)", fg: "#86efac", label: "مسدَّدة" },
  PARTIAL: { bg: "rgba(252,211,77,0.14)", fg: "#fcd34d", label: "جزئية" },
  PENDING: { bg: "rgba(255,255,255,0.08)", fg: "rgba(255,255,255,0.6)", label: "معلّقة" },
  CANCELLED: { bg: "rgba(255,255,255,0.05)", fg: "rgba(255,255,255,0.35)", label: "ملغاة" },
};

function InvoicesTab({ studentId }: { studentId: string }) {
  const [rows, setRows] = useState<StudentInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listStudentInvoices(studentId)
      .then((r) => setRows(r.invoices))
      .catch(() => setError("تعذّر جلب الفواتير"));
  }, [studentId]);

  if (error) return <Problem text={error} />;
  if (!rows) return <Spinner />;
  if (rows.length === 0) return <Empty icon={Receipt} text="لا فواتير بعد" />;

  const due = rows
    .filter((i) => i.status !== "CANCELLED")
    .reduce((sum, i) => sum + i.remaining, 0);

  return (
    <div className="space-y-4">
      {due > 0 && (
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-3 text-sm">
          <span className="text-white/60">المستحقّ الإجمالي: </span>
          <span className="font-black text-amber-200">{money(due)}</span>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs text-white/50">
            <th className="px-3 py-2.5 text-start font-bold">الرقم</th>
            <th className="px-3 py-2.5 text-start font-bold">المادة</th>
            <th className="px-3 py-2.5 text-start font-bold">الشهر</th>
            <th className="px-3 py-2.5 text-start font-bold">الإجمالي</th>
            <th className="px-3 py-2.5 text-start font-bold">المتبقّي</th>
            <th className="px-3 py-2.5 text-center font-bold">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => {
            const tone = INVOICE_TONE[i.status];
            return (
              <tr key={i.id} className="border-b border-white/5 last:border-0">
                <td className="px-3 py-2.5 text-white/60" dir="ltr">{i.invoiceNumber}</td>
                <td className="px-3 py-2.5">
                  {i.studentEnrollment.teachingAssignment.subject.name}
                </td>
                <td className="px-3 py-2.5 text-white/60" dir="ltr">
                  {String(i.month).padStart(2, "0")}/{i.year}
                </td>
                <td className="px-3 py-2.5">{money(i.total)}</td>
                <td className="px-3 py-2.5 font-bold">
                  {i.remaining > 0 ? money(i.remaining) : "—"}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {tone.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --------------------------------------------------
// الحضور
// --------------------------------------------------

const ATTENDANCE_TONE: Record<string, { fg: string; label: string }> = {
  PRESENT: { fg: "#86efac", label: "حاضر" },
  ABSENT: { fg: "#fda4af", label: "غائب" },
  LATE: { fg: "#fcd34d", label: "متأخّر" },
  EXCUSED: { fg: "#a5b4fc", label: "بعذر" },
};

function AttendanceTab({ studentId }: { studentId: string }) {
  const [rows, setRows] = useState<AttendanceRow[] | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const can = useAuthStore((s) => s.hasPermission);

  useEffect(() => {
    listStudentAttendance(studentId)
      .then((r) => setRows(r.rows))
      .catch(() => setError("تعذّر جلب الحضور"));

    /* الملخّص تقرير — صلاحيته مستقلّة عن سجل الحضور */
    if (can("report.view")) {
      getAttendanceSummary(studentId).then(setSummary).catch(() => setSummary(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  if (error) return <Problem text={error} />;
  if (!rows) return <Spinner />;

  return (
    <div className="space-y-4">
      {summary && summary.total > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="نسبة الحضور" value={`${summary.attendanceRate}%`} tone="#86efac" />
          <Stat label="حاضر" value={String(summary.counts.PRESENT)} />
          <Stat label="غائب" value={String(summary.counts.ABSENT)} tone="#fda4af" />
          <Stat label="متأخّر" value={String(summary.counts.LATE)} tone="#fcd34d" />
          <Stat label="بعذر" value={String(summary.counts.EXCUSED)} tone="#a5b4fc" />
        </div>
      )}

      {rows.length === 0 ? (
        <Empty icon={ClipboardCheck} text="لا سجلّات حضور بعد" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs text-white/50">
              <th className="px-3 py-2.5 text-start font-bold">التاريخ</th>
              <th className="px-3 py-2.5 text-start font-bold">المادة</th>
              <th className="px-3 py-2.5 text-start font-bold">الحصة</th>
              <th className="px-3 py-2.5 text-center font-bold">الحالة</th>
              <th className="px-3 py-2.5 text-start font-bold">ملاحظة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const tone = ATTENDANCE_TONE[a.status];
              return (
                <tr key={a.id} className="border-b border-white/5 last:border-0">
                  <td className="px-3 py-2.5 text-white/60" dir="ltr">
                    {fmtDate(a.session.sessionDate)}
                  </td>
                  <td className="px-3 py-2.5">
                    {a.session.schedule.teachingAssignment.subject.name}
                  </td>
                  <td className="px-3 py-2.5 text-white/50">#{a.session.lessonNumber}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-xs font-bold" style={{ color: tone.fg }}>
                      {tone.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-white/45">{a.note ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// --------------------------------------------------
// عناصر صغيرة
// --------------------------------------------------

function Row({
  icon: Icon,
  label,
  value,
  ltr,
  strong,
}: {
  icon: typeof Phone;
  label: string;
  value?: string | null;
  ltr?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-white/25" />
      <span className="text-[11px] text-white/40">{label}</span>
      <span
        className={`ms-auto truncate text-xs ${strong ? "font-bold text-white" : "text-white/70"}`}
        dir={ltr ? "ltr" : undefined}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-center">
      <div className="text-lg font-black" style={{ color: tone ?? "#fff" }}>
        {value}
      </div>
      <div className="text-[10px] text-white/40">{label}</div>
    </div>
  );
}

const Spinner = () => (
  <div className="grid place-items-center py-14 text-white/40">
    <Loader2 className="h-6 w-6 animate-spin" />
  </div>
);

const Problem = ({ text }: { text: string }) => (
  <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
    {text}
  </div>
);

const Empty = ({ icon: Icon, text }: { icon: typeof BookMarked; text: string }) => (
  <div className="py-14 text-center">
    <Icon className="mx-auto mb-3 h-10 w-10 text-white/15" />
    <p className="text-white/50">{text}</p>
  </div>
);
