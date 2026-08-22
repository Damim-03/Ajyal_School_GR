import { z } from "zod";

// --------------------------------------------------
// Create — تسجيل الطالب في عدة مواد دفعة واحدة
//
// كل عنصر في teachingAssignmentIds يُنتج StudentEnrollment.
// العملية ذرّية: إما تنجح كلها أو لا يُسجَّل شيء.
// --------------------------------------------------

export const createEnrollmentSchema = z.object({
  studentId: z
    .string({ error: "Student is required" })
    .trim()
    .min(1, "Student is required"),

  teachingAssignmentIds: z
    .array(z.string().trim().min(1), {
      error: "Teaching assignments are required",
    })
    .min(1, "At least one teaching assignment must be selected")
    .max(20, "Cannot enroll in more than 20 subjects at once")
    // نزيل التكرار داخل الطلب نفسه
    .transform((ids) => [...new Set(ids)]),

  enrolledAt: z.coerce.date().optional(),
});

// --------------------------------------------------
// Update — على تسجيل واحد
// المفتاح (طالب + إسناد) لا يُعدَّل: يُحذف ويُعاد إنشاؤه
// --------------------------------------------------

export const updateEnrollmentSchema = z
  .object({
    isActive: z.boolean(),
    enrolledAt: z.coerce.date(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Transfer — نقل الطالب من فوج إلى فوج
//
// وجهةٌ واحدة لا قائمة: النقل حركةٌ من موضعٍ إلى موضع، وقبولُ عدّة
// وجهات يجعله إسناداً جماعياً بثوب آخر.
// --------------------------------------------------

export const transferEnrollmentSchema = z.object({
  teachingAssignmentId: z
    .string({ error: "Target teaching assignment is required" })
    .trim()
    .min(1, "Target teaching assignment is required"),

  enrolledAt: z.coerce.date().optional(),

  /**
   * تأجيلُ السريان إلى أوّل كشفٍ جديد بدل النقل الآن.
   *
   * الطالب يبقى في فوجه القديم إلى آخر حصةٍ في الكشف الجاري ويُفوتَر
   * شهرَه كاملاً هناك، ثمّ يُنقل من نفسه حين يُفتح الكشف التالي —
   * فلا يُقسَّم شهرٌ بين فوجين ولا يُختلف في حسابه.
   */
  defer: z.boolean().default(false),
});

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const enrollmentIdSchema = z.object({
  id: z.string().trim().min(1, "Enrollment id is required"),
});

export const enrollmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  studentId: z.string().trim().min(1).optional(),
  teachingAssignmentId: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional(),
  studyGroupId: z.string().trim().min(1).optional(),
  teacherId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;
export type TransferEnrollmentInput = z.infer<typeof transferEnrollmentSchema>;
export type EnrollmentQueryInput = z.infer<typeof enrollmentQuerySchema>;
