"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teachingAssignmentQuerySchema = exports.teachingAssignmentIdSchema = exports.updateTeachingAssignmentSchema = exports.createTeachingAssignmentSchema = void 0;
const zod_1 = require("zod");
// --------------------------------------------------
// Create
// أستاذ + مادة + فوج + سنة دراسية
// --------------------------------------------------
exports.createTeachingAssignmentSchema = zod_1.z.object({
    teacherId: zod_1.z
        .string({ error: "Teacher is required" })
        .trim()
        .min(1, "Teacher is required"),
    subjectId: zod_1.z
        .string({ error: "Subject is required" })
        .trim()
        .min(1, "Subject is required"),
    studyGroupId: zod_1.z
        .string({ error: "Study group is required" })
        .trim()
        .min(1, "Study group is required"),
    academicYearId: zod_1.z
        .string({ error: "Academic year is required" })
        .trim()
        .min(1, "Academic year is required"),
    isActive: zod_1.z.boolean().optional(),
});
// --------------------------------------------------
// Update
// --------------------------------------------------
exports.updateTeachingAssignmentSchema = exports.createTeachingAssignmentSchema
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.teachingAssignmentIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Teaching assignment id is required"),
});
exports.teachingAssignmentQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    teacherId: zod_1.z.string().trim().min(1).optional(),
    subjectId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
//# sourceMappingURL=teaching-assignment.schema.js.map