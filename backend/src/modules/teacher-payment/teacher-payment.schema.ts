import { z } from "zod";

/**
 * إثبات الدفع للأستاذ.
 *
 * التخليص واحدٌ لكل (إسناد + كشف) — أي لكل مادةٍ وفوج. والأستاذ يدرّس
 * عدّة أفواج، فيُدفع له مرّةً واحدة عن كلِّها: دفعةٌ برقمها موزَّعةٌ على
 * تخليصاتها، لا ثلاث عمليّاتٍ وثلاث أوراق.
 */
export const payTeacherSchema = z.object({
  teacherId: z
    .string({ error: "Teacher is required" })
    .trim()
    .min(1, "Teacher is required"),

  /** التخليصات المؤكَّدة التي تُدفع الآن */
  settlementIds: z.array(z.string().trim().min(1)).max(50).default([]),

  /**
   * حصصُ ديونٍ حُصّلت بعد تخليصها — تُدمج في الدفعة نفسها.
   *
   * «راتب الشهر 2 + متأخّرات الشهر 1» ورقةٌ واحدة، والقاعدة تحتفظ
   * بمصدر كل دينار.
   */
  debtShareIds: z.array(z.string().trim().min(1)).max(100).default([]),

  /* نفس ما يقبله `PaymentMethod` في القاعدة — لا صيغة ثانية */
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER"]).default("CASH"),

  /** يوم التسليم — لا يُفترض اليوم: قد تُسجَّل دفعةُ الأمس */
  paymentDate: z.coerce.date().optional(),

  reference: z.string().trim().max(80).nullish(),
  note: z.string().trim().max(500).nullish(),
})
  /* دفعةٌ بلا سطرٍ واحد لا معنى لها */
  .refine((body) => body.settlementIds.length + body.debtShareIds.length > 0, {
    error: "Select at least one settlement or debt share",
  });

export const teacherPaymentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  teacherId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
  status: z.enum(["ACTIVE", "CANCELLED"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const teacherPaymentIdSchema = z.object({
  id: z.string().trim().min(1, "Payment id is required"),
});

export const cancelTeacherPaymentSchema = z.object({
  reason: z
    .string({ error: "Reason is required" })
    .trim()
    .min(3, "Reason is required")
    .max(500),
});

export type PayTeacherInput = z.infer<typeof payTeacherSchema>;
export type TeacherPaymentQueryInput = z.infer<typeof teacherPaymentQuerySchema>;
export type CancelTeacherPaymentInput = z.infer<typeof cancelTeacherPaymentSchema>;
