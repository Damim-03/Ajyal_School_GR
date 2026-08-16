import type { Invoice, Payment } from "./finance.api";

/**
 * فاتورة وإيصال تجريبيّان — لتجربة الطباعة قبل وجود بيانات حقيقية.
 *
 * ليست بيانات «لطيفة»: هي مختارة لتكسر ما يُكسَر عادةً على الورق.
 *
 *   • اسم عربي طويل (يكشف القصّ والالتفاف)
 *   • أرقام لاتينية داخل سطر عربي (يكشف اختلال الاتجاه)
 *   • مبلغ بفاصل آلاف (يكشف تحويل المحارف)
 *   • دفعة تغطّي فاتورتين (يكشف انهيار الجدول على 72 مم)
 *   • تخفيض ومتبقٍّ (يكشف اختلال محاذاة العمودين)
 *
 * والورقة تمرّ بنفس مكوّنَي `InvoiceDoc` و`ReceiptDoc` اللذين يطبعان
 * الحقيقي — لا نسخةٍ ثانية منهما. فما يصحّ هنا يصحّ هناك بالضرورة.
 */

const student = {
  id: "sample-student",
  firstName: "أمينة",
  lastName: "شريف بن عبد الله",
  parentPhone: "0770 12 34 56",
};

const assignment = (subject: string) => ({
  subject: { id: `s-${subject}`, name: subject },
  teacher: { id: "t-1", firstName: "علي", lastName: "حبيب" },
  studyGroup: {
    id: "g-1",
    name: "الفوج أ",
    level: {
      id: "l-1",
      name: "أولى متوسط",
      educationStage: { id: "s-1", name: "متوسط" },
    },
  },
});

const enrollment = (subject: string) => ({
  id: `e-${subject}`,
  student,
  teachingAssignment: assignment(subject),
});

export const SAMPLE_INVOICE: Invoice = {
  id: "sample-invoice",
  invoiceNumber: "INV-2026-10-0001",
  /* نموذجُ معاينةٍ بلا كشف — الطباعة لا تعرضه */
  attendanceSheet: null,
  month: 10,
  year: 2026,
  amount: 2500,
  discount: 500,
  total: 2000,
  remaining: 800,
  status: "PARTIAL",
  dueDate: "2026-10-31T00:00:00.000Z",
  note: null,
  studentEnrollment: enrollment("الرياضيات"),
  academicYear: { id: "y-1", name: "2026-2027" },
};

export const SAMPLE_PAYMENT: Payment = {
  id: "sample-payment",
  paymentNumber: "4820193857016",
  amount: 3200,
  paymentMethod: "CASH",
  status: "ACTIVE",
  paymentDate: "2026-10-05T00:00:00.000Z",
  note: null,
  receivedBy: { id: "u-1", username: "admin" },
  receipt: {
    id: "r-1",
    receiptNumber: "7391064825173",
    status: "ACTIVE",
    printed: false,
    printedAt: null,
  },
  paymentInvoices: [
    {
      id: "pi-1",
      paidAmount: 1200,
      invoice: {
        id: "i-1",
        invoiceNumber: "INV-2026-10-0001",
        month: 10,
        year: 2026,
        total: 2000,
        remaining: 800,
        status: "PARTIAL",
        studentEnrollment: {
          student,
          teachingAssignment: { subject: { id: "s-1", name: "الرياضيات" } },
        },
      },
    },
    {
      id: "pi-2",
      paidAmount: 2000,
      invoice: {
        id: "i-2",
        invoiceNumber: "INV-2026-10-0002",
        month: 10,
        year: 2026,
        total: 2000,
        remaining: 0,
        status: "PAID",
        studentEnrollment: {
          student,
          teachingAssignment: { subject: { id: "s-2", name: "العلوم الطبيعية" } },
        },
      },
    },
  ],
};
