import { apiClient } from "../../core/api/client";

/**
 * الكشف التقديري للحصص — §16.
 *
 * يُحسب ولا يُحفظ: الإدارة ترى المبلغ قبل أن تلتزم به. وهو نفسه ما
 * سيُخزَّن حرفياً لو ضُغط «احسب التخليص» — لأنّ الطرفين يمرّان على
 * دالّة الجمع نفسها في الخادم، لا على تقديرٍ مشابه.
 */

export type SettlementMethod =
  | "PERCENTAGE"
  | "PER_STUDENT"
  | "PER_SESSION"
  | "PER_ATTENDED_SHARE";

export type CountBasis = "ENROLLED" | "PAID" | "PRESENT";

export interface EstimateRow {
  /** ترتيبها في هذا الكشف — 1..N بالتاريخ، وهو ما يُعرض */
  order: number;
  /** رقمها في الجدول الأسبوعي — مفتاحُها في السجل */
  lessonNumber: number;
  sessionDate: string | null;
  /** من دخل الحساب وفق أساس العدّ */
  countedStudents: number;
  /** من حضر — قبل التصفية. الفرق بينهما هم المستبعَدون */
  presentStudents: number;
  rate: number;
  lineTotal: number;
  /** من حضر ولم يُحتسب لأنّه لم يسدّد */
  outstandingStudents: number;
  /** قيمة خدمتهم بسعر المؤسسة — لا تُجمع مع lineTotal */
  outstandingAmount: number;
}

export interface EstimateStudent {
  studentId: string;
  firstName: string;
  lastName: string;
  parentPhone: string;
  /** الحاضر والمتأخّر معاً — المتأخّر جلس الحصة */
  present: number;
  attended: number;
  late: number;
  absent: number;
  excused: number;
  /** خانات لم تُدوَّن — ليست غياباً */
  blank: number;
  invoice: {
    id: string;
    invoiceNumber: string;
    total: number;
    paid: number;
    remaining: number;
    status: "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
    dueDate: string;
    overdue: boolean;
  } | null;
  /** عليه دَينٌ في هذه المادة لهذه الفترة */
  defaulter: boolean;
  /** لا فاتورة له أصلاً — خللٌ لا حالة */
  uninvoiced: boolean;
}

export interface Estimate {
  header: {
    subject: { id: string; name: string };
    teacher: { id: string; firstName: string; lastName: string };
    studyGroup: { id: string; name: string };
    level: { id: string; name: string };
    educationStage: { id: string; name: string };
    sheet: { id: string; number: number; label: string | null; sessionCount: number };
    dateFrom: string | null;
    dateTo: string | null;
  };
  policy: {
    id: string;
    name: string;
    method: SettlementMethod;
    countBasis: CountBasis;
    roundingMode: string;
    roundingPrecision: number;
    teacherPercentage: number | null;
    amountPerStudent: number | null;
    amountPerSession: number | null;
  };
  tuition: number;
  rows: EstimateRow[];
  students: EstimateStudent[];
  totals: {
    approvedSessions: number;
    completedSessions: number;
    missingSessions: number;
    enrolledStudents: number;
    paidStudents: number;
    unpaidStudents: number;
    defaulters: number;
    uninvoiced: number;
    /** الحضور الخام — كلُّ من حضر */
    attendedUnits: number;
    /** ما دخل الحساب منه وفق أساس العدّ — وهو الذي يفسّر المبلغ */
    countedUnits: number;
    /** حضورُ المخلَّفين — لم يدخل الحساب */
    outstandingUnits: number;
    /** الحقّ الشهري ÷ الحصص المعتمدة */
    institutionSessionRate: number;
    /** قيمة ما قُدِّم ولم يُحصَّل — مستقلٌّ لا يُجمع مع مستحقّ الأستاذ */
    outstandingEstimated: number;
    /** نصيب الأستاذ منها إن حُصِّلت — مؤجَّلٌ لا مدفوع. فارغٌ بلا نسبة */
    outstandingTeacherShare: number | null;
    grossTuition: number;
    collected: number;
    remaining: number;
    teacherAmount: number;
  };
}

export const getEstimate = async (params: {
  teachingAssignmentId: string;
  attendanceSheetId: string;
  policyId?: string;
}) => {
  const { data } = await apiClient.get("/settlements/estimate", { params });
  return data.data as Estimate;
};

export const METHOD_LABEL: Record<SettlementMethod, string> = {
  PERCENTAGE: "نسبة من حقوق الطلبة",
  PER_STUDENT: "مبلغ لكل طالب",
  PER_SESSION: "مبلغ لكل حصة",
  PER_ATTENDED_SHARE: "نصيب من كل حضور",
};

export const BASIS_LABEL: Record<CountBasis, string> = {
  ENROLLED: "المسجَّلون",
  PAID: "الذين دفعوا",
  PRESENT: "الحاضرون",
};

/** وصفُ القيمة المعتمدة في السياسة — تختلف باختلاف الطريقة (§8) */
export const policyValue = (p: Estimate["policy"]) => {
  switch (p.method) {
    case "PER_STUDENT":
      return `${p.amountPerStudent ?? 0} لكل طالب`;
    case "PER_SESSION":
      return `${p.amountPerSession ?? 0} لكل حصة`;
    default:
      return `${p.teacherPercentage ?? 0}%`;
  }
};
