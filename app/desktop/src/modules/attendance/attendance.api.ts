import { apiClient } from "../../core/api/client";
import type { Assignment } from "../../core/api/reference.api";

/* الإسناد وأدواته مرجعية يشترك فيها الكشف والجدول الأسبوعي */
export { listAssignments, fullName } from "../../core/api/reference.api";
export type { Assignment } from "../../core/api/reference.api";

/**
 * طبقة الكشوف — قراءة فوق المسارات القائمة بلا أي إضافة على الخادم.
 *
 * الكشف الورقي عمودُه **الإسناد التدريسي**: أستاذ + مادة + فوج + سنة.
 * ومن هذا الإسناد وحده تُشتقّ ترويسة الكشف كلّها (الطور والمستوى والفوج
 * والمادة والأستاذ)، وتُقيَّد به الحصصُ والمسجَّلون والحضور. لذلك تجلب
 * هذه الطبقة الإسنادات أولاً وتبني منها قوائم التصفية، فلا يظهر في
 * «الأستاذ» إلّا من يدرّس المادة المختارة فعلاً — الترابط خاصيّةُ
 * البيانات لا قاعدةً تُكتب في الواجهة.
 */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

// --------------------------------------------------
// الحصص الفعلية — أعمدة الكشف
// --------------------------------------------------

export interface SessionRow {
  /** الكشف الذي تنتمي إليه — null يعني حصةً يتيمة تحجز تاريخها */
  sheetId: string | null;
  id: string;
  scheduleId: string;
  lessonNumber: number;
  sessionDate: string;
  status: SessionStatus;
  note: string | null;
  schedule: {
    id: string;
    dayOfWeek: string;
    lessonSlot: { id: string; name: string; order: number; startTime: string; endTime: string };
    classroom: { id: string; name: string } | null;
    teachingAssignment: {
      id: string;
      subject: { id: string; name: string };
      teacher: { id: string; firstName: string; lastName: string };
      studyGroup: { id: string; name: string; level: { id: string; name: string } };
      academicYear: { id: string; name: string };
    };
  };
}

/**
 * حصص إسنادٍ في شهر.
 *
 * التصفية بالمادة والفوج والأستاذ والسنة معاً — وهي بالضبط المفاتيح
 * الأربعة التي تُعرّف الإسناد، فلا تتسرّب حصصُ أستاذٍ آخر يدرّس المادة
 * نفسها للفوج نفسه.
 */
export const listSessions = async (params: {
  academicYearId: string;
  subjectId: string;
  studyGroupId: string;
  teacherId: string;
  dateFrom: string;
  dateTo: string;
}) => {
  const rows: SessionRow[] = [];
  let page = 1;

  for (;;) {
    const { data } = await apiClient.get("/sessions", {
      params: { ...params, limit: 100, page },
    });

    rows.push(...(data.data as SessionRow[]));

    const pagination = data.pagination as Pagination;
    if (page >= pagination.totalPages || pagination.totalPages === 0) break;
    page++;
  }

  // ترتيب الأعمدة بالتاريخ ثم برقم الحصة — كما تُقرأ الورقة
  return rows.sort((a, b) => {
    const d = a.sessionDate.localeCompare(b.sessionDate);
    return d !== 0 ? d : a.lessonNumber - b.lessonNumber;
  });
};

/**
 * خانات الجدول الأسبوعي لهذا الإسناد.
 *
 * إنشاء حصةٍ يدوياً يحتاج `scheduleId`: الحصة واقعةٌ لخانةٍ في الجدول،
 * لا حدثٌ معلَّق في الهواء. ولأنّ الإسناد قد يقع في يومين من الأسبوع،
 * يختار المستخدم أيَّ خانةٍ يستدرك حصّتها.
 */
export interface ScheduleOption {
  id: string;
  dayOfWeek: string;
  lessonSlot: { id: string; name: string; startTime: string; endTime: string };
  classroom: { id: string; name: string } | null;
}

export const listSchedulesOf = async (teachingAssignmentId: string) => {
  const { data } = await apiClient.get("/schedules", {
    params: { teachingAssignmentId, limit: 100 },
  });
  return data.data as ScheduleOption[];
};

export const createSession = async (body: {
  scheduleId: string;
  sessionDate: string;
  sheetId?: string;
}) => {
  const { data } = await apiClient.post("/sessions", body);
  return data.data.session as SessionRow;
};

// --------------------------------------------------
// الكشف — الوعاء الذي يملك أعمدته
//
// لا نافذة تواريخ ولا شهر تقويمي: العمود في هذا الكشف لأنّ أحداً
// وضعه فيه. وبهذا يسقط سؤالٌ لم يكن له جواب — حصةٌ في مطلع الشهر
// التالي، أهي ذيلُ هذا الكشف أم مطلعُ الذي يليه؟
// --------------------------------------------------

export interface SheetSession {
  id: string;
  scheduleId: string;
  lessonNumber: number;
  sessionDate: string;
  status: SessionStatus;
  note: string | null;
  schedule: {
    id: string;
    dayOfWeek: string;
    lessonSlot: { id: string; name: string; order: number; startTime: string; endTime: string };
    classroom: { id: string; name: string } | null;
  };
}

export interface Sheet {
  id: string;
  teachingAssignmentId: string;
  academicYearId: string;
  number: number;
  label: string | null;
  sessionCount: number;
  note: string | null;
  teachingAssignment: {
    id: string;
    subject: { id: string; name: string };
    teacher: { id: string; firstName: string; lastName: string };
    studyGroup: {
      id: string;
      name: string;
      level: { id: string; name: string; educationStage: { id: string; name: string } };
    };
    academicYear: { id: string; name: string };
  };
  _count: { sessions: number };
  sessions: SheetSession[];
}

/** «الشهر السادس» إن كُتبت تسمية، وإلّا «الشهر رقم 6» */
export const sheetTitle = (sheet: { number: number; label: string | null }) =>
  sheet.label?.trim() || `الشهر رقم ${sheet.number}`;

export const listSheets = async (teachingAssignmentId: string) => {
  const { data } = await apiClient.get("/attendance-sheets", {
    params: { teachingAssignmentId, limit: 100 },
  });
  return data.data as Sheet[];
};

export const getSheet = async (id: string) => {
  const { data } = await apiClient.get(`/attendance-sheets/${id}`);
  return data.data.sheet as Sheet;
};

export const createSheet = async (body: {
  teachingAssignmentId: string;
  label?: string | null;
  sessionCount?: number;
}) => {
  const { data } = await apiClient.post("/attendance-sheets", body);
  return data.data.sheet as Sheet;
};

export const updateSheet = async (
  id: string,
  body: { label?: string | null; sessionCount?: number; number?: number },
) => {
  const { data } = await apiClient.patch(`/attendance-sheets/${id}`, body);
  return data.data.sheet as Sheet;
};

/** يحذف الكشف بحصصه وحضورِها — ويُرجع ما مُحي فعلاً */
export const deleteSheet = async (id: string) => {
  const { data } = await apiClient.delete(`/attendance-sheets/${id}`);
  return data.data as { id: string; sessions: number; marks: number };
};

/** تصحيح تاريخ حصة — الورقة قد تُملأ بتاريخٍ خاطئ */
export const updateSessionDate = async (id: string, sessionDate: string) => {
  const { data } = await apiClient.patch(`/sessions/${id}`, { sessionDate });
  return data.data.session as SessionRow;
};

/**
 * ضمُّ حصةٍ يتيمة إلى كشف.
 *
 * حذفُ كشفٍ يفكّ حصصه ولا يمحوها — الحضور المسجَّل لا يضيع بحذف ورقة
 * إدارية. لكنّ الحصة المفكوكة تحجز تاريخها فيُرفض عمودٌ جديد عليه،
 * فتُضمّ بدل أن تُترك تسدّ الطريق.
 */
export const adoptSession = async (id: string, sheetId: string) => {
  const { data } = await apiClient.patch(`/sessions/${id}`, { sheetId });
  return data.data.session as SessionRow;
};

/** حصص هذا الإسناد في يومٍ بعينه — للعثور على اليتيمة التي تحجز التاريخ */
export const findSessionsOn = async (
  teachingAssignmentId: string,
  date: string,
) => {
  const { data } = await apiClient.get("/sessions", {
    params: { teachingAssignmentId, dateFrom: date, dateTo: date, limit: 20 },
  });

  return data.data as SessionRow[];
};

export const removeSession = async (id: string) => {
  await apiClient.delete(`/sessions/${id}`);
};

// --------------------------------------------------
// المسجَّلون — صفوف الكشف
// --------------------------------------------------

export interface EnrollmentRow {
  id: string;
  studentId: string;
  teachingAssignmentId: string;
  isActive: boolean;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    parentPhone: string;
    /** الملاحظة الإدارية — عمود «ملاحظات» في الكشف */
    note: string | null;
  };
}

export const listEnrollments = async (teachingAssignmentId: string) => {
  const rows: EnrollmentRow[] = [];
  let page = 1;

  for (;;) {
    const { data } = await apiClient.get("/enrollments", {
      params: { teachingAssignmentId, isActive: "true", limit: 100, page },
    });

    rows.push(...(data.data as EnrollmentRow[]));

    const pagination = data.pagination as Pagination;
    if (page >= pagination.totalPages || pagination.totalPages === 0) break;
    page++;
  }

  return rows.sort((a, b) =>
    `${a.student.lastName} ${a.student.firstName}`.localeCompare(
      `${b.student.lastName} ${b.student.firstName}`,
      "ar",
    ),
  );
};

// --------------------------------------------------
// الحضور — خلايا الكشف
// --------------------------------------------------

export interface AttendanceRow {
  id: string;
  studentEnrollmentId: string;
  sessionId: string;
  status: AttendanceStatus;
  note: string | null;
}

export const listAttendance = async (params: {
  teachingAssignmentId: string;
  dateFrom: string;
  dateTo: string;
}) => {
  const rows: AttendanceRow[] = [];
  let page = 1;

  for (;;) {
    const { data } = await apiClient.get("/attendance", {
      params: { ...params, limit: 200, page },
    });

    rows.push(...(data.data as AttendanceRow[]));

    const pagination = data.pagination as Pagination;
    if (page >= pagination.totalPages || pagination.totalPages === 0) break;
    page++;
  }

  return rows;
};

export const createAttendance = async (body: {
  sessionId: string;
  studentEnrollmentId: string;
  status: AttendanceStatus;
}) => {
  const { data } = await apiClient.post("/attendance", body);
  return data.data.attendance as AttendanceRow;
};

export const updateAttendance = async (
  id: string,
  body: { status?: AttendanceStatus; note?: string | null },
) => {
  const { data } = await apiClient.patch(`/attendance/${id}`, body);
  return data.data.attendance as AttendanceRow;
};

/** تعليم الفوج كاملاً في حصة — إعادة الإرسال تُحدِّث ولا تُكرّر */
export const bulkAttendance = async (body: {
  sessionId: string;
  records: { studentEnrollmentId: string; status: AttendanceStatus }[];
}) => {
  const { data } = await apiClient.post("/attendance/bulk", body);
  return data.data as { created: number; updated: number };
};

/**
 * تفريغ ورقة حصة — تعود خاناتها فارغة لا غياباً.
 *
 * الفرق بينهما معنويٌّ لا شكليّ: الفارغ «لم يُسجَّل بعد»، والغياب
 * «سُجّل أنه غاب». فمن ملأ عموداً بالخطأ يحتاج الأولى لا الثانية.
 */
export const clearSessionAttendance = async (sessionId: string) => {
  const { data } = await apiClient.delete(`/attendance/session/${sessionId}`);
  return data.data as { sessionId: string; deleted: number };
};

// --------------------------------------------------
// ملاحظة الطالب — حقل إداري على الطالب نفسه
//
// الملاحظة تخصّ الطالب لا الحصة («ملف ناقص»، «توقّف عن الدراسة»)،
// فمحلّها Student.note لا Attendance.note الذي يخصّ حضوراً بعينه.
// --------------------------------------------------

export const updateStudentNote = async (studentId: string, note: string | null) => {
  const { data } = await apiClient.patch(`/students/${studentId}`, { note });
  return data.data.student as { id: string; note: string | null };
};

// --------------------------------------------------
// أدوات العرض
// --------------------------------------------------

/* حساب الفترة دوالُّ خالصة — محلُّها period.ts وتُختبر وحدها */
export {
  MONTHS,
  sheetDate,
  isoDate,
  monthRange,
  sheetWindow,
  columnsRange,
  inMonth,
  sheetColumns,
  periodLabel,
} from "./period";

export const STATUS_TONE: Record<
  AttendanceStatus,
  { short: string; label: string; bg: string; fg: string }
> = {
  PRESENT: { short: "ح", label: "حاضر", bg: "rgba(134,239,172,0.14)", fg: "#86efac" },
  ABSENT: { short: "غ", label: "غائب", bg: "rgba(251,113,133,0.14)", fg: "#fda4af" },
  LATE: { short: "ت", label: "متأخّر", bg: "rgba(252,211,77,0.14)", fg: "#fcd34d" },
  EXCUSED: { short: "ع", label: "معذور", bg: "rgba(147,197,253,0.14)", fg: "#93c5fd" },
};

// --------------------------------------------------
// اشتقاق قوائم التصفية من الإسنادات
// --------------------------------------------------

export interface SheetFilters {
  stageId: string;
  levelId: string;
  subjectId: string;
  teacherId: string;
  groupId: string;
}

const uniqueBy = <T>(rows: T[], key: (row: T) => string): T[] => {
  const seen = new Map<string, T>();
  for (const row of rows) if (!seen.has(key(row))) seen.set(key(row), row);
  return [...seen.values()];
};

/**
 * الخيارات المتاحة لكل حقل بعد تطبيق ما اختير قبله.
 *
 * كل قائمة تُحسب من الإسنادات المطابقة **لبقية** المرشِّحات لا لنفسها،
 * فيبقى الحقل قادراً على عرض بدائله بينما تضيق القوائم الأخرى حوله.
 */
export const deriveOptions = (rows: Assignment[], f: SheetFilters) => {
  const match = (a: Assignment, skip: keyof SheetFilters) =>
    (skip === "stageId" || !f.stageId || a.studyGroup.level.educationStage.id === f.stageId) &&
    (skip === "levelId" || !f.levelId || a.studyGroup.level.id === f.levelId) &&
    (skip === "subjectId" || !f.subjectId || a.subject.id === f.subjectId) &&
    (skip === "teacherId" || !f.teacherId || a.teacher.id === f.teacherId) &&
    (skip === "groupId" || !f.groupId || a.studyGroup.id === f.groupId);

  return {
    stages: uniqueBy(
      rows.filter((a) => match(a, "stageId")).map((a) => a.studyGroup.level.educationStage),
      (s) => s.id,
    ),
    levels: uniqueBy(
      rows.filter((a) => match(a, "levelId")).map((a) => a.studyGroup.level),
      (l) => l.id,
    ),
    subjects: uniqueBy(
      rows.filter((a) => match(a, "subjectId")).map((a) => a.subject),
      (s) => s.id,
    ),
    teachers: uniqueBy(
      rows.filter((a) => match(a, "teacherId")).map((a) => a.teacher),
      (t) => t.id,
    ),
    groups: uniqueBy(
      rows.filter((a) => match(a, "groupId")).map((a) => a.studyGroup),
      (g) => g.id,
    ),
  };
};

/** الإسناد الوحيد المطابق للمرشِّحات — أو null إن بقي الاختيار ناقصاً */
export const resolveAssignment = (
  rows: Assignment[],
  f: SheetFilters,
): Assignment | null => {
  if (!f.subjectId || !f.groupId || !f.teacherId) return null;

  return (
    rows.find(
      (a) =>
        a.subject.id === f.subjectId &&
        a.studyGroup.id === f.groupId &&
        a.teacher.id === f.teacherId,
    ) ?? null
  );
};
