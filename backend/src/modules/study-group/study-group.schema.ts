import { z } from "zod";
import { StudyGroupType } from "../../generated/prisma";

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createStudyGroupSchema = z.object({
  levelId: z
    .string({ error: "Level is required" })
    .trim()
    .min(1, "Level is required"),

  name: z
    .string({ error: "Study group name is required" })
    .trim()
    .min(1, "Name must not be empty")
    .max(50, "Name must not exceed 50 characters"),

  type: z
    .enum(StudyGroupType, {
      error: "Type must be NORMAL, ELITE, INTENSIVE or EVENING",
    })
    .optional(),

  maxStudents: z.coerce
    .number()
    .int()
    .min(1, "Max students must be at least 1")
    .max(500, "Max students must not exceed 500")
    .nullish(),

  isActive: z.boolean().optional(),
});

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateStudyGroupSchema = createStudyGroupSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const studyGroupIdSchema = z.object({
  id: z.string().trim().min(1, "Study group id is required"),
});

export const studyGroupQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  levelId: z.string().trim().min(1).optional(),
  type: z.enum(StudyGroupType).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateStudyGroupInput = z.infer<typeof createStudyGroupSchema>;
export type UpdateStudyGroupInput = z.infer<typeof updateStudyGroupSchema>;
export type StudyGroupQueryInput = z.infer<typeof studyGroupQuerySchema>;
