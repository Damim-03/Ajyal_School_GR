"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subjectQuerySchema = exports.subjectIdSchema = exports.updateSubjectSchema = exports.createSubjectSchema = void 0;
const zod_1 = require("zod");
// --------------------------------------------------
// Create
// --------------------------------------------------
exports.createSubjectSchema = zod_1.z.object({
    name: zod_1.z
        .string({ error: "Subject name is required" })
        .trim()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name must not exceed 100 characters"),
    code: zod_1.z
        .string()
        .trim()
        .min(1, "Code must not be empty")
        .max(20, "Code must not exceed 20 characters")
        .nullish(),
    description: zod_1.z
        .string()
        .trim()
        .max(500, "Description must not exceed 500 characters")
        .nullish(),
    // لون للعرض في الواجهة — hex
    color: zod_1.z
        .string()
        .trim()
        .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a hex value like #3B82F6")
        .nullish(),
    /** صورةُ المادة — مسارٌ من /api/uploads، تُعرض في مربّعها */
    imagePath: zod_1.z.string().trim().max(255).nullish(),
    isActive: zod_1.z.boolean().optional(),
});
// --------------------------------------------------
// Update — كل الحقول اختيارية مع رفض الجسم الفارغ
// --------------------------------------------------
exports.updateSubjectSchema = exports.createSubjectSchema
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params
// --------------------------------------------------
exports.subjectIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Subject id is required"),
});
// --------------------------------------------------
// Query — قائمة المواد
// --------------------------------------------------
exports.subjectQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().min(1).optional(),
    // يصل كنص من query string
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
//# sourceMappingURL=subject.schema.js.map