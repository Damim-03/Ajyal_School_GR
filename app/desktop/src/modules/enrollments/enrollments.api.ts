import { apiClient } from "../../core/api/client";

export { listAssignments, fullName } from "../../core/api/reference.api";
export type { Assignment } from "../../core/api/reference.api";
import type { Gender } from "../../core/types";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * إسنادُ الطالب — `StudentEnrollment` في المخطّط.
 *
 * الصفُّ الواحد يربط طالباً بإسنادٍ تدريسي، والإسنادُ التدريسي يحمل
 * أربعتها معاً: المادة والأستاذ والفوج والسنة. فاختيارُ الطالب لمادّةٍ
 * هو في الحقيقة اختيارُ **مَن يدرّسها له وفي أيّ فوج**.
 */
export interface Enrollment {
  id: string;
  studentId: string;
  teachingAssignmentId: string;
  enrolledAt: string;
  isActive: boolean;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    parentPhone: string;
    avatar: string | null;
    gender: Gender;
    note: string | null;
  };
  teachingAssignment: {
    id: string;
    isActive: boolean;
    subject: { id: string; name: string; code: string | null };
    teacher: { id: string; firstName: string; lastName: string };
    studyGroup: {
      id: string;
      name: string;
      type: string;
      maxStudents: number | null;
      level: { id: string; name: string };
    };
    academicYear: { id: string; name: string; isCurrent: boolean };
  };
  /** الفواتير والحضور — وجودُهما يمنع الحذف ويُبقي التعطيل */
  _count?: { invoices: number; attendances: number };
}

export interface EnrollmentQuery {
  page?: number;
  limit?: number;
  studentId?: string;
  teachingAssignmentId?: string;
  subjectId?: string;
  studyGroupId?: string;
  teacherId?: string;
  academicYearId?: string;
  isActive?: boolean;
}

export const listEnrollments = async (query: EnrollmentQuery) => {
  const { data } = await apiClient.get("/enrollments", { params: query });

  return {
    enrollments: data.data as Enrollment[],
    pagination: data.pagination as Pagination,
  };
};

/**
 * إسنادٌ جماعي — مادّةٌ واحدة أو عشر في طلبٍ واحد.
 *
 * ذرّيٌّ في الخادم: إمّا أن تنجح كلُّها أو لا يُكتب شيء. فلا يبقى
 * الطالب مسجَّلاً في نصف ما اختير له لأنّ فوجاً امتلأ في آخر القائمة.
 */
export const createEnrollment = async (body: {
  studentId: string;
  teachingAssignmentIds: string[];
  enrolledAt?: string;
}) => {
  const { data } = await apiClient.post("/enrollments", body);
  return data.data as Enrollment[];
};

export const updateEnrollment = async (
  id: string,
  body: { isActive?: boolean; enrolledAt?: string },
) => {
  const { data } = await apiClient.patch(`/enrollments/${id}`, body);
  return data.data.enrollment as Enrollment;
};

export const deleteEnrollment = async (id: string) => {
  await apiClient.delete(`/enrollments/${id}`);
};

/**
 * النقل من فوج إلى فوج — خطوةٌ واحدة لا خطوتان.
 *
 * لو نُفِّذ من الواجهة بـ«أنشئ ثم عطّل» وسقطت الثانية لبقي الطالب في
 * فوجين معاً، وهو الخلط الذي وُجدت الشاشة لمنعه. فالخادم يفعلها داخل
 * transaction، والقديم يُعطَّل ولا يُحذف لأنّ فواتيره وحضوره معلَّقةٌ به.
 */
export const transferEnrollment = async (
  id: string,
  teachingAssignmentId: string,
) => {
  const { data } = await apiClient.patch(`/enrollments/${id}/transfer`, {
    teachingAssignmentId,
  });

  return data.data as {
    from: { id: string; subject: string; studyGroup: string };
    to: Enrollment;
    /** أُحيي تسجيلٌ معطَّل بدل إنشاء نظيرٍ له */
    revived: boolean;
  };
};

/** «ثانية متوسط · فوج أ» — النسب التي تُميّز الفوج عن شبيهه */
export const groupPath = (enrollment: Enrollment) =>
  `${enrollment.teachingAssignment.studyGroup.level.name} · ${enrollment.teachingAssignment.studyGroup.name}`;
