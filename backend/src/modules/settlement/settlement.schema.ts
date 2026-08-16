import { z } from "zod";

/**
 * لاحظ ما **ليس** هنا: teacherAmount، ولا أيّ مجموع.
 *
 * §18: «يجب منع المستخدم من إدخال النتائج النهائية». والمنعُ ببنية
 * المخطّط لا بفحصٍ داخل الخدمة: ما لا مكان له في الطلب لا يُرسَل
 * أصلاً، فلا يحتاج رفضاً.
 *
 * الإدارة تُدخل: أيّ إسناد، وأيّ كشف. والنظام يستنتج الباقي.
 */

export const computeSettlementSchema = z.object({
  teachingAssignmentId: z
    .string({ error: "Teaching assignment is required" })
    .trim()
    .min(1),

  attendanceSheetId: z
    .string({ error: "Attendance sheet is required" })
    .trim()
    .min(1),

  /// سياسة بعينها بدل المرجَّحة تلقائياً — للحالات الاستثنائية
  policyId: z.string().trim().min(1).nullish(),

  note: z.string().trim().max(500).nullish(),
});

export const settlementIdSchema = z.object({
  id: z.string().trim().min(1, "Settlement id is required"),
});

export const confirmSettlementSchema = z.object({
  note: z.string().trim().max(500).nullish(),
});

export const cancelSettlementSchema = z.object({
  cancelReason: z
    .string({ error: "Cancel reason is required" })
    .trim()
    .min(3, "Cancel reason is required")
    .max(500),
});

export const settlementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  academicYearId: z.string().trim().min(1).optional(),
  teacherId: z.string().trim().min(1).optional(),
  teachingAssignmentId: z.string().trim().min(1).optional(),
  attendanceSheetId: z.string().trim().min(1).optional(),
  status: z.enum(["DRAFT", "CONFIRMED", "PAID", "CANCELLED"]).optional(),
});

// --------------------------------------------------
// الكشفان الماليان
// --------------------------------------------------

/** §16 — الكشف التقديري للحصص */
export const estimateQuerySchema = z.object({
  teachingAssignmentId: z.string().trim().min(1),
  attendanceSheetId: z.string().trim().min(1),
  policyId: z.string().trim().min(1).optional(),
});

/** §17 — كشف التخليص اليومي المالي */
export const dailyClearanceQuerySchema = z.object({
  date: z.coerce.date({ error: "Date is required" }),
  receivedById: z.string().trim().min(1).optional(),
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER"]).optional(),
});

export type ComputeSettlementInput = z.infer<typeof computeSettlementSchema>;
export type ConfirmSettlementInput = z.infer<typeof confirmSettlementSchema>;
export type CancelSettlementInput = z.infer<typeof cancelSettlementSchema>;
export type SettlementQueryInput = z.infer<typeof settlementQuerySchema>;
export type EstimateQueryInput = z.infer<typeof estimateQuerySchema>;
export type DailyClearanceQueryInput = z.infer<
  typeof dailyClearanceQuerySchema
>;
