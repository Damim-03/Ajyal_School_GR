import { z } from "zod";
import { EducationStageType } from "../../generated/prisma";

// --------------------------------------------------
// Create
// sortOrder اختياري — يُحسب تلقائياً (آخر ترتيب + 1)
// --------------------------------------------------

export const createEducationStageSchema = z.object({
  name: z
    .string({ error: "Stage name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must not exceed 50 characters"),

  type: z.enum(EducationStageType, {
    error: "Type must be PRIMARY, MIDDLE or SECONDARY",
  }),

  sortOrder: z.coerce.number().int().min(0).optional(),

  isActive: z.boolean().optional(),
});

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateEducationStageSchema = createEducationStageSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const educationStageIdSchema = z.object({
  id: z.string().trim().min(1, "Education stage id is required"),
});

export const educationStageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  type: z.enum(EducationStageType).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateEducationStageInput = z.infer<
  typeof createEducationStageSchema
>;
export type UpdateEducationStageInput = z.infer<
  typeof updateEducationStageSchema
>;
export type EducationStageQueryInput = z.infer<
  typeof educationStageQuerySchema
>;
