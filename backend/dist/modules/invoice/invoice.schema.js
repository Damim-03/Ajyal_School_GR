"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelInvoiceSchema = exports.invoiceQuerySchema = exports.invoiceIdSchema = exports.updateInvoiceSchema = exports.generateInvoicesSchema = exports.createInvoiceSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../../generated/prisma");
const monthField = zod_1.z.coerce
    .number()
    .int()
    .min(1, "Month must be between 1 and 12")
    .max(12, "Month must be between 1 and 12");
const yearField = zod_1.z.coerce
    .number()
    .int()
    .min(2000, "Year must be between 2000 and 2100")
    .max(2100, "Year must be between 2000 and 2100");
const moneyField = zod_1.z.coerce
    .number()
    .min(0, "Amount must not be negative")
    .max(9999999, "Amount is too large");
// --------------------------------------------------
// Create — فاتورة واحدة
//
// amount اختياري: يُؤخذ من TuitionFee الساري في
// أول الشهر المفوتَر إن لم يُرسل.
// dueDate اختياري: آخر يوم في الشهر المفوتَر.
// --------------------------------------------------
exports.createInvoiceSchema = zod_1.z.object({
    studentEnrollmentId: zod_1.z
        .string({ error: "Enrollment is required" })
        .trim()
        .min(1, "Enrollment is required"),
    month: monthField,
    year: yearField,
    amount: moneyField.positive("Amount must be greater than 0").optional(),
    discount: moneyField.optional(),
    dueDate: zod_1.z.coerce.date().optional(),
    note: zod_1.z.string().trim().max(500).nullish(),
});
// --------------------------------------------------
// Generate — فواتير الشهر لكل المسجَّلين
// --------------------------------------------------
exports.generateInvoicesSchema = zod_1.z.object({
    academicYearId: zod_1.z
        .string({ error: "Academic year is required" })
        .trim()
        .min(1, "Academic year is required"),
    month: monthField,
    year: yearField,
    dueDate: zod_1.z.coerce.date().optional(),
    // تضييق النطاق — اختياري
    studyGroupIds: zod_1.z.array(zod_1.z.string().trim().min(1)).max(100).optional(),
    studentIds: zod_1.z.array(zod_1.z.string().trim().min(1)).max(500).optional(),
});
// --------------------------------------------------
// Update
//
// المبلغ والتخفيض يُعيدان حساب total و remaining
// والحالة تُشتقّ من المدفوع.
// --------------------------------------------------
exports.updateInvoiceSchema = zod_1.z
    .object({
    amount: moneyField.positive("Amount must be greater than 0"),
    discount: moneyField,
    dueDate: zod_1.z.coerce.date(),
    note: zod_1.z.string().trim().max(500).nullish(),
})
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.invoiceIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Invoice id is required"),
});
exports.invoiceQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().min(1).optional(),
    studentId: zod_1.z.string().trim().min(1).optional(),
    studentEnrollmentId: zod_1.z.string().trim().min(1).optional(),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
    subjectId: zod_1.z.string().trim().min(1).optional(),
    status: zod_1.z.enum(prisma_1.InvoiceStatus).optional(),
    month: monthField.optional(),
    year: yearField.optional(),
    // الفواتير المتأخرة: لها متبقٍّ وتجاوزت تاريخ الاستحقاق
    overdue: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
// --------------------------------------------------
// Cancel
// السبب يُخزَّن في عمود مستقل لا في note، ليبقى
// قابلاً للاستعلام في كشوف التدقيق.
// --------------------------------------------------
exports.cancelInvoiceSchema = zod_1.z.object({
    reason: zod_1.z.string().trim().max(500).nullish(),
});
//# sourceMappingURL=invoice.schema.js.map