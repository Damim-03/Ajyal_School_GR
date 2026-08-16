import { apiClient } from "../../core/api/client";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// --------------------------------------------------
// الفواتير
// --------------------------------------------------

export type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  month: number;
  year: number;
  amount: number;
  discount: number;
  total: number;
  remaining: number;
  status: InvoiceStatus;
  dueDate: string;
  note: string | null;
  studentEnrollment: {
    id: string;
    student: { id: string; firstName: string; lastName: string; parentPhone: string };
    teachingAssignment: {
      subject: { id: string; name: string };
      teacher: { id: string; firstName: string; lastName: string };
      studyGroup: {
        id: string;
        name: string;
        level: {
          id: string;
          name: string;
          educationStage: { id: string; name: string };
        };
      };
    };
  };
  academicYear: { id: string; name: string };
  /** الكشف الذي وُلّدت عنه — فارغٌ حين لا يُحدَّد بلا لبس */
  attendanceSheet: { id: string; number: number; label: string | null } | null;
  paymentInvoices?: {
    id: string;
    paidAmount: number;
    payment: { id: string; paymentNumber: string; paymentMethod: string; paymentDate: string; status: string };
  }[];
}

export interface InvoiceQuery {
  page?: number;
  limit?: number;
  search?: string;
  studentId?: string;
  academicYearId?: string;
  studyGroupId?: string;
  subjectId?: string;
  status?: InvoiceStatus;
  month?: number;
  year?: number;
  overdue?: boolean;
}

export const listInvoices = async (query: InvoiceQuery) => {
  const { data } = await apiClient.get("/invoices", { params: query });
  return { invoices: data.data as Invoice[], pagination: data.pagination as Pagination };
};

export const getInvoice = async (id: string) => {
  const { data } = await apiClient.get(`/invoices/${id}`);
  return data.data.invoice as Invoice;
};

export const generateInvoices = async (body: {
  academicYearId: string;
  month: number;
  year: number;
  dueDate?: string;
  studyGroupIds?: string[];
}) => {
  const { data } = await apiClient.post("/invoices/generate", body);
  return data.data as {
    invoices: Invoice[];
    created: number;
    skippedExisting: number;
    skippedNoFee: { student: string; subject: string; studyGroup: string }[];
    /** سببُ عدم التوليد لكل (مادة + فوج) — لا لكل طالب */
    feeDiagnoses?: {
      subject: string;
      studyGroup: string;
      students: number;
      reason: string;
    }[];
  };
};

export const updateInvoice = async (
  id: string,
  body: { amount?: number; discount?: number; dueDate?: string; note?: string | null },
) => {
  const { data } = await apiClient.patch(`/invoices/${id}`, body);
  return data.data.invoice as Invoice;
};

export const cancelInvoice = async (id: string) => {
  const { data } = await apiClient.post(`/invoices/${id}/cancel`);
  return data.data.invoice as Invoice;
};

// --------------------------------------------------
// المدفوعات
// --------------------------------------------------

export type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER";

export interface Payment {
  id: string;
  paymentNumber: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: "ACTIVE" | "CANCELLED";
  paymentDate: string;
  note: string | null;
  receivedBy: { id: string; username: string } | null;
  receipt: {
    id: string;
    receiptNumber: string;
    status: string;
    printed: boolean;
    printedAt: string | null;
  } | null;
  paymentInvoices: {
    id: string;
    paidAmount: number;
    invoice: {
      id: string;
      invoiceNumber: string;
      month: number;
      year: number;
      total: number;
      remaining: number;
      status: InvoiceStatus;
      studentEnrollment: {
        student: { id: string; firstName: string; lastName: string };
        teachingAssignment: { subject: { id: string; name: string } };
      };
    };
  }[];
}

export const listPayments = async (query: {
  page?: number;
  limit?: number;
  search?: string;
  studentId?: string;
  paymentMethod?: PaymentMethod;
  status?: "ACTIVE" | "CANCELLED";
  dateFrom?: string;
  dateTo?: string;
}) => {
  const { data } = await apiClient.get("/payments", { params: query });
  return { payments: data.data as Payment[], pagination: data.pagination as Pagination };
};

export const getPayment = async (id: string) => {
  const { data } = await apiClient.get(`/payments/${id}`);
  return data.data.payment as Payment;
};

export const createPayment = async (body: {
  allocations: { invoiceId: string; paidAmount: number }[];
  paymentMethod?: PaymentMethod;
  paymentDate?: string;
  note?: string | null;
}) => {
  const { data } = await apiClient.post("/payments", body);
  return data.data.payment as Payment;
};

export const cancelPayment = async (id: string, reason?: string) => {
  const { data } = await apiClient.post(`/payments/${id}/cancel`, { reason });
  return data.data.payment as Payment;
};

// --------------------------------------------------
// الإيصالات
// --------------------------------------------------

export const markReceiptPrinted = async (id: string, reprint: boolean) => {
  const { data } = await apiClient.post(
    `/receipts/${id}/${reprint ? "reprint" : "print"}`,
  );
  return data.data.receipt;
};

// --------------------------------------------------
// أدوات العرض
// --------------------------------------------------

/**
 * المبلغ كما يُكتب في كل الشاشات — «1500.00 دج».
 *
 * كان هنا تدويرٌ إلى عددٍ صحيح، والعمود في القاعدة `Decimal(10,2)`:
 * فسعرُ 1500.50 يُعرض «1 501 دج» ويُطبع في الإيصال كذلك، والفرقُ
 * يتراكم بلا تفسير. والكتابة الآن في `core/utils/money` وحدها.
 */
export { formatMoney as money } from "../../core/utils/money";

export const MONTHS = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export const INVOICE_TONE: Record<InvoiceStatus, { bg: string; fg: string; label: string }> = {
  PAID: { bg: "rgba(134,239,172,0.14)", fg: "#86efac", label: "مسدَّدة" },
  PARTIAL: { bg: "rgba(252,211,77,0.14)", fg: "#fcd34d", label: "جزئية" },
  PENDING: { bg: "rgba(255,255,255,0.08)", fg: "rgba(255,255,255,0.6)", label: "معلّقة" },
  CANCELLED: { bg: "rgba(255,255,255,0.05)", fg: "rgba(255,255,255,0.35)", label: "ملغاة" },
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "نقداً",
  CARD: "بطاقة",
  BANK_TRANSFER: "تحويل بنكي",
};
