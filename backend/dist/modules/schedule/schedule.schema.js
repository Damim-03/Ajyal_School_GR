"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleQuerySchema = exports.scheduleIdSchema = exports.updateScheduleSchema = exports.createScheduleSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../../generated/prisma");
// --------------------------------------------------
// Create
// إسناد تدريسي + يوم + حصة (+ قاعة اختيارية)
// --------------------------------------------------
exports.createScheduleSchema = zod_1.z.object({
    teachingAssignmentId: zod_1.z
        .string({ error: "Teaching assignment is required" })
        .trim()
        .min(1, "Teaching assignment is required"),
    lessonSlotId: zod_1.z
        .string({ error: "Lesson slot is required" })
        .trim()
        .min(1, "Lesson slot is required"),
    dayOfWeek: zod_1.z.enum(prisma_1.DayOfWeek, {
        error: "Day must be SATURDAY, SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY or FRIDAY",
    }),
    // اختيارية — قد تُحدَّد القاعة لاحقاً
    classroomId: zod_1.z.string().trim().min(1).nullish(),
    isActive: zod_1.z.boolean().optional(),
});
// --------------------------------------------------
// Update
// --------------------------------------------------
exports.updateScheduleSchema = exports.createScheduleSchema
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.scheduleIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Schedule id is required"),
});
exports.scheduleQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    teachingAssignmentId: zod_1.z.string().trim().min(1).optional(),
    classroomId: zod_1.z.string().trim().min(1).optional(),
    lessonSlotId: zod_1.z.string().trim().min(1).optional(),
    dayOfWeek: zod_1.z.enum(prisma_1.DayOfWeek).optional(),
    teacherId: zod_1.z.string().trim().min(1).optional(),
    subjectId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
//# sourceMappingURL=schedule.schema.js.map