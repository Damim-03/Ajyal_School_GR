"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelReceiptService = exports.printReceiptService = exports.getReceiptService = exports.listReceiptsService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const time_1 = require("../../core/utils/time");
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
};
const toResponse = (receipt) => ({
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
const findOrThrow = async (id) => {
    const receipt = await client_1.prisma.receipt.findUnique({
        where: { id },
        select: { id: true, status: true, printed: true },
    });
    if (!receipt) {
        throw new app_errors_1.NotFoundException("Receipt not found", error_code_enum_1.ErrorCodeEnum.RECEIPT_NOT_FOUND);
    }
    return receipt;
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listReceiptsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const where = {
        ...(query.status && { status: query.status }),
        ...(query.paymentId && { paymentId: query.paymentId }),
        ...(query.printed !== undefined && { printed: query.printed }),
        ...(query.search && { receiptNumber: { contains: query.search } }),
        ...((query.dateFrom || query.dateTo || query.studentId) && {
            payment: {
                ...((query.dateFrom || query.dateTo) && {
                    paymentDate: {
                        ...(query.dateFrom && { gte: (0, time_1.startOfUtcDay)(query.dateFrom) }),
                        ...(query.dateTo && {
                            lt: (0, time_1.addUtcDays)((0, time_1.startOfUtcDay)(query.dateTo), 1),
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
        client_1.prisma.receipt.findMany({
            where,
            select: receiptSelect,
            skip,
            take,
            orderBy: { createdAt: "desc" },
        }),
        client_1.prisma.receipt.count({ where }),
    ]);
    return {
        receipts: receipts.map(toResponse),
        pagination: (0, api_response_1.buildPagination)(total, page, limit),
    };
};
exports.listReceiptsService = listReceiptsService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getReceiptService = async (id) => {
    await findOrThrow(id);
    const receipt = await client_1.prisma.receipt.findUnique({
        where: { id },
        select: receiptSelect,
    });
    return receipt ? toResponse(receipt) : null;
};
exports.getReceiptService = getReceiptService;
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
const printReceiptService = async (id, printedById, isReprint) => {
    const receipt = await findOrThrow(id);
    if (receipt.status === "CANCELLED") {
        throw new app_errors_1.ConflictException("Cannot print a cancelled receipt", error_code_enum_1.ErrorCodeEnum.RECEIPT_NOT_FOUND);
    }
    if (!isReprint && receipt.printed) {
        throw new app_errors_1.ConflictException("Receipt is already printed. Use the reprint endpoint instead.", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    if (isReprint && !receipt.printed) {
        throw new app_errors_1.ConflictException("Receipt has not been printed yet. Use the print endpoint instead.", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    const updated = await client_1.prisma.receipt.update({
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
exports.printReceiptService = printReceiptService;
// --------------------------------------------------
// Cancel
//
// إلغاء الإيصال لا يمسّ الدفعة ولا الفواتير —
// هو إبطال للمستند الورقي فقط.
// --------------------------------------------------
const cancelReceiptService = async (id, body, cancelledById) => {
    const receipt = await findOrThrow(id);
    if (receipt.status === "CANCELLED") {
        throw new app_errors_1.ConflictException("Receipt is already cancelled", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    const updated = await client_1.prisma.receipt.update({
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
exports.cancelReceiptService = cancelReceiptService;
//# sourceMappingURL=receipt.service.js.map