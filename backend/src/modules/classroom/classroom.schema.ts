import { z } from "zod";

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createClassroomSchema = z.object({
  name: z
    .string({ error: "Classroom name is required" })
    .trim()
    .min(1, "Name must not be empty")
    .max(50, "Name must not exceed 50 characters"),

  code: z
    .string()
    .trim()
    .min(1, "Code must not be empty")
    .max(20, "Code must not exceed 20 characters")
    .nullish(),

  capacity: z.coerce
    .number()
    .int()
    .min(1, "Capacity must be at least 1")
    .max(500, "Capacity must not exceed 500")
    .nullish(),

  floor: z.coerce
    .number()
    .int()
    .min(-5, "Floor must be at least -5")
    .max(50, "Floor must not exceed 50")
    .nullish(),

  description: z
    .string()
    .trim()
    .max(500, "Description must not exceed 500 characters")
    .nullish(),

  isActive: z.boolean().optional(),
});

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateClassroomSchema = createClassroomSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const classroomIdSchema = z.object({
  id: z.string().trim().min(1, "Classroom id is required"),
});

export const classroomQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  floor: z.coerce.number().int().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;
export type UpdateClassroomInput = z.infer<typeof updateClassroomSchema>;
export type ClassroomQueryInput = z.infer<typeof classroomQuerySchema>;
