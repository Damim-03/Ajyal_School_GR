import { z } from "zod";

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createSubjectSchema = z.object({
  name: z
    .string({ error: "Subject name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters"),

  code: z
    .string()
    .trim()
    .min(1, "Code must not be empty")
    .max(20, "Code must not exceed 20 characters")
    .nullish(),

  description: z
    .string()
    .trim()
    .max(500, "Description must not exceed 500 characters")
    .nullish(),

  // لون للعرض في الواجهة — hex
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a hex value like #3B82F6")
    .nullish(),

  /** صورةُ المادة — مسارٌ من /api/uploads، تُعرض في مربّعها */
  imagePath: z.string().trim().max(255).nullish(),

  isActive: z.boolean().optional(),
});

// --------------------------------------------------
// Update — كل الحقول اختيارية مع رفض الجسم الفارغ
// --------------------------------------------------

export const updateSubjectSchema = createSubjectSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params
// --------------------------------------------------

export const subjectIdSchema = z.object({
  id: z.string().trim().min(1, "Subject id is required"),
});

// --------------------------------------------------
// Query — قائمة المواد
// --------------------------------------------------

export const subjectQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  search: z.string().trim().min(1).optional(),

  // يصل كنص من query string
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type SubjectIdParams = z.infer<typeof subjectIdSchema>;
export type SubjectQueryInput = z.infer<typeof subjectQuerySchema>;
