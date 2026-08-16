"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.academicYearQuerySchema = exports.academicYearIdSchema = exports.updateAcademicYearSchema = exports.createAcademicYearSchema = void 0;
const zod_1 = require("zod");
// --------------------------------------------------
// Create
// --------------------------------------------------
exports.createAcademicYearSchema = zod_1.z
    .object({
    name: zod_1.z
        .string({ error: "Academic year name is required" })
        .trim()
        .min(4, "Name must be at least 4 characters")
        .max(50, "Name must not exceed 50 characters"),
    startDate: zod_1.z.coerce.date({ error: "Start date is required" }),
    endDate: zod_1.z.coerce.date({ error: "End date is required" }),
    // تعيينها true ينزع العلم عن باقي السنوات
    isCurrent: zod_1.z.boolean().optional(),
    isActive: zod_1.z.boolean().optional(),
    // سقف حصص الشهر لكل مادة — سياسة هذه السنة
    sessionsPerMonth: zod_1.z.coerce
        .number()
        .int()
        .min(1, "Sessions per month must be at least 1")
        .max(31, "Sessions per month must not exceed 31")
        .optional(),
})
    .refine((body) => body.endDate > body.startDate, {
    error: "End date must be after start date",
    path: ["endDate"],
});
// --------------------------------------------------
// Update
//
// المقارنة بين التاريخين تتم في الـ service لأن الطلب
// قد يحمل تاريخاً واحداً فقط ويُقارن بالمخزَّن.
// --------------------------------------------------
exports.updateAcademicYearSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(4).max(50),
    startDate: zod_1.z.coerce.date(),
    endDate: zod_1.z.coerce.date(),
    isCurrent: zod_1.z.boolean(),
    isActive: zod_1.z.boolean(),
    sessionsPerMonth: zod_1.z.coerce.number().int().min(1).max(31),
})
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.academicYearIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Academic year id is required"),
});
exports.academicYearQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().min(1).optional(),
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
    isCurrent: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
//# sourceMappingURL=academic-year.schema.js.map