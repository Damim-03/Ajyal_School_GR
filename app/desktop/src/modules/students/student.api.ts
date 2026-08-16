import { apiClient } from "../../core/api/client";

/**
 * واجهة الطلبة — مطابقة لما يقبله الخادم حرفياً.
 *
 * الفلاتر هنا هي الفلاتر الموجودة في `studentQuerySchema` وحدها.
 * لا فلتر بالفوج بعد: الطالب لا يرتبط بفوج مباشرة في المخطّط، والربط
 * يمرّ عبر التسجيل — فإضافته تحتاج تعديل الخادم لا الواجهة.
 */

export type Gender = "MALE" | "FEMALE";

export interface Student {
  id: string;
  /** رقم المؤسسة — «2026000147». هو ما تحمله البطاقة ويشفّره باركودها */
  studentNumber: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate: string | null;
  avatar: string | null;
  phone: string | null;
  parentPhone: string;
  address: string | null;
  schoolName: string | null;
  emergencyPhone: string | null;
  registrationDate: string;
  note: string | null;
  isActive: boolean;
  _count?: { enrollments: number };
  /** أنواع الوثائق الموجودة — يحسب منها الاكتمال بلا طلب لكل طالب */
  documentTypes?: string[];
  completeness?: Completeness;
}

export interface Completeness {
  required: number;
  presentRequired: number;
  missing: string[];
  isComplete: boolean;
}

export interface StudentQuery {
  page?: number;
  limit?: number;
  search?: string;
  gender?: Gender;
  isActive?: boolean;
  /* الفلاتر التي تمرّ عبر التسجيل */
  subjectId?: string;
  studyGroupId?: string;
  levelId?: string;
  academicYearId?: string;
  teacherId?: string;
  documentsComplete?: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StudentInput {
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate?: string | null;
  avatar?: string | null;
  phone?: string | null;
  parentPhone: string;
  address?: string | null;
  schoolName?: string | null;
  emergencyPhone?: string | null;
  registrationDate?: string;
  note?: string | null;
  isActive?: boolean;
}

export const listStudents = async (query: StudentQuery) => {
  const { data } = await apiClient.get("/students", { params: query });

  return {
    students: data.data as Student[],
    pagination: data.pagination as Pagination,
  };
};

export const getStudent = async (id: string) => {
  const { data } = await apiClient.get(`/students/${id}`);
  return data.data.student as Student;
};

export const createStudent = async (body: StudentInput) => {
  const { data } = await apiClient.post("/students", body);
  return data.data.student as Student;
};

export const updateStudent = async (id: string, body: Partial<StudentInput>) => {
  const { data } = await apiClient.patch(`/students/${id}`, body);
  return data.data.student as Student;
};

export const deleteStudent = async (id: string) => {
  await apiClient.delete(`/students/${id}`);
};

/** رفع ملف → المسار الذي يُحفظ في avatar أو في وثيقة */
export const uploadImage = async (file: File): Promise<string> => {
  const form = new FormData();
  form.append("file", file);

  const { data } = await apiClient.post("/uploads", form);

  return data.data.path as string;
};

// --------------------------------------------------
// أقسام شاشة التفصيل
//
// كلٌّ من نقطة نهاية مختلفة وبصلاحية مختلفة، لذلك تُجلب على حدة
// ويُخفى القسم كاملاً لمن لا يملك صلاحيته — لا يُعرض فارغاً.
// --------------------------------------------------

export interface Enrollment {
  id: string;
  enrolledAt: string;
  isActive: boolean;
  teachingAssignment: {
    id: string;
    isActive: boolean;
    subject: { id: string; name: string; code: string | null };
    teacher: { id: string; firstName: string; lastName: string };
    studyGroup: {
      id: string;
      name: string;
      type: string;
      level: {
        id: string;
        name: string;
        /** الطور — تعرضه البطاقة تحت المستوى */
        educationStage: { id: string; name: string; type: string };
      };
    };
    academicYear: { id: string; name: string; isCurrent: boolean };
  };
  _count: { invoices: number; attendances: number };
}

export const getStudentEnrollments = async (
  studentId: string,
  params?: { isActive?: boolean; academicYearId?: string },
) => {
  const { data } = await apiClient.get(`/students/${studentId}/enrollments`, {
    params,
  });
  return data.data.enrollments as Enrollment[];
};

export interface StudentInvoice {
  id: string;
  invoiceNumber: string;
  month: number;
  year: number;
  amount: number;
  discount: number;
  total: number;
  remaining: number;
  status: "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
  dueDate: string;
  studentEnrollment: {
    teachingAssignment: { subject: { id: string; name: string } };
  };
}

export const listStudentInvoices = async (studentId: string) => {
  const { data } = await apiClient.get("/invoices", {
    params: { studentId, limit: 100 },
  });
  return {
    invoices: data.data as StudentInvoice[],
    pagination: data.pagination as Pagination,
  };
};

export interface AttendanceRow {
  id: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  note: string | null;
  session: {
    id: string;
    sessionDate: string;
    lessonNumber: number;
    schedule: {
      teachingAssignment: { subject: { id: string; name: string } };
    };
  };
}

export const listStudentAttendance = async (studentId: string) => {
  const { data } = await apiClient.get("/attendance", {
    params: { studentId, limit: 100 },
  });
  return {
    rows: data.data as AttendanceRow[],
    pagination: data.pagination as Pagination,
  };
};

export interface AttendanceSummary {
  counts: { PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number };
  total: number;
  attendanceRate: number;
  absenceRate: number;
}

export const getAttendanceSummary = async (studentId: string) => {
  const { data } = await apiClient.get("/reports/attendance", {
    params: { studentId },
  });
  return data.data as AttendanceSummary;
};

// --------------------------------------------------
// وثائق ملف الطالب
// --------------------------------------------------

export interface DocumentType {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
}

export interface StudentDocument {
  id: string;
  type: string;
  filePath: string;
  fileName: string | null;
  note: string | null;
  createdAt: string;
  uploadedBy: { id: string; username: string } | null;
}

export interface CatalogueEntry extends DocumentType {
  document: StudentDocument | null;
}

export interface StudentFile {
  catalogue: CatalogueEntry[];
  completeness: Completeness;
}

export const getDocumentTypes = async () => {
  const { data } = await apiClient.get("/students/document-types");
  return data.data.types as DocumentType[];
};

export const getStudentFile = async (studentId: string) => {
  const { data } = await apiClient.get(`/students/${studentId}/documents`);
  return data.data as StudentFile;
};

export const putStudentDocument = async (
  studentId: string,
  type: string,
  body: { filePath: string; fileName?: string | null },
) => {
  const { data } = await apiClient.put(
    `/students/${studentId}/documents/${type}`,
    body,
  );
  return data.data as StudentFile;
};

export const deleteStudentDocument = async (studentId: string, type: string) => {
  const { data } = await apiClient.delete(
    `/students/${studentId}/documents/${type}`,
  );
  return data.data as StudentFile;
};
