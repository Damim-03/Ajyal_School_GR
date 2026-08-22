/**
 * التخليص المحفوظ ودفعُ الأستاذ — طبقةُ الأرشيف.
 *
 * الكشف التقديري (`settlements.api`) **يُحسب ولا يُحفظ**: الإدارة ترى
 * المبلغ قبل أن تلتزم به. وهنا الطرف الآخر: ما التُزم به وحُفظ.
 *
 *   احسب (compute) → أكّد (confirm) → ادفع (teacher-payments)
 *
 * والدفعة تجمع تخليصات الأستاذ كلَّها: التخليص واحدٌ لكل مادةٍ وفوج،
 * والأستاذ يدرّس عدّة أفواج — فيُدفع له مرّةً بورقةٍ واحدة، وتُوزَّع
 * على تخليصاتها في الخادم.
 */

import { apiClient } from "../../core/api/client";

export type SettlementStatus = "DRAFT" | "CONFIRMED" | "PAID" | "CANCELLED";

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  DRAFT: "مسوّدة",
  CONFIRMED: "مؤكَّد — بانتظار الدفع",
  PAID: "مدفوع",
  CANCELLED: "ملغى",
};

export const SETTLEMENT_STATUS_TONE: Record<SettlementStatus, { bg: string; fg: string }> = {
  DRAFT: { bg: "rgba(148,163,184,0.14)", fg: "#cbd5e1" },
  CONFIRMED: { bg: "rgba(252,211,77,0.14)", fg: "#fcd34d" },
  PAID: { bg: "rgba(134,239,172,0.14)", fg: "#86efac" },
  CANCELLED: { bg: "rgba(253,164,175,0.12)", fg: "#fda4af" },
};

export interface SettlementRow {
  id: string;
  settlementNumber: string;
  revision: number;
  teachingAssignmentId: string;
  attendanceSheetId: string;
  academicYearId: string;
  teacherId: string;
  teacherAmount: number;
  status: SettlementStatus;
  computedAt: string;
  confirmedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  note: string | null;
  approvedSessionsSnapshot: number;
  completedSessionsSnapshot: number;
  studentCountSnapshot: number;
  paidStudentCountSnapshot: number;
  attendedUnitsSnapshot: number;
  tuitionSnapshot: number;
  grossTuitionSnapshot: number;
  collectedSnapshot: number;
  remainingSnapshot: number;
  teacher: { id: string; firstName: string; lastName: string };
  academicYear: { id: string; name: string };
  policy: { id: string; name: string; method: string };
  attendanceSheet: {
    id: string;
    number: number;
    label: string | null;
    sessionCount: number;
  };
  teachingAssignment: {
    id: string;
    subject: { id: string; name: string };
    studyGroup: { id: string; name: string; level: { id: string; name: string } };
  };
}

/** المستخدم كما تُرجعه الاختيارات — `User` لا يملك `fullName` */
export interface UserRef {
  id: string;
  firstName: string;
  lastName: string;
}

/** وجهُ الورقة — الخلفيّ اختياريٌّ لأنّ الورقة قد تكون من وجهٍ واحد */


export interface SettlementDocument {
  id: string;
  filePath: string;
  fileName: string | null;
  /** فارغٌ للأوراق الملحقة قبل اعتماد الوجهين */
  /** رقمُ الصفحة في الورقة الموقَّعة — واحدٌ فما فوق */
  pageNumber: number;
  note: string | null;
  createdAt: string;
  uploadedBy: UserRef | null;
}

/** اللقطة المجمَّدة — الكشفان كما وُقّع عليهما */
export interface SettlementSnapshot {
  id: string;
  createdAt: string;
  dailySheet: unknown;
  monthlyFees: unknown;
}

export interface SettlementDetail extends SettlementRow {
  lines: {
    id: string;
    lessonNumber: number;
    sessionDate: string | null;
    countedStudents: number;
    rate: number;
    lineTotal: number;
  }[];
  documents: SettlementDocument[];
  snapshot: SettlementSnapshot | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// --------------------------------------------------
// التخليص
// --------------------------------------------------

export const listSettlements = async (params: {
  teacherId?: string;
  academicYearId?: string;
  teachingAssignmentId?: string;
  attendanceSheetId?: string;
  status?: SettlementStatus;
  page?: number;
  limit?: number;
}) => {
  const { data } = await apiClient.get("/settlements", {
    params: { limit: 100, ...params },
  });

  return {
    settlements: data.data as SettlementRow[],
    pagination: data.pagination as Pagination | undefined,
  };
};

export const getSettlement = async (id: string) => {
  const { data } = await apiClient.get(`/settlements/${id}`);
  return data.data.settlement as SettlementDetail;
};

/** يُنشئ التخليص أو يُعيد حساب مسوّدته — لا يُنشئ ثانياً لنفس الكشف */
export const computeSettlement = async (body: {
  teachingAssignmentId: string;
  attendanceSheetId: string;
  policyId?: string;
  note?: string | null;
}) => {
  const { data } = await apiClient.post("/settlements/compute", body);
  return data.data.settlement as SettlementRow;
};

/** التجميد — بعده لا إعادة حساب، وبه يصير قابلاً للدفع */
export const confirmSettlement = async (id: string, note?: string | null) => {
  const { data } = await apiClient.patch(`/settlements/${id}/confirm`, {
    ...(note ? { note } : {}),
  });
  return data.data.settlement as SettlementRow;
};

export const attachSettlementDocument = async (
  id: string,
  body: {
    filePath: string;
    fileName?: string | null;
    /** فارغُه يعني «أضِف صفحةً تالية» — والخادم يحسبها */
    pageNumber?: number | null;
    note?: string | null;
  },
) => {
  const { data } = await apiClient.post(`/settlements/${id}/documents`, body);
  return data.data.document as SettlementDocument;
};

export const removeSettlementDocument = async (documentId: string) => {
  await apiClient.delete(`/settlements/documents/${documentId}`);
};

// --------------------------------------------------
// دفعُ الأستاذ
// --------------------------------------------------

export type TeacherPaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER";

export const TEACHER_PAYMENT_METHOD_LABEL: Record<TeacherPaymentMethod, string> = {
  CASH: "نقداً",
  CARD: "بطاقة",
  BANK_TRANSFER: "تحويل بنكي",
};

export interface TeacherPayment {
  id: string;
  paymentNumber: string;
  teacherId: string;
  amount: number;
  paymentMethod: TeacherPaymentMethod;
  paymentDate: string;
  reference: string | null;
  note: string | null;
  status: "ACTIVE" | "CANCELLED";
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  teacher: { id: string; firstName: string; lastName: string; phone: string | null };
  paidBy: UserRef | null;
  cancelledBy: UserRef | null;
  allocations: {
    id: string;
    amount: number;
    /** أحدهما لا كلاهما: تخليصُ فترة أو حصةُ دَين */
    teacherDebtShare: {
      id: string;
      shareAmount: number;
      collectedAmount: number;
      attendedUnits: number | null;
      debtCollection: {
        originalMonth: number;
        originalYear: number;
        collectedAt: string;
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
          id: string;
          subject: { id: string; name: string };
          studyGroup: { id: string; name: string };
        };
      } | null;
    } | null;
    settlement: {
      id: string;
      settlementNumber: string;
      teacherAmount: number;
      status: SettlementStatus;
      attendanceSheet: { id: string; code: string; number: number; label: string | null };
      teachingAssignment: {
        id: string;
        subject: { id: string; name: string };
        studyGroup: { id: string; name: string; level: { id: string; name: string } };
      };
    } | null;
  }[];
}

// --------------------------------------------------
// حصصُ الديون المحصَّلة متأخّراً
// --------------------------------------------------

export type DebtShareStatus = "PENDING" | "APPROVED" | "PAID" | "CANCELLED";

/**
 * حصةُ الأستاذ من دَينٍ سُدِّد بعد تخليصه.
 *
 * المال المحصَّل متأخّراً لا يُعدّل الماضي: تخليصُ الشهر الأوّل يبقى
 * كما وُقّع عليه، وحصةُ الدَّين واقعةٌ جديدة تُنسب إلى أصلها وتُدفع
 * مدموجةً في الراتب التالي.
 */
export interface DebtShare {
  id: string;
  teacherId: string;
  basisSnapshot: "ATTENDED_UNITS" | "COLLECTED_AMOUNT";
  percentageSnapshot: number;
  unitRateSnapshot: number | null;
  attendedUnits: number | null;
  collectedAmount: number;
  shareAmount: number;
  status: DebtShareStatus;
  paidAt: string | null;
  createdAt: string;
  teacher: { id: string; firstName: string; lastName: string };
  debtCollection: {
    id: string;
    collectedAmount: number;
    originalMonth: number;
    originalYear: number;
    collectedAt: string;
    invoice: {
      id: string;
      invoiceNumber: string;
      studentEnrollment: {
        id: string;
        student: { id: string; firstName: string; lastName: string };
      };
    };
    payment: { id: string; paymentNumber: string; paymentDate: string };
  };
  /** الكشف الذي نشأ فيه الدَّين — بمادّته وفوجه ورمز ورقته */
  originalSettlement: {
    id: string;
    settlementNumber: string;
    attendanceSheet: { id: string; code: string; number: number; label: string | null };
    teachingAssignment: {
      id: string;
      subject: { id: string; name: string };
      studyGroup: { id: string; name: string };
    };
  } | null;
  collectionSettlement: { id: string; settlementNumber: string } | null;
}

export const listDebtShares = async (params: {
  teacherId?: string;
  /** الإسناد الذي نشأ فيه الدَّين — مادةٌ وفوجٌ وأستاذ */
  teachingAssignmentId?: string;
  /** التخليص الذي حملها في راتبه — «ما دُفع مع هذا الكشف» */
  collectionSettlementId?: string;
  academicYearId?: string;
  status?: DebtShareStatus;
  page?: number;
  limit?: number;
}) => {
  const { data } = await apiClient.get("/teacher-debt-shares", {
    params: { limit: 100, ...params },
  });

  return {
    shares: data.data as DebtShare[],
    pagination: data.pagination as Pagination | undefined,
  };
};

export const cancelDebtShare = async (id: string, reason: string) => {
  const { data } = await apiClient.patch(`/teacher-debt-shares/${id}/cancel`, { reason });
  return data.data.share as DebtShare;
};

export const payTeacher = async (body: {
  teacherId: string;
  settlementIds: string[];
  /** حصصُ ديونٍ محصَّلة تُدمج في الدفعة نفسها */
  debtShareIds?: string[];
  paymentMethod?: TeacherPaymentMethod;
  paymentDate?: string;
  reference?: string | null;
  note?: string | null;
}) => {
  const { data } = await apiClient.post("/teacher-payments", body);
  return data.data.payment as TeacherPayment;
};

export const listTeacherPayments = async (params: {
  teacherId?: string;
  academicYearId?: string;
  status?: "ACTIVE" | "CANCELLED";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) => {
  const { data } = await apiClient.get("/teacher-payments", {
    params: { limit: 50, ...params },
  });

  return {
    payments: data.data as TeacherPayment[],
    pagination: data.pagination as Pagination | undefined,
  };
};

export const getTeacherPayment = async (id: string) => {
  const { data } = await apiClient.get(`/teacher-payments/${id}`);
  return data.data.payment as TeacherPayment;
};

export const cancelTeacherPayment = async (id: string, reason: string) => {
  const { data } = await apiClient.patch(`/teacher-payments/${id}/cancel`, { reason });
  return data.data.payment as TeacherPayment;
};
