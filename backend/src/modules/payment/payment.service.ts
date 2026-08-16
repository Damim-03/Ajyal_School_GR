import { Prisma, InvoiceStatus } from "../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import { startOfUtcDay, addUtcDays } from "../../core/utils/time";
import { uniqueDocumentNumber } from "../../core/utils/document-number";
import {
  CreatePaymentInput,
  PaymentQueryInput,
  CancelPaymentInput,
} from "./payment.schema";

const paymentSelect = {
  id: true,
  paymentNumber: true,
  amount: true,
  paymentMethod: true,
  status: true,
  paymentDate: true,
  note: true,
  receivedById: true,
  cancelledAt: true,
  cancelledById: true,
  cancelReason: true,
  createdAt: true,
  updatedAt: true,
  receivedBy: { select: { id: true, username: true } },
  cancelledBy: { select: { id: true, username: true } },
  receipt: {
    select: {
      id: true,
      receiptNumber: true,
      status: true,
      printed: true,
      printedAt: true,
    },
  },
  paymentInvoices: {
    select: {
      id: true,
      paidAmount: true,
      invoice: {
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
              id: true,
              student: { select: { id: true, firstName: true, lastName: true } },
              teachingAssignment: {
                select: { subject: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
    },
  },
} as const;

type RawPayment = {
  amount: Prisma.Decimal;
  paymentInvoices: {
    paidAmount: Prisma.Decimal;
    invoice: {
      total: Prisma.Decimal;
      remaining: Prisma.Decimal;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  }[];
  [key: string]: unknown;
};

const toResponse = <T extends RawPayment>(payment: T) => ({
  ...payment,
  amount: Number(payment.amount),
  paymentInvoices: payment.paymentInvoices.map((pi) => ({
    ...pi,
    paidAmount: Number(pi.paidAmount),
    invoice: {
      ...pi.invoice,
      total: Number(pi.invoice.total),
      remaining: Number(pi.invoice.remaining),
    },
  })),
});

// --------------------------------------------------
// ترقيم الدفعات والإيصالات — ثلاث عشرة خانة عشوائية
//
// كان `PAY-2026-10-0001`. والقاعدة والتفصيل في
// `core/utils/document-number`: الرقم يُمسح باركوداً، ولا يُفشي عدد
// دفعات الشهر، ولا يُخمَّن.
//
// والفحص داخل المعاملة نفسها التي ستحفظ الصفّ — لا قبلها: بين فحصٍ
// خارجها وحفظٍ فيها تسع فرجةٌ لدفعةٍ أخرى تأخذ الرقم.
// --------------------------------------------------

const uniqueNumber = async (
  tx: Prisma.TransactionClient,
  kind: "PAY" | "REC",
): Promise<string> => {
  const number = await uniqueDocumentNumber(async (candidate) =>
    kind === "PAY"
      ? (await tx.payment.count({ where: { paymentNumber: candidate } })) > 0
      : (await tx.receipt.count({ where: { receiptNumber: candidate } })) > 0,
  );

  if (!number) {
    throw new ConflictException(
      "تعذّر توليد رقمٍ فريد للمستند — أعد المحاولة",
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  return number;
};

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!payment) {
    throw new NotFoundException(
      "Payment not found",
      ErrorCodeEnum.PAYMENT_NOT_FOUND,
    );
  }

  return payment;
};

const deriveInvoiceStatus = (
  remaining: Prisma.Decimal,
  paid: Prisma.Decimal,
): InvoiceStatus =>
  remaining.lte(0) ? "PAID" : paid.gt(0) ? "PARTIAL" : "PENDING";

// --------------------------------------------------
// List
// --------------------------------------------------

export const listPaymentsService = async (query: PaymentQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const where: Prisma.PaymentWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.paymentMethod && { paymentMethod: query.paymentMethod }),
    ...(query.receivedById && { receivedById: query.receivedById }),
    ...(query.search && { paymentNumber: { contains: query.search } }),
    ...((query.dateFrom || query.dateTo) && {
      paymentDate: {
        ...(query.dateFrom && { gte: startOfUtcDay(query.dateFrom) }),
        ...(query.dateTo && { lt: addUtcDays(startOfUtcDay(query.dateTo), 1) }),
      },
    }),
    ...((query.studentId || query.invoiceId) && {
      paymentInvoices: {
        some: {
          ...(query.invoiceId && { invoiceId: query.invoiceId }),
          ...(query.studentId && {
            invoice: { studentEnrollment: { studentId: query.studentId } },
          }),
        },
      },
    }),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: paymentSelect,
      skip,
      take,
      orderBy: { paymentDate: "desc" },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments: payments.map(toResponse),
    pagination: buildPagination(total, page, limit),
  };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getPaymentService = async (id: string) => {
  await findOrThrow(id);

  const payment = await prisma.payment.findUnique({
    where: { id },
    select: paymentSelect,
  });

  return payment ? toResponse(payment) : null;
};

// --------------------------------------------------
// Create
//
// كل شيء داخل transaction واحدة:
//   1. قراءة الفواتير بحالتها اللحظية
//   2. رفض ما يتجاوز المتبقّي
//   3. إنشاء الدفعة وتوزيعاتها
//   4. تحديث remaining و status لكل فاتورة
//   5. إنشاء الإيصال
//
// remaining يُحدَّث ذرّياً مع PaymentInvoice كما تنصّ
// قاعدة schema.prisma.
// --------------------------------------------------

export const createPaymentService = async (
  body: CreatePaymentInput,
  receivedById: string,
) => {
  const invoiceIds = body.allocations.map((a) => a.invoiceId);
  const paymentDate = body.paymentDate
    ? startOfUtcDay(body.paymentDate)
    : startOfUtcDay(new Date());

  const paymentId = await prisma.$transaction(async (tx) => {
    const invoices = await tx.invoice.findMany({
      where: { id: { in: invoiceIds } },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        total: true,
        remaining: true,
      },
    });

    if (invoices.length !== invoiceIds.length) {
      const found = new Set(invoices.map((i) => i.id));
      const missing = invoiceIds.filter((id) => !found.has(id));

      throw new NotFoundException(
        `Invoice(s) not found: ${missing.join(", ")}`,
        ErrorCodeEnum.INVOICE_NOT_FOUND,
      );
    }

    const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));

    const cancelled = invoices.filter((i) => i.status === "CANCELLED");

    if (cancelled.length > 0) {
      throw new BadRequestException(
        `Cannot pay cancelled invoice(s): ` +
          cancelled.map((i) => i.invoiceNumber).join(", "),
        ErrorCodeEnum.INVOICE_CANCELLED,
      );
    }

    // لا يُسمح بتجاوز المتبقّي — وإلا صار remaining سالباً
    const overpaid = body.allocations
      .map((allocation) => ({
        allocation,
        invoice: byId.get(allocation.invoiceId)!,
      }))
      .filter(
        ({ allocation, invoice }) =>
          new Prisma.Decimal(allocation.paidAmount).gt(invoice.remaining),
      );

    if (overpaid.length > 0) {
      throw new BadRequestException(
        `Amount exceeds what is due: ` +
          overpaid
            .map(
              ({ allocation, invoice }) =>
                `${invoice.invoiceNumber} (paying ${allocation.paidAmount}, due ${invoice.remaining})`,
            )
            .join(", "),
        ErrorCodeEnum.PAYMENT_AMOUNT_INVALID,
      );
    }

    // المبلغ الإجمالي مشتقّ من التوزيعات
    const amount = body.allocations.reduce(
      (sum, allocation) => sum.plus(new Prisma.Decimal(allocation.paidAmount)),
      new Prisma.Decimal(0),
    );

    const payment = await tx.payment.create({
      data: {
        paymentNumber: await uniqueNumber(tx, "PAY"),
        amount,
        paymentMethod: body.paymentMethod ?? "CASH",
        paymentDate,
        note: body.note ?? null,
        receivedById,
      },
      select: { id: true },
    });

    for (const allocation of body.allocations) {
      const invoice = byId.get(allocation.invoiceId)!;
      const paidAmount = new Prisma.Decimal(allocation.paidAmount);

      await tx.paymentInvoice.create({
        data: { paymentId: payment.id, invoiceId: invoice.id, paidAmount },
      });

      const remaining = invoice.remaining.minus(paidAmount);
      const paidSoFar = invoice.total.minus(remaining);

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          remaining,
          status: deriveInvoiceStatus(remaining, paidSoFar),
        },
      });
    }

    // إيصال لكل دفعة — Receipt.paymentId فريد وإلزامي
    await tx.receipt.create({
      data: {
        receiptNumber: await uniqueNumber(tx, "REC"),
        paymentId: payment.id,
      },
    });

    return payment.id;
  });

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: paymentSelect,
  });

  return toResponse(payment!);
};

// --------------------------------------------------
// Cancel
//
// عكسٌ كامل بلا حذف أي صف:
//   1. الدفعة → CANCELLED
//   2. كل فاتورة متأثّرة يُعاد حساب remaining و status
//      من مجموع الدفعات النشطة وحدها
//   3. الإيصال المرتبط → CANCELLED
//
// صفوف PaymentInvoice تبقى كما هي للتدقيق.
// --------------------------------------------------

export const cancelPaymentService = async (
  id: string,
  body: CancelPaymentInput,
  cancelledById: string,
) => {
  const cancelledAt = new Date();

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        paymentInvoices: { select: { invoiceId: true } },
        receipt: { select: { id: true, status: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException(
        "Payment not found",
        ErrorCodeEnum.PAYMENT_NOT_FOUND,
      );
    }

    if (payment.status === "CANCELLED") {
      throw new ConflictException(
        "Payment is already cancelled",
        ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
      );
    }

    await tx.payment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt,
        cancelledById,
        cancelReason: body.reason ?? null,
      },
    });

    // إعادة حساب كل فاتورة متأثّرة بعد استبعاد هذه الدفعة
    const invoiceIds = [
      ...new Set(payment.paymentInvoices.map((pi) => pi.invoiceId)),
    ];

    for (const invoiceId of invoiceIds) {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, total: true, status: true },
      });

      // الفاتورة الملغاة تبقى كما هي
      if (!invoice || invoice.status === "CANCELLED") continue;

      const stillPaid = await tx.paymentInvoice.aggregate({
        where: { invoiceId, payment: { status: "ACTIVE" } },
        _sum: { paidAmount: true },
      });

      const paid = stillPaid._sum.paidAmount ?? new Prisma.Decimal(0);
      const remaining = invoice.total.minus(paid);

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { remaining, status: deriveInvoiceStatus(remaining, paid) },
      });
    }

    // الوصل يتبع دفعته: إلغاء الاستلام يُبطل إثباته
    if (payment.receipt && payment.receipt.status !== "CANCELLED") {
      await tx.receipt.update({
        where: { id: payment.receipt.id },
        data: {
          status: "CANCELLED",
          cancelledAt,
          cancelledById,
          cancelReason: body.reason ?? "Payment cancelled",
        },
      });
    }
  });

  const payment = await prisma.payment.findUnique({
    where: { id },
    select: paymentSelect,
  });

  return toResponse(payment!);
};
