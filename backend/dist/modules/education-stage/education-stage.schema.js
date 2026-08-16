"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.educationStageQuerySchema = exports.educationStageIdSchema = exports.updateEducationStageSchema = exports.createEducationStageSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../../generated/prisma");
// --------------------------------------------------
// Create
// sortOrder اختياري — يُحسب تلقائياً (آخر ترتيب + 1)
// --------------------------------------------------
exports.createEducationStageSchema = zod_1.z.object({
    name: zod_1.z
        .string({ error: "Stage name is required" })
        .trim()
        .min(2, "Name must be at least 2 characters")
        .max(50, "Name must not exceed 50 characters"),
    type: zod_1.z.enum(prisma_1.EducationStageType, {
        error: "Type must be PRIMARY, MIDDLE or SECONDARY",
    }),
    sortOrder: zod_1.z.coerce.number().int().min(0).optional(),
    isActive: zod_1.z.boolean().optional(),
});
// --------------------------------------------------
// Update
// --------------------------------------------------
exports.updateEducationStageSchema = exports.createEducationStageSchema
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.educationStageIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Education stage id is required"),
});
exports.educationStageQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().min(1).optional(),
    type: zod_1.z.enum(prisma_1.EducationStageType).optional(),
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
//# sourceMappingURL=education-stage.schema.js.map