import { z } from "zod";

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createAcademicYearSchema = z
  .object({
    name: z
      .string({ error: "Academic year name is required" })
      .trim()
      .min(4, "Name must be at least 4 characters")
      .max(50, "Name must not exceed 50 characters"),

    startDate: z.coerce.date({ error: "Start date is required" }),

    endDate: z.coerce.date({ error: "End date is required" }),

    // تعيينها true ينزع العلم عن باقي السنوات
    isCurrent: z.boolean().optional(),

    isActive: z.boolean().optional(),

    // سقف حصص الشهر لكل مادة — سياسة هذه السنة
    sessionsPerMonth: z.coerce
      .number()
      .int()
      .min(1, "Sessions per month must be at least 1")
      .max(31, "Sessions per month must not exceed 31")
      .optional(),
  })
  .refine((body) => body.endDate > body.startDate, {
    error: "End date must be after start date",
    path: ["endDate"],
  });

// --------------------------------------------------
// Update
//
// المقارنة بين التاريخين تتم في الـ service لأن الطلب
// قد يحمل تاريخاً واحداً فقط ويُقارن بالمخزَّن.
// --------------------------------------------------

export const updateAcademicYearSchema = z
  .object({
    name: z.string().trim().min(4).max(50),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isCurrent: z.boolean(),
    isActive: z.boolean(),
    sessionsPerMonth: z.coerce.number().int().min(1).max(31),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const academicYearIdSchema = z.object({
  id: z.string().trim().min(1, "Academic year id is required"),
});

export const academicYearQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  isCurrent: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;
export type AcademicYearQueryInput = z.infer<typeof academicYearQuerySchema>;
