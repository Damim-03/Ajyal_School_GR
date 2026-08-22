import { apiClient } from "../../core/api/client";

/**
 * طبقة الأساتذة — إدارية بحتة.
 *
 * المالُ خارجها عمداً: `Teacher.salary` رقمٌ ثابت في الجدول لا سعرَ
 * حصةٍ ولا نسبة، وتخليصُ الأستاذ وحدةٌ مستقلّة لم تُبنَ بعد. فلا تُقحم
 * هذه الشاشة في حسابٍ لا تملك بياناته.
 */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type Gender = "MALE" | "FEMALE";

export interface TeacherRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  gender: Gender;
  birthDate: string | null;
  hireDate: string;
  specialization: string | null;
  qualification: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { teachingAssignments: number };
}

/**
 * الملف يحمل ما لا تحمله القائمة.
 *
 * الراتب أهمّها: الخادم يستثنيه من `teacherListSelect` ويُظهره في
 * التفصيل وحده — فلا يُعرض في جدولٍ يراه كل من يفتح الشاشة.
 */
export interface TeacherDetail extends TeacherRow {
  address: string | null;
  salary: number | null;
  teachingAssignments: {
    id: string;
    isActive: boolean;
    subject: { id: string; name: string };
    studyGroup: { id: string; name: string; level: { id: string; name: string } };
    academicYear: { id: string; name: string; isCurrent: boolean };
  }[];
  _count: { teachingAssignments: number };
}

export interface TeacherQuery {
  page?: number;
  limit?: number;
  search?: string;
  gender?: Gender;
  specialization?: string;
  isActive?: boolean;
}

export interface TeacherBody {
  firstName: string;
  lastName: string;
  gender: Gender;
  hireDate: string;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  address?: string | null;
  qualification?: string | null;
  specialization?: string | null;
  salary?: number | null;
  isActive?: boolean;
}

export const listTeachers = async (query: TeacherQuery) => {
  const { data } = await apiClient.get("/teachers", { params: query });
  return {
    teachers: data.data as TeacherRow[],
    pagination: data.pagination as Pagination,
  };
};

/**
 * كل الأساتذة المطابقين — بكل صفحاتهم.
 *
 * سقفُ الصفحة 100 على الخادم، وقائمةُ اختيارٍ ناقصة أسوأ من طلبٍ ثانٍ:
 * الأستاذ الغائب عنها يبدو غير موجود فيُعاد إنشاؤه بسجلٍّ مكرّر.
 */
export const listAllTeachers = async (query: Omit<TeacherQuery, "page" | "limit"> = {}) => {
  const rows: TeacherRow[] = [];
  let page = 1;

  for (;;) {
    const { teachers, pagination } = await listTeachers({ ...query, page, limit: 100 });
    rows.push(...teachers);

    if (!pagination || page >= pagination.totalPages || pagination.totalPages === 0) break;
    page++;
  }

  return rows;
};

export const getTeacher = async (id: string) => {
  const { data } = await apiClient.get(`/teachers/${id}`);
  return data.data.teacher as TeacherDetail;
};

export const createTeacher = async (body: TeacherBody) => {
  const { data } = await apiClient.post("/teachers", body);
  return data.data.teacher as TeacherDetail;
};

export const updateTeacher = async (id: string, body: Partial<TeacherBody>) => {
  const { data } = await apiClient.patch(`/teachers/${id}`, body);
  return data.data.teacher as TeacherDetail;
};

export const deleteTeacher = async (id: string) => {
  await apiClient.delete(`/teachers/${id}`);
};

// --------------------------------------------------
// الإسناد التدريسي — أستاذ + مادة + فوج + سنة
// --------------------------------------------------

export interface AssignmentRow {
  id: string;
  teacherId: string;
  subjectId: string;
  studyGroupId: string;
  academicYearId: string;
  isActive: boolean;
  teacher: { id: string; firstName: string; lastName: string; isActive: boolean };
  subject: { id: string; name: string; code: string | null };
  studyGroup: {
    id: string;
    name: string;
    type: string;
    level: { id: string; name: string; educationStage: { id: string; name: string } };
  };
  academicYear: { id: string; name: string; isCurrent: boolean };
}

export const listAssignmentsPage = async (query: {
  page?: number;
  limit?: number;
  teacherId?: string;
  subjectId?: string;
  studyGroupId?: string;
  academicYearId?: string;
  isActive?: boolean;
}) => {
  const { data } = await apiClient.get("/teaching-assignments", { params: query });
  return {
    assignments: data.data as AssignmentRow[],
    pagination: data.pagination as Pagination,
  };
};

export const createAssignment = async (body: {
  teacherId: string;
  subjectId: string;
  studyGroupId: string;
  academicYearId: string;
}) => {
  const { data } = await apiClient.post("/teaching-assignments", body);
  return data.data.teachingAssignment as AssignmentRow;
};

export const updateAssignment = async (id: string, body: { isActive: boolean }) => {
  const { data } = await apiClient.patch(`/teaching-assignments/${id}`, body);
  return data.data.teachingAssignment as AssignmentRow;
};

export const deleteAssignment = async (id: string) => {
  await apiClient.delete(`/teaching-assignments/${id}`);
};

// --------------------------------------------------
// ما يحيط بالأستاذ — جدوله وحصصه وطلبته
// --------------------------------------------------

export interface TeacherScheduleRow {
  id: string;
  dayOfWeek: string;
  lessonSlot: { id: string; name: string; order: number; startTime: string; endTime: string };
  classroom: { id: string; name: string } | null;
  teachingAssignment: {
    id: string;
    subject: { id: string; name: string };
    studyGroup: { id: string; name: string; level: { id: string; name: string } };
  };
}

export const listTeacherSchedules = async (teacherId: string, academicYearId?: string) => {
  const { data } = await apiClient.get("/schedules", {
    params: { teacherId, ...(academicYearId && { academicYearId }), limit: 100 },
  });
  return data.data as TeacherScheduleRow[];
};

export interface TeacherSessionRow {
  id: string;
  sessionDate: string;
  lessonNumber: number;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  schedule: {
    dayOfWeek: string;
    lessonSlot: { name: string; startTime: string; endTime: string };
    classroom: { id: string; name: string } | null;
    teachingAssignment: {
      subject: { id: string; name: string };
      studyGroup: { id: string; name: string; level: { id: string; name: string } };
    };
  };
}

export const listTeacherSessions = async (params: {
  teacherId: string;
  academicYearId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}) => {
  const { data } = await apiClient.get("/sessions", {
    params: { ...params, limit: params.limit ?? 50 },
  });
  return {
    sessions: data.data as TeacherSessionRow[],
    pagination: data.pagination as Pagination,
  };
};

/** عدد المسجَّلين في كل إسناد — يُعدّ من التسجيلات لا يُخزَّن */
export const countTeacherStudents = async (teacherId: string, academicYearId?: string) => {
  const { data } = await apiClient.get("/enrollments", {
    params: {
      teacherId,
      isActive: "true",
      ...(academicYearId && { academicYearId }),
      limit: 100,
    },
  });

  const rows = data.data as { teachingAssignmentId: string; studentId: string }[];
  const byAssignment = new Map<string, Set<string>>();

  for (const row of rows) {
    const set = byAssignment.get(row.teachingAssignmentId) ?? new Set<string>();
    set.add(row.studentId);
    byAssignment.set(row.teachingAssignmentId, set);
  }

  return {
    byAssignment: new Map([...byAssignment].map(([k, v]) => [k, v.size])),
    distinctStudents: new Set(rows.map((r) => r.studentId)).size,
    total: data.pagination.total as number,
  };
};

// --------------------------------------------------
// أدوات العرض
// --------------------------------------------------

export const GENDER_LABEL: Record<Gender, string> = {
  MALE: "ذكر",
  FEMALE: "أنثى",
};

/** 2026-09-03T00:00:00Z → 03/09/2026 */
export const dmy = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

/** سنوات الخدمة من تاريخ التوظيف — تُحسب ولا تُخزَّن */
export const yearsOfService = (hireDate: string) => {
  const years = (Date.now() - new Date(hireDate).getTime()) / (365.25 * 24 * 3600 * 1000);
  return Math.max(0, Math.floor(years));
};

// --------------------------------------------------
// كشف حساب الأستاذ
// --------------------------------------------------

/**
 * سطرٌ لكلّ (إسناد × كشف شهر) — لا لكلّ شهر.
 *
 * أستاذُ فوجين له سطران في الشهر الواحد بمستحقّين، وجمعُهما يُخفي
 * أيَّ الفوجين لم يُخلَّص.
 */
export interface TeacherStatementRow {
  sheetId: string;
  sheetCode: string;
  sheetNumber: number;
  sheetLabel: string | null;
  month: number | null;
  year: number | null;
  firstSession: string | null;
  subject: { id: string; name: string };
  studyGroup: { id: string; name: string };
  completedSessions: number;
  sessions: number;
  settlement: {
    id: string;
    settlementNumber: string;
    status: "DRAFT" | "CONFIRMED" | "PAID" | "CANCELLED";
    teacherAmount: number;
    students: number;
    paidStudents: number;
    completedSessions: number;
    approvedSessions: number;
    confirmedAt: string | null;
    paidAt: string | null;
  } | null;
  payment: {
    id: string;
    paymentNumber: string;
    paymentDate: string;
    amount: number;
  } | null;
}

export interface TeacherStatementShare {
  id: string;
  shareAmount: number;
  collectedAmount: number;
  attendedUnits: number | null;
  status: "PENDING" | "APPROVED" | "PAID" | "CANCELLED";
  paidAt: string | null;
  createdAt: string;
  debtCollection: {
    originalMonth: number;
    originalYear: number;
    collectedAt: string;
    payment: { paymentNumber: string; paymentDate: string };
    invoice: {
      studentEnrollment: {
        student: { id: string; firstName: string; lastName: string };
      };
    };
  };
  originalSettlement: {
    id: string;
    settlementNumber: string;
    attendanceSheet: { id: string; code: string; number: number; label: string | null };
    teachingAssignment: {
      subject: { id: string; name: string };
      studyGroup: { id: string; name: string };
    };
  } | null;
  collectionSettlement: { id: string; settlementNumber: string } | null;
  /** الدفعةُ التي قبض بها نصيبَه — أو `null` إن لم تُدفع بعد */
  teacherPayment: {
    id: string;
    paymentNumber: string;
    paymentDate: string;
    amount: number;
  } | null;
}

export interface TeacherStatement {
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    specialization: string | null;
    hireDate: string;
  };
  academicYear: { id: string; name: string; startDate: string; endDate: string };
  rows: TeacherStatementRow[];
  arrears: TeacherStatementShare[];
  totals: {
    sheets: number;
    settled: number;
    completedSessions: number;
    due: number;
    paid: number;
    unpaid: number;
    arrearsPaid: number;
    arrearsPending: number;
    grandDue: number;
    grandPaid: number;
    grandUnpaid: number;
  };
}

export const getTeacherStatement = async (
  teacherId: string,
  academicYearId: string,
) => {
  const { data } = await apiClient.get(`/teachers/${teacherId}/statement`, {
    params: { academicYearId },
  });

  return data.data as TeacherStatement;
};
