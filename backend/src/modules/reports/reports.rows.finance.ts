import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  activeDebtCollection,
  debtAgeBucket,
  debtAgeInMonths,
  toNumber,
  type YearMonth,
} from "../../core/reporting";
import type { ReportQuery } from "./reports.filters";
import { invoiceScope, oldDebtScope, paymentScope, resolvePeriod } from "./reports.scope";
import { skipTake, type ResolvedSort, type TableRequest } from "./reports.table";

// ======================================================
// صفوفُ التقارير المالية — §22 §23 §24 §25 §26
//
// كلُّها تتبع نفس النمط: عدٌّ وصفحةٌ في معاملةٍ واحدة، ثمّ إغناءٌ
// بتجميعاتٍ مقيَّدةٍ بمعرّفات الصفحة. لا استعلامَ داخل حلقة.
// ======================================================

// --------------------------------------------------
// الفواتير — §22
// --------------------------------------------------

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  studentName: string;
  subject: string;
  studyGroup: string;
  month: number;
  year: number;
  amount: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
  status: string;
  dueDate: string;
};

export const fetchInvoiceRows = async (
  query: Partial<ReportQuery>,
  request: TableRequest,
  sort: ResolvedSort,
): Promise<{ rows: InvoiceRow[]; total: number }> => {
  /*
   * `includeCancelled` هنا لأنّ شاشة الفواتير تعرض الحالات كلَّها.
   *
   * وليس هذا خرقاً لـ§52: القاعدةُ أنّ الملغى لا يدخل **المجاميع
   * المالية** — والمجاميعُ تُحسب في `assemble` من استعلامٍ آخر
   * يستثنيه. أمّا الجدولُ فسجلٌّ يُقرأ، وإخفاءُ الملغى منه يمنع
   * الإدارةَ من مراجعة ما أُلغي.
   */
  const where = invoiceScope(query, { includeCancelled: true });

  const [total, invoices] = await prisma.$transaction([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      ...skipTake(request),
      orderBy: sort.orderBy as Prisma.InvoiceOrderByWithRelationInput,
      select: {
        id: true,
        invoiceNumber: true,
        month: true,
        year: true,
        amount: true,
        discount: true,
        total: true,
        remaining: true,
        status: true,
        dueDate: true,
        studentEnrollment: {
          select: {
            student: { select: { firstName: true, lastName: true } },
            teachingAssignment: {
              select: {
                subject: { select: { name: true } },
                studyGroup: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const rows: InvoiceRow[] = invoices.map((invoice) => {
    const enrollment = invoice.studentEnrollment;
    const totalValue = toNumber(invoice.total);
    const remaining = toNumber(invoice.remaining);

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      studentName:
        `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
      subject: enrollment.teachingAssignment.subject.name,
      studyGroup: enrollment.teachingAssignment.studyGroup.name,
      month: invoice.month,
      year: invoice.year,
      amount: toNumber(invoice.amount),
      discount: toNumber(invoice.discount),
      total: totalValue,
      /* المسدَّد مشتقٌّ لا مخزَّن — الفاتورة تحمل الإجمالي والمتبقّي */
      paid: totalValue - remaining,
      remaining,
      status: invoice.status,
      dueDate: invoice.dueDate.toISOString(),
    };
  });

  return { rows, total };
};

// --------------------------------------------------
// الدفعات — §23
// --------------------------------------------------

export type PaymentRow = {
  id: string;
  paymentNumber: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  receivedBy: string | null;
  receiptNumber: string | null;
  receiptStatus: string | null;
  /** الفواتير التي سدّدتها هذه الدفعة — §23 */
  invoiceCount: number;
  students: string;
};

export const fetchPaymentRows = async (
  query: Partial<ReportQuery>,
  request: TableRequest,
  sort: ResolvedSort,
): Promise<{ rows: PaymentRow[]; total: number }> => {
  const where = paymentScope(query, { includeCancelled: true });

  const [total, payments] = await prisma.$transaction([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      ...skipTake(request),
      orderBy: sort.orderBy as Prisma.PaymentOrderByWithRelationInput,
      select: {
        id: true,
        paymentNumber: true,
        amount: true,
        paymentMethod: true,
        paymentDate: true,
        status: true,
        receivedBy: { select: { firstName: true, lastName: true } },
        receipt: { select: { receiptNumber: true, status: true } },
        paymentInvoices: {
          select: {
            invoice: {
              select: {
                studentEnrollment: {
                  select: {
                    student: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const rows: PaymentRow[] = payments.map((payment) => {
    /*
     * الدفعةُ قد تسدّد فواتيرَ عدّة موادّ لطالبٍ واحد، وقد تسدّد
     * لأكثرَ من طالب. فالأسماءُ تُجمَّع بلا تكرار — وعرضُ الاسم
     * مكرّراً ثلاثاً يوحي بثلاثة أشخاص.
     */
    const names = new Set(
      payment.paymentInvoices.map((link) =>
        `${link.invoice.studentEnrollment.student.firstName} ${link.invoice.studentEnrollment.student.lastName}`.trim(),
      ),
    );

    return {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      amount: toNumber(payment.amount),
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate.toISOString(),
      status: payment.status,
      receivedBy: payment.receivedBy
        ? `${payment.receivedBy.firstName} ${payment.receivedBy.lastName}`.trim()
        : null,
      receiptNumber: payment.receipt?.receiptNumber ?? null,
      receiptStatus: payment.receipt?.status ?? null,
      invoiceCount: payment.paymentInvoices.length,
      students: [...names].join("، "),
    };
  });

  return { rows, total };
};

// --------------------------------------------------
// الإيصالات — §24
// --------------------------------------------------

export type ReceiptRow = {
  id: string;
  receiptNumber: string;
  paymentNumber: string;
  studentName: string;
  amount: number;
  status: string;
  printed: boolean;
  printedAt: string | null;
  printedBy: string | null;
  cancelledAt: string | null;
};

export const fetchReceiptRows = async (
  query: Partial<ReportQuery>,
  request: TableRequest,
  sort: ResolvedSort,
): Promise<{ rows: ReceiptRow[]; total: number }> => {
  const { range } = resolvePeriod(query);

  /*
   * الإيصالُ لا يحمل تاريخَ عملية؛ يحمل `createdAt` وحدها. فيُفلتر
   * بتاريخ **دفعته** — والإيصالُ يُصدَر عن دفعةٍ فيتبعها زمنياً.
   *
   * §24: الملغاةُ تبقى في التقرير. لا تُحذف من التدقيق.
   */
  const where: Prisma.ReceiptWhereInput = {
    ...(range
      ? { payment: { paymentDate: { gte: range.from, lte: range.to } } }
      : {}),
  };

  const [total, receipts] = await prisma.$transaction([
    prisma.receipt.count({ where }),
    prisma.receipt.findMany({
      where,
      ...skipTake(request),
      orderBy: sort.orderBy as Prisma.ReceiptOrderByWithRelationInput,
      select: {
        id: true,
        receiptNumber: true,
        status: true,
        printed: true,
        printedAt: true,
        cancelledAt: true,
        printedBy: { select: { firstName: true, lastName: true } },
        payment: {
          select: {
            paymentNumber: true,
            amount: true,
            paymentInvoices: {
              take: 1,
              select: {
                invoice: {
                  select: {
                    studentEnrollment: {
                      select: {
                        student: {
                          select: { firstName: true, lastName: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const rows: ReceiptRow[] = receipts.map((receipt) => {
    const student =
      receipt.payment.paymentInvoices[0]?.invoice.studentEnrollment.student;

    return {
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      paymentNumber: receipt.payment.paymentNumber,
      studentName: student
        ? `${student.firstName} ${student.lastName}`.trim()
        : "—",
      amount: toNumber(receipt.payment.amount),
      status: receipt.status,
      printed: receipt.printed,
      printedAt: receipt.printedAt?.toISOString() ?? null,
      printedBy: receipt.printedBy
        ? `${receipt.printedBy.firstName} ${receipt.printedBy.lastName}`.trim()
        : null,
      cancelledAt: receipt.cancelledAt?.toISOString() ?? null,
    };
  });

  return { rows, total };
};

export const receiptCounts = async (query: Partial<ReportQuery>) => {
  const { range } = resolvePeriod(query);
  const where: Prisma.ReceiptWhereInput = range
    ? { payment: { paymentDate: { gte: range.from, lte: range.to } } }
    : {};

  const [byStatus, printed, total] = await Promise.all([
    prisma.receipt.groupBy({ by: ["status"], where, _count: true }),
    prisma.receipt.count({ where: { ...where, printed: true } }),
    prisma.receipt.count({ where }),
  ]);

  const of = (status: string) =>
    byStatus.find((row) => row.status === status)?._count ?? 0;

  return {
    total,
    active: of("ACTIVE"),
    cancelled: of("CANCELLED"),
    reprinted: of("REPRINTED"),
    printed,
    notPrinted: total - printed,
  };
};

// --------------------------------------------------
// الديون — §25
// --------------------------------------------------

export type DebtRow = {
  id: string;
  invoiceNumber: string;
  studentName: string;
  subject: string;
  originalMonth: number;
  originalYear: number;
  total: number;
  paid: number;
  remaining: number;
  ageInMonths: number;
  ageBucket: string;
  status: string;
};

export const fetchDebtRows = async (
  query: Partial<ReportQuery>,
  reference: YearMonth,
  request: TableRequest,
  sort: ResolvedSort,
): Promise<{ rows: DebtRow[]; total: number }> => {
  /*
   * الدَّينُ كلُّ متبقٍّ لا القديمُ وحده.
   *
   * `oldDebtScope` يقصره على ما سبق فترةَ المرجع — وهو تعريفُ
   * «الدَّين القديم» لا «الدَّين». والجدولُ يعرض الاثنين ويميّزهما
   * بعمود العمر، فتُرى الشجرةُ والغابة معاً.
   */
  const where: Prisma.InvoiceWhereInput = {
    ...invoiceScope(query),
    remaining: { gt: 0 },
  };

  const [total, invoices] = await prisma.$transaction([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      ...skipTake(request),
      orderBy: sort.orderBy as Prisma.InvoiceOrderByWithRelationInput,
      select: {
        id: true,
        invoiceNumber: true,
        month: true,
        year: true,
        total: true,
        remaining: true,
        status: true,
        studentEnrollment: {
          select: {
            student: { select: { firstName: true, lastName: true } },
            teachingAssignment: {
              select: { subject: { select: { name: true } } },
            },
          },
        },
      },
    }),
  ]);

  const rows: DebtRow[] = invoices.map((invoice) => {
    const age = debtAgeInMonths(
      { month: invoice.month, year: invoice.year },
      reference,
    );
    const totalValue = toNumber(invoice.total);
    const remaining = toNumber(invoice.remaining);

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      studentName:
        `${invoice.studentEnrollment.student.firstName} ${invoice.studentEnrollment.student.lastName}`.trim(),
      subject: invoice.studentEnrollment.teachingAssignment.subject.name,
      originalMonth: invoice.month,
      originalYear: invoice.year,
      total: totalValue,
      paid: totalValue - remaining,
      remaining,
      ageInMonths: age,
      ageBucket: debtAgeBucket(age),
      status: invoice.status,
    };
  });

  return { rows, total };
};

/**
 * تعتيقُ الدَّين — §25.
 *
 * يُحسب في الذاكرة على **كلّ** الفواتير المدينة لا على الصفحة:
 * الرسمُ يصف المؤسسةَ لا الصفحة. والحقلان المجلوبان اثنان فقط
 * فالمنقولُ صغير.
 *
 * ولا يُحسب في SQL لأنّ الشرائح تعتمد على فارقٍ بين (شهر، سنة)
 * وفترةِ مرجعٍ متغيّرة — تعبيرٌ لا يستعمل الفهرس، فحسابُه في
 * القاعدة أبطأ لا أسرع.
 */
export const debtAging = async (
  query: Partial<ReportQuery>,
  reference: YearMonth,
) => {
  const invoices = await prisma.invoice.findMany({
    where: { ...invoiceScope(query), remaining: { gt: 0 } },
    select: { month: true, year: true, remaining: true },
  });

  const buckets = new Map<string, { amount: number; count: number }>();

  for (const invoice of invoices) {
    const bucket = debtAgeBucket(
      debtAgeInMonths({ month: invoice.month, year: invoice.year }, reference),
    );
    const current = buckets.get(bucket) ?? { amount: 0, count: 0 };

    current.amount += toNumber(invoice.remaining);
    current.count += 1;
    buckets.set(bucket, current);
  }

  return buckets;
};

// --------------------------------------------------
// تحصيلُ الديون — §26
// --------------------------------------------------

export type DebtCollectionRow = {
  id: string;
  invoiceNumber: string;
  studentName: string;
  originalMonth: number;
  originalYear: number;
  collectedAmount: number;
  collectedAt: string;
  paymentNumber: string;
  teacherShareCount: number;
  teacherShareAmount: number;
};

export const fetchDebtCollectionRows = async (
  query: Partial<ReportQuery>,
  request: TableRequest,
  sort: ResolvedSort,
): Promise<{ rows: DebtCollectionRow[]; total: number }> => {
  const { range } = resolvePeriod(query);

  /*
   * الشرطُ على `collectedAt` لا على شهر الفاتورة: التحصيلُ واقعةٌ
   * في يومه، والفاتورةُ تبقى في شهرها الأصلي (§52.7). ولذلك يعرض
   * الجدولُ العمودين معاً — «دُفع في نوفمبر عن سبتمبر».
   */
  const where: Prisma.DebtCollectionWhereInput = {
    ...activeDebtCollection,
    ...(range ? { collectedAt: { gte: range.from, lte: range.to } } : {}),
  };

  const [total, collections] = await prisma.$transaction([
    prisma.debtCollection.count({ where }),
    prisma.debtCollection.findMany({
      where,
      ...skipTake(request),
      orderBy: sort.orderBy as Prisma.DebtCollectionOrderByWithRelationInput,
      select: {
        id: true,
        collectedAmount: true,
        collectedAt: true,
        originalMonth: true,
        originalYear: true,
        payment: { select: { paymentNumber: true } },
        invoice: {
          select: {
            invoiceNumber: true,
            studentEnrollment: {
              select: {
                student: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        teacherShares: {
          where: { status: { not: "CANCELLED" } },
          select: { shareAmount: true },
        },
      },
    }),
  ]);

  const rows: DebtCollectionRow[] = collections.map((collection) => ({
    id: collection.id,
    invoiceNumber: collection.invoice.invoiceNumber,
    studentName:
      `${collection.invoice.studentEnrollment.student.firstName} ${collection.invoice.studentEnrollment.student.lastName}`.trim(),
    originalMonth: collection.originalMonth,
    originalYear: collection.originalYear,
    collectedAmount: toNumber(collection.collectedAmount),
    collectedAt: collection.collectedAt.toISOString(),
    paymentNumber: collection.payment.paymentNumber,
    teacherShareCount: collection.teacherShares.length,
    teacherShareAmount: collection.teacherShares.reduce(
      (sum, share) => sum + toNumber(share.shareAmount),
      0,
    ),
  }));

  return { rows, total };
};

// --------------------------------------------------
// الفواتير — تجميعٌ بالمادة، لرسم §22
// --------------------------------------------------

export const revenueBySubject = async (query: Partial<ReportQuery>) => {
  /*
   * لا `groupBy` على حقلٍ عبر علاقة في Prisma. فالتجميعُ بالإسناد
   * أوّلاً — وهو مفتاحٌ مباشر — ثمّ يُطوى إلى المادة في الذاكرة.
   *
   * والتسجيلُ وسيطٌ بين الفاتورة والإسناد، فالجسرُ استعلامان لا
   * حلقة: تسجيلاتُ الصفحة، ثمّ إسناداتُها بموادّها.
   */
  const byEnrollment = await prisma.invoice.groupBy({
    by: ["studentEnrollmentId"],
    where: invoiceScope(query),
    _sum: { total: true, remaining: true },
  });

  if (byEnrollment.length === 0) return [];

  const enrollments = await prisma.studentEnrollment.findMany({
    where: { id: { in: byEnrollment.map((row) => row.studentEnrollmentId) } },
    select: {
      id: true,
      teachingAssignment: {
        select: { subject: { select: { id: true, name: true } } },
      },
    },
  });

  const subjectOf = new Map(
    enrollments.map((row) => [row.id, row.teachingAssignment.subject]),
  );

  const totals = new Map<
    string,
    { id: string; name: string; invoiced: number; remaining: number }
  >();

  for (const row of byEnrollment) {
    const subject = subjectOf.get(row.studentEnrollmentId);
    if (!subject) continue;

    const current = totals.get(subject.id) ?? {
      id: subject.id,
      name: subject.name,
      invoiced: 0,
      remaining: 0,
    };

    current.invoiced += toNumber(row._sum.total);
    current.remaining += toNumber(row._sum.remaining);
    totals.set(subject.id, current);
  }

  return [...totals.values()].sort((a, b) => b.invoiced - a.invoiced);
};

export const oldDebtRows = oldDebtScope;
