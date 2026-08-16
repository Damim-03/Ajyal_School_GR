import { z } from "zod";

// --------------------------------------------------
// Create
// أستاذ + مادة + فوج + سنة دراسية
// --------------------------------------------------

export const createTeachingAssignmentSchema = z.object({
  teacherId: z
    .string({ error: "Teacher is required" })
    .trim()
    .min(1, "Teacher is required"),

  subjectId: z
    .string({ error: "Subject is required" })
    .trim()
    .min(1, "Subject is required"),

  studyGroupId: z
    .string({ error: "Study group is required" })
    .trim()
    .min(1, "Study group is required"),

  academicYearId: z
    .string({ error: "Academic year is required" })
    .trim()
    .min(1, "Academic year is required"),

  isActive: z.boolean().optional(),
});

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateTeachingAssignmentSchema = createTeachingAssignmentSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const teachingAssignmentIdSchema = z.object({
  id: z.string().trim().min(1, "Teaching assignment id is required"),
});

export const teachingAssignmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  teacherId: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional(),
  studyGroupId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateTeachingAssignmentInput = z.infer<
  typeof createTeachingAssignmentSchema
>;
export type UpdateTeachingAssignmentInput = z.infer<
  typeof updateTeachingAssignmentSchema
>;
export type TeachingAssignmentQueryInput = z.infer<
  typeof teachingAssignmentQuerySchema
>;
