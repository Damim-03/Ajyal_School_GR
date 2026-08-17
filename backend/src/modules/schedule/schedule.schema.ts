import { z } from "zod";
import { DayOfWeek } from "../../../generated/prisma";

// --------------------------------------------------
// Create
// إسناد تدريسي + يوم + حصة (+ قاعة اختيارية)
// --------------------------------------------------

export const createScheduleSchema = z.object({
  teachingAssignmentId: z
    .string({ error: "Teaching assignment is required" })
    .trim()
    .min(1, "Teaching assignment is required"),

  lessonSlotId: z
    .string({ error: "Lesson slot is required" })
    .trim()
    .min(1, "Lesson slot is required"),

  dayOfWeek: z.enum(DayOfWeek, {
    error: "Day must be SATURDAY, SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY or FRIDAY",
  }),

  // اختيارية — قد تُحدَّد القاعة لاحقاً
  classroomId: z.string().trim().min(1).nullish(),

  isActive: z.boolean().optional(),
});

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateScheduleSchema = createScheduleSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const scheduleIdSchema = z.object({
  id: z.string().trim().min(1, "Schedule id is required"),
});

export const scheduleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  teachingAssignmentId: z.string().trim().min(1).optional(),
  classroomId: z.string().trim().min(1).optional(),
  lessonSlotId: z.string().trim().min(1).optional(),
  dayOfWeek: z.enum(DayOfWeek).optional(),
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

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type ScheduleQueryInput = z.infer<typeof scheduleQuerySchema>;
