import { z } from "zod";
import { ReceiptStatus } from "../../../generated/prisma";

// --------------------------------------------------
// Params & Query
//
// الإيصال يُنشأ تلقائياً مع الدفعة، فلا يوجد
// مسار إنشاء — فقط عرض وطباعة وإلغاء.
// --------------------------------------------------

export const receiptIdSchema = z.object({
  id: z.string().trim().min(1, "Receipt id is required"),
});

export const receiptQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  status: z.enum(ReceiptStatus).optional(),
  paymentId: z.string().trim().min(1).optional(),
  studentId: z.string().trim().min(1).optional(),
  printed: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// --------------------------------------------------
// Cancel
// --------------------------------------------------

export const cancelReceiptSchema = z.object({
  note: z.string().trim().max(500).nullish(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type ReceiptQueryInput = z.infer<typeof receiptQuerySchema>;
export type CancelReceiptInput = z.infer<typeof cancelReceiptSchema>;
