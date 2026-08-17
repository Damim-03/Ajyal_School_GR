"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelReceiptSchema = exports.receiptQuerySchema = exports.receiptIdSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../../../generated/prisma");
// --------------------------------------------------
// Params & Query
//
// الإيصال يُنشأ تلقائياً مع الدفعة، فلا يوجد
// مسار إنشاء — فقط عرض وطباعة وإلغاء.
// --------------------------------------------------
exports.receiptIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Receipt id is required"),
});
exports.receiptQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().min(1).optional(),
    status: zod_1.z.enum(prisma_1.ReceiptStatus).optional(),
    paymentId: zod_1.z.string().trim().min(1).optional(),
    studentId: zod_1.z.string().trim().min(1).optional(),
    printed: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
});
// --------------------------------------------------
// Cancel
// --------------------------------------------------
exports.cancelReceiptSchema = zod_1.z.object({
    note: zod_1.z.string().trim().max(500).nullish(),
});
//# sourceMappingURL=receipt.schema.js.map