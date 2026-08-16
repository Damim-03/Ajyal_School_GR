import { z } from "zod";
import { InvoiceStatus } from "../../generated/prisma";

const monthField = z.coerce
  .number()
  .int()
  .min(1, "Month must be between 1 and 12")
  .max(12, "Month must be between 1 and 12");

const yearField = z.coerce
  .number()
  .int()
  .min(2000, "Year must be between 2000 and 2100")
  .max(2100, "Year must be between 2000 and 2100");

const moneyField = z.coerce
  .number()
  .min(0, "Amount must not be negative")
  .max(9_999_999, "Amount is too large");

// --------------------------------------------------
// Create — فاتورة واحدة
//
// amount اختياري: يُؤخذ من TuitionFee الساري في
// أول الشهر المفوتَر إن لم يُرسل.
// dueDate اختياري: آخر يوم في الشهر المفوتَر.
// --------------------------------------------------

export const createInvoiceSchema = z.object({
  studentEnrollmentId: z
    .string({ error: "Enrollment is required" })
    .trim()
    .min(1, "Enrollment is required"),

  month: monthField,

  year: yearField,

  amount: moneyField.positive("Amount must be greater than 0").optional(),

  discount: moneyField.optional(),

  dueDate: z.coerce.date().optional(),

  note: z.string().trim().max(500).nullish(),
});

// --------------------------------------------------
// Generate — فواتير الشهر لكل المسجَّلين
// --------------------------------------------------

export const generateInvoicesSchema = z.object({
  academicYearId: z
    .string({ error: "Academic year is required" })
    .trim()
    .min(1, "Academic year is required"),

  month: monthField,

  year: yearField,

  dueDate: z.coerce.date().optional(),

  // تضييق النطاق — اختياري
  studyGroupIds: z.array(z.string().trim().min(1)).max(100).optional(),

  studentIds: z.array(z.string().trim().min(1)).max(500).optional(),
});

// --------------------------------------------------
// Update
//
// المبلغ والتخفيض يُعيدان حساب total و remaining
// والحالة تُشتقّ من المدفوع.
// --------------------------------------------------

export const updateInvoiceSchema = z
  .object({
    amount: moneyField.positive("Amount must be greater than 0"),
    discount: moneyField,
    dueDate: z.coerce.date(),
    note: z.string().trim().max(500).nullish(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const invoiceIdSchema = z.object({
  id: z.string().trim().min(1, "Invoice id is required"),
});

export const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  studentId: z.string().trim().min(1).optional(),
  studentEnrollmentId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
  studyGroupId: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional(),
  status: z.enum(InvoiceStatus).optional(),
  month: monthField.optional(),
  year: yearField.optional(),
  // الفواتير المتأخرة: لها متبقٍّ وتجاوزت تاريخ الاستحقاق
  overdue: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// --------------------------------------------------
// Cancel
// السبب يُخزَّن في عمود مستقل لا في note، ليبقى
// قابلاً للاستعلام في كشوف التدقيق.
// --------------------------------------------------

export const cancelInvoiceSchema = z.object({
  reason: z.string().trim().max(500).nullish(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type GenerateInvoicesInput = z.infer<typeof generateInvoicesSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceQueryInput = z.infer<typeof invoiceQuerySchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
