"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studyGroupQuerySchema = exports.studyGroupIdSchema = exports.updateStudyGroupSchema = exports.createStudyGroupSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../../../generated/prisma");
// --------------------------------------------------
// Create
// --------------------------------------------------
exports.createStudyGroupSchema = zod_1.z.object({
    levelId: zod_1.z
        .string({ error: "Level is required" })
        .trim()
        .min(1, "Level is required"),
    name: zod_1.z
        .string({ error: "Study group name is required" })
        .trim()
        .min(1, "Name must not be empty")
        .max(50, "Name must not exceed 50 characters"),
    type: zod_1.z
        .enum(prisma_1.StudyGroupType, {
        error: "Type must be NORMAL, ELITE, INTENSIVE or EVENING",
    })
        .optional(),
    maxStudents: zod_1.z.coerce
        .number()
        .int()
        .min(1, "Max students must be at least 1")
        .max(500, "Max students must not exceed 500")
        .nullish(),
    isActive: zod_1.z.boolean().optional(),
});
// --------------------------------------------------
// Update
// --------------------------------------------------
exports.updateStudyGroupSchema = exports.createStudyGroupSchema
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.studyGroupIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Study group id is required"),
});
exports.studyGroupQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().min(1).optional(),
    levelId: zod_1.z.string().trim().min(1).optional(),
    type: zod_1.z.enum(prisma_1.StudyGroupType).optional(),
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
//# sourceMappingURL=study-group.schema.js.map