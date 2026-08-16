"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.levelQuerySchema = exports.levelIdSchema = exports.updateLevelSchema = exports.createLevelSchema = void 0;
const zod_1 = require("zod");
// --------------------------------------------------
// Create
// --------------------------------------------------
exports.createLevelSchema = zod_1.z.object({
    educationStageId: zod_1.z
        .string({ error: "Education stage is required" })
        .trim()
        .min(1, "Education stage is required"),
    name: zod_1.z
        .string({ error: "Level name is required" })
        .trim()
        .min(1, "Name must not be empty")
        .max(50, "Name must not exceed 50 characters"),
    // اختياري — يُحسب داخل نفس الطور
    sortOrder: zod_1.z.coerce.number().int().min(0).optional(),
    isActive: zod_1.z.boolean().optional(),
});
// --------------------------------------------------
// Update
// --------------------------------------------------
exports.updateLevelSchema = exports.createLevelSchema
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.levelIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Level id is required"),
});
exports.levelQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().min(1).optional(),
    educationStageId: zod_1.z.string().trim().min(1).optional(),
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
//# sourceMappingURL=level.schema.js.map