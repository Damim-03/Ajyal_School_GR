"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelPaymentSchema = exports.paymentQuerySchema = exports.paymentIdSchema = exports.createPaymentSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../../../generated/prisma");
// --------------------------------------------------
// Create
//
// الدفعة الواحدة قد تُسدِّد عدة فواتير (allocations).
// المبلغ الإجمالي مشتقّ من مجموع التوزيعات ولا يُرسَل،
// حتى لا يتناقض ما يُخزَّن مع ما يُوزَّع.
// --------------------------------------------------
exports.createPaymentSchema = zod_1.z.object({
    allocations: zod_1.z
        .array(zod_1.z.object({
        invoiceId: zod_1.z.string().trim().min(1, "Invoice is required"),
        paidAmount: zod_1.z.coerce
            .number()
            .positive("Paid amount must be greater than 0")
            .max(9999999, "Paid amount is too large"),
    }), { error: "Allocations are required" })
        .min(1, "At least one invoice must be paid")
        .max(50, "Cannot pay more than 50 invoices at once")
        .refine((allocations) => {
        const ids = allocations.map((a) => a.invoiceId);
        return new Set(ids).size === ids.length;
    }, { error: "Duplicate invoice in allocations" }),
    paymentMethod: zod_1.z.enum(prisma_1.PaymentMethod).optional(),
    paymentDate: zod_1.z.coerce.date().optional(),
    note: zod_1.z.string().trim().max(500).nullish(),
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.paymentIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Payment id is required"),
});
exports.paymentQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().min(1).optional(),
    studentId: zod_1.z.string().trim().min(1).optional(),
    invoiceId: zod_1.z.string().trim().min(1).optional(),
    paymentMethod: zod_1.z.enum(prisma_1.PaymentMethod).optional(),
    status: zod_1.z.enum(prisma_1.PaymentStatus).optional(),
    receivedById: zod_1.z.string().trim().min(1).optional(),
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
});
// --------------------------------------------------
// Cancel
// --------------------------------------------------
exports.cancelPaymentSchema = zod_1.z.object({
    reason: zod_1.z.string().trim().max(500).nullish(),
});
//# sourceMappingURL=payment.schema.js.map