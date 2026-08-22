import { z } from "zod";

export const debtShareQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  teacherId: z.string().trim().min(1).optional(),
  /**
   * الإسناد الذي نشأ فيه الدَّين — مادةٌ وفوجٌ وأستاذ.
   *
   * الأستاذ يدرّس أفواجاً، وكشفُ كلِّ فوجٍ ورقتُه. فمتأخّرات الفوج 2
   * تُقرأ في كشوف الفوج 2 وحدها — وإلّا خرجت على ورقة فوجٍ آخر فبدت
   * ديناً له.
   */
  teachingAssignmentId: z.string().trim().min(1).optional(),
  /** التخليصُ الذي حملها في راتبه — به يُقرأ «ما دُفع مع هذا الكشف» */
  collectionSettlementId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
  status: z.enum(["PENDING", "APPROVED", "PAID", "CANCELLED"]).optional(),
});

export const debtShareIdSchema = z.object({
  id: z.string().trim().min(1, "Debt share id is required"),
});

export const cancelDebtShareSchema = z.object({
  reason: z
    .string({ error: "Reason is required" })
    .trim()
    .min(3, "Reason is required")
    .max(500),
});

export type DebtShareQueryInput = z.infer<typeof debtShareQuerySchema>;
export type CancelDebtShareInput = z.infer<typeof cancelDebtShareSchema>;
