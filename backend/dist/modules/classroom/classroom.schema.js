"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classroomQuerySchema = exports.classroomIdSchema = exports.updateClassroomSchema = exports.createClassroomSchema = void 0;
const zod_1 = require("zod");
// --------------------------------------------------
// Create
// --------------------------------------------------
exports.createClassroomSchema = zod_1.z.object({
    name: zod_1.z
        .string({ error: "Classroom name is required" })
        .trim()
        .min(1, "Name must not be empty")
        .max(50, "Name must not exceed 50 characters"),
    code: zod_1.z
        .string()
        .trim()
        .min(1, "Code must not be empty")
        .max(20, "Code must not exceed 20 characters")
        .nullish(),
    capacity: zod_1.z.coerce
        .number()
        .int()
        .min(1, "Capacity must be at least 1")
        .max(500, "Capacity must not exceed 500")
        .nullish(),
    floor: zod_1.z.coerce
        .number()
        .int()
        .min(-5, "Floor must be at least -5")
        .max(50, "Floor must not exceed 50")
        .nullish(),
    description: zod_1.z
        .string()
        .trim()
        .max(500, "Description must not exceed 500 characters")
        .nullish(),
    isActive: zod_1.z.boolean().optional(),
});
// --------------------------------------------------
// Update
// --------------------------------------------------
exports.updateClassroomSchema = exports.createClassroomSchema
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.classroomIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Classroom id is required"),
});
exports.classroomQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().min(1).optional(),
    floor: zod_1.z.coerce.number().int().optional(),
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
//# sourceMappingURL=classroom.schema.js.map