import { z } from "zod";
import { PaymentMethod, PaymentStatus } from "../../../generated/prisma";

// --------------------------------------------------
// Create
//
// الدفعة الواحدة قد تُسدِّد عدة فواتير (allocations).
// المبلغ الإجمالي مشتقّ من مجموع التوزيعات ولا يُرسَل،
// حتى لا يتناقض ما يُخزَّن مع ما يُوزَّع.
// --------------------------------------------------

export const createPaymentSchema = z.object({
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().trim().min(1, "Invoice is required"),
        paidAmount: z.coerce
          .number()
          .positive("Paid amount must be greater than 0")
          .max(9_999_999, "Paid amount is too large"),
      }),
      { error: "Allocations are required" },
    )
    .min(1, "At least one invoice must be paid")
    .max(50, "Cannot pay more than 50 invoices at once")
    .refine(
      (allocations) => {
        const ids = allocations.map((a) => a.invoiceId);
        return new Set(ids).size === ids.length;
      },
      { error: "Duplicate invoice in allocations" },
    ),

  paymentMethod: z.enum(PaymentMethod).optional(),

  paymentDate: z.coerce.date().optional(),

  note: z.string().trim().max(500).nullish(),
});

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const paymentIdSchema = z.object({
  id: z.string().trim().min(1, "Payment id is required"),
});

export const paymentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  studentId: z.string().trim().min(1).optional(),
  /**
   * الطالبُ بما يُعرف به لا بمعرّفه الداخلي.
   *
   * `studentId` معرّفٌ (cuid) لا يُملى ولا يُكتب — تختاره الشاشةُ من
   * قائمة. والموظّفُ في شبّاك التحصيل يمسك اسماً أو بطاقةً فيها رقم،
   * فلا يجد بهما مدخلاً وكان يقلّب الصفحات.
   */
  studentName: z.string().trim().min(1).optional(),
  studentNumber: z.string().trim().min(1).optional(),
  invoiceId: z.string().trim().min(1).optional(),
  paymentMethod: z.enum(PaymentMethod).optional(),
  status: z.enum(PaymentStatus).optional(),
  receivedById: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// --------------------------------------------------
// Cancel
// --------------------------------------------------

export const cancelPaymentSchema = z.object({
  reason: z.string().trim().max(500).nullish(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentQueryInput = z.infer<typeof paymentQuerySchema>;
export type CancelPaymentInput = z.infer<typeof cancelPaymentSchema>;
