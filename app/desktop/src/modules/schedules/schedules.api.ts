import { apiClient } from "../../core/api/client";

/**
 * الجدول الأسبوعي.
 *
 * `Schedule` قاعدةٌ متكرّرة — «الإنجليزية للفوج 1 كلَّ اثنين من 08:00
 * إلى 10:00» — تُبنى مرّة في السنة. و`Session` واقعةٌ لها تاريخ تُشتقّ
 * منها ويُعلَّق عليها الحضور، لكنّها **لا تُنشأ من هنا**: كشف الحضور
 * يُنشئ حصّته حين يُكتب تاريخ العمود، فتولد منسوبةً إلى كشفها.
 *
 * وكان ههنا توليدٌ جملةً لمدى تاريخي (`/sessions/generate`) وشاشةٌ
 * تعرضه، فحُذفا: ما يولّدانه يبقى بلا كشف — لا يُدوَّن عليه حضور ولا
 * يدخل في تخليص أستاذ — فكان مصنعَ صفوفٍ يتيمة.
 */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type DayOfWeek =
  | "SATURDAY"
  | "SUNDAY"
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY";

export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

/** ترتيب الأسبوع الدراسي — السبت أوّله كما في المخطّط */
export const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: "SATURDAY", label: "السبت", short: "سبت" },
  { key: "SUNDAY", label: "الأحد", short: "أحد" },
  { key: "MONDAY", label: "الاثنين", short: "اثنين" },
  { key: "TUESDAY", label: "الثلاثاء", short: "ثلاثاء" },
  { key: "WEDNESDAY", label: "الأربعاء", short: "أربعاء" },
  { key: "THURSDAY", label: "الخميس", short: "خميس" },
  { key: "FRIDAY", label: "الجمعة", short: "جمعة" },
];

// --------------------------------------------------
// الجدول الأسبوعي
// --------------------------------------------------

export interface ScheduleRow {
  id: string;
  teachingAssignmentId: string;
  classroomId: string | null;
  lessonSlotId: string;
  dayOfWeek: DayOfWeek;
  isActive: boolean;
  lessonSlot: { id: string; name: string; order: number; startTime: string; endTime: string };
  classroom: { id: string; name: string } | null;
  teachingAssignment: {
    id: string;
    subject: { id: string; name: string; color?: string | null };
    teacher: { id: string; firstName: string; lastName: string };
    studyGroup: { id: string; name: string; level: { id: string; name: string } };
    academicYear: { id: string; name: string; isCurrent: boolean };
  };
}

export const listSchedules = async (params: {
  academicYearId: string;
  teacherId?: string;
  studyGroupId?: string;
  subjectId?: string;
  classroomId?: string;
}) => {
  const rows: ScheduleRow[] = [];
  let page = 1;

  for (;;) {
    const { data } = await apiClient.get("/schedules", {
      params: { ...params, limit: 100, page },
    });

    rows.push(...(data.data as ScheduleRow[]));

    const pagination = data.pagination as Pagination;
    if (page >= pagination.totalPages || pagination.totalPages === 0) break;
    page++;
  }

  return rows;
};

export const createSchedule = async (body: {
  teachingAssignmentId: string;
  lessonSlotId: string;
  dayOfWeek: DayOfWeek;
  classroomId?: string | null;
}) => {
  const { data } = await apiClient.post("/schedules", body);
  return data.data.schedule as ScheduleRow;
};

export const updateSchedule = async (
  id: string,
  body: { classroomId?: string | null; isActive?: boolean },
) => {
  const { data } = await apiClient.patch(`/schedules/${id}`, body);
  return data.data.schedule as ScheduleRow;
};

export const deleteSchedule = async (id: string) => {
  await apiClient.delete(`/schedules/${id}`);
};

// --------------------------------------------------
// أدوات العرض
//
// حالةُ الحصة تُقرأ هنا ولا تُكتب: التدوين صار في كشف الحضور، وبقي
// هذا اللون لأنّ بطاقة الأستاذ تعرض حصصه وحالاتِها.
// --------------------------------------------------

export const SESSION_TONE: Record<SessionStatus, { label: string; bg: string; fg: string }> = {
  SCHEDULED: { label: "مبرمَجة", bg: "rgba(199,210,254,0.14)", fg: "#c7d2fe" },
  COMPLETED: { label: "تمّت", bg: "rgba(134,239,172,0.14)", fg: "#86efac" },
  CANCELLED: { label: "ملغاة", bg: "rgba(255,255,255,0.06)", fg: "rgba(255,255,255,0.4)" },
};

/** 2026-09-03T00:00:00Z → 03/09/2026 */
export const dmy = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

/**
 * لونٌ ثابت لكل مادة.
 *
 * الجدول يُقرأ بالمسح لا بالقراءة: العين تتبع اللون قبل الاسم. ولأنّ
 * `Subject.color` اختياري وقد لا يُضبط، يُشتقّ لونٌ من اسم المادة —
 * ثابتٌ عبر الجلسات لأنّه دالّةٌ في الاسم لا عشوائي.
 */
const PALETTE = [
  "#c7d2fe", "#fcd34d", "#86efac", "#f9a8d4", "#93c5fd",
  "#fdba74", "#a5b4fc", "#5eead4", "#fda4af", "#d8b4fe",
];

export const subjectTone = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
};

// --------------------------------------------------
// الحجم الساعي
//
// حصص التوقيت ليست متساوية: ساعتان، وساعة ونصف، وساعة وثلاثة أرباع.
// وعرضُ الطرفين وحدهما (08:00 – 12:00) يترك القارئ يطرح في رأسه، وهو
// أمرٌ يُخطئ فيه المستعجل — خصوصاً حين تعبر الفترةُ الساعةَ الكاملة.
//
// والحسابُ نفسُه انتقل إلى `lesson-size` مع قاعدة استنتاج الحجم،
// ويُعاد تصديرُه من هنا لأنّ نصف الشاشات تستورده من هذا الملفّ.
// --------------------------------------------------

export {
  toMinutes,
  slotMinutes,
  durationLabel,
  slotDuration,
} from "./lesson-size";

/**
 * العدد بالعربية لا بالرقم ملصوقاً بمفرد.
 *
 * «2 حصة · 3 فترة» صيغةٌ لا يقولها أحد. والعربية أربع حالات لا حالتان:
 * المثنّى بلا رقم، وجمعُ القلّة (3–10) بالجمع، وما فوقها بالمفرد.
 */
export const countLabel = (
  n: number,
  forms: { none: string; one: string; two: string; few: string; many: string },
) =>
  n === 0
    ? forms.none
    : n === 1
      ? forms.one
      : n === 2
        ? forms.two
        : n <= 10
          ? `${n} ${forms.few}`
          : `${n} ${forms.many}`;

