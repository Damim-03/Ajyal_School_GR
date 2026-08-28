import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import { startOfUtcDay, addUtcDays } from "../../core/utils/time";
import { ReceiptQueryInput, CancelReceiptInput } from "./receipt.schema";
import { containsOn, matchTextIds } from "../../core/search/text-match";

const receiptSelect = {
  id: true,
  receiptNumber: true,
  paymentId: true,
  status: true,
  printed: true,
  printedAt: true,
  printedById: true,
  note: true,
  cancelledAt: true,
  cancelledById: true,
  cancelReason: true,
  createdAt: true,
  printedBy: { select: { id: true, username: true } },
  cancelledBy: { select: { id: true, username: true } },
  payment: {
    select: {
      id: true,
      paymentNumber: true,
      amount: true,
      paymentMethod: true,
      paymentDate: true,
      receivedBy: { select: { id: true, username: true } },
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
              studentEnrollment: {
                select: {
                  student: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      parentPhone: true,
                    },
                  },
                  teachingAssignment: {
                    select: { subject: { select: { id: true, name: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

type RawReceipt = {
  payment: {
    amount: Prisma.Decimal;
    paymentInvoices: { paidAmount: Prisma.Decimal; [k: string]: unknown }[];
    [k: string]: unknown;
  };
  [key: string]: unknown;
};

const toResponse = <T extends RawReceipt>(receipt: T) => ({
  ...receipt,
  payment: {
    ...receipt.payment,
    amount: Number(receipt.payment.amount),
    paymentInvoices: receipt.payment.paymentInvoices.map((pi) => ({
      ...pi,
      paidAmount: Number(pi.paidAmount),
    })),
  },
});

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    select: { id: true, status: true, printed: true },
  });

  if (!receipt) {
    throw new NotFoundException(
      "Receipt not found",
      ErrorCodeEnum.RECEIPT_NOT_FOUND,
    );
  }

  return receipt;
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listReceiptsService = async (query: ReceiptQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  /* مطابقةٌ بترتيبٍ صريح — انظر `core/search/text-match` */
  const searchIds = query.search
    ? await matchTextIds("Receipt", [containsOn(["receiptNumber"], query.search)])
    : null;

  const where: Prisma.ReceiptWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.paymentId && { paymentId: query.paymentId }),
    ...(query.printed !== undefined && { printed: query.printed }),
    ...(searchIds && { id: { in: searchIds } }),
    ...((query.dateFrom || query.dateTo || query.studentId) && {
      payment: {
        ...((query.dateFrom || query.dateTo) && {
          paymentDate: {
            ...(query.dateFrom && { gte: startOfUtcDay(query.dateFrom) }),
            ...(query.dateTo && {
              lt: addUtcDays(startOfUtcDay(query.dateTo), 1),
            }),
          },
        }),
        ...(query.studentId && {
          paymentInvoices: {
            some: {
              invoice: { studentEnrollment: { studentId: query.studentId } },
            },
          },
        }),
      },
    }),
  };

  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      select: receiptSelect,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.receipt.count({ where }),
  ]);

  return {
    receipts: receipts.map(toResponse),
    pagination: buildPagination(total, page, limit),
  };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getReceiptService = async (id: string) => {
  await findOrThrow(id);

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    select: receiptSelect,
  });

  return receipt ? toResponse(receipt) : null;
};

// --------------------------------------------------
// Print / Reprint
//
// قاعدة schema.prisma:
//   printed = true  →  printedById و printedAt غير null
//   printed = false →  كلاهما null
//
// الطباعة الأولى تُبقي الحالة ACTIVE،
// وإعادة الطباعة تنقلها إلى REPRINTED لتترك أثراً.
// --------------------------------------------------

export const printReceiptService = async (
  id: string,
  printedById: string,
  isReprint: boolean,
) => {
  const receipt = await findOrThrow(id);

  if (receipt.status === "CANCELLED") {
    throw new ConflictException(
      "Cannot print a cancelled receipt",
      ErrorCodeEnum.RECEIPT_NOT_FOUND,
    );
  }

  if (!isReprint && receipt.printed) {
    throw new ConflictException(
      "Receipt is already printed. Use the reprint endpoint instead.",
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  if (isReprint && !receipt.printed) {
    throw new ConflictException(
      "Receipt has not been printed yet. Use the print endpoint instead.",
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  const updated = await prisma.receipt.update({
    where: { id },
    data: {
      printed: true,
      printedAt: new Date(),
      printedById,
      ...(isReprint && { status: "REPRINTED" }),
    },
    select: receiptSelect,
  });

  return toResponse(updated);
};

// --------------------------------------------------
// Cancel
//
// إلغاء الإيصال لا يمسّ الدفعة ولا الفواتير —
// هو إبطال للمستند الورقي فقط.
// --------------------------------------------------

export const cancelReceiptService = async (
  id: string,
  body: CancelReceiptInput,
  cancelledById: string,
) => {
  const receipt = await findOrThrow(id);

  if (receipt.status === "CANCELLED") {
    throw new ConflictException(
      "Receipt is already cancelled",
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  const updated = await prisma.receipt.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledById,
      cancelReason: body.note ?? null,
      ...(body.note !== undefined && { note: body.note }),
    },
    select: receiptSelect,
  });

  return toResponse(updated);
};
