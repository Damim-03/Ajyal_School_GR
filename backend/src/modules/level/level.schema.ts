import { z } from "zod";

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createLevelSchema = z.object({
  educationStageId: z
    .string({ error: "Education stage is required" })
    .trim()
    .min(1, "Education stage is required"),

  name: z
    .string({ error: "Level name is required" })
    .trim()
    .min(1, "Name must not be empty")
    .max(50, "Name must not exceed 50 characters"),

  // اختياري — يُحسب داخل نفس الطور
  sortOrder: z.coerce.number().int().min(0).optional(),

  isActive: z.boolean().optional(),
});

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateLevelSchema = createLevelSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const levelIdSchema = z.object({
  id: z.string().trim().min(1, "Level id is required"),
});

export const levelQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  educationStageId: z.string().trim().min(1).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateLevelInput = z.infer<typeof createLevelSchema>;
export type UpdateLevelInput = z.infer<typeof updateLevelSchema>;
export type LevelQueryInput = z.infer<typeof levelQuerySchema>;
