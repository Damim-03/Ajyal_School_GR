"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sheetQuerySchema = exports.sheetIdSchema = exports.updateSheetSchema = exports.createSheetSchema = void 0;
const zod_1 = require("zod");
// --------------------------------------------------
// Create
//
// عدد الأعمدة لا يُرسَل عادةً: يُنسخ عن سياسة السنة الدراسية لحظة
// الإنشاء. وإرسالُه يبقى ممكناً لكشفٍ استثنائي.
// --------------------------------------------------
exports.createSheetSchema = zod_1.z.object({
    teachingAssignmentId: zod_1.z
        .string({ error: "Teaching assignment is required" })
        .trim()
        .min(1, "Teaching assignment is required"),
    /** يُحسب تلقائياً (آخر رقم في هذا الإسناد + 1) إن تُرك */
    number: zod_1.z.coerce.number().int().min(1).max(99).optional(),
    label: zod_1.z.string().trim().max(60).nullish(),
    sessionCount: zod_1.z.coerce.number().int().min(1).max(31).optional(),
    note: zod_1.z.string().trim().max(500).nullish(),
    /** حصص قائمة تُضمّ إلى الكشف عند إنشائه */
    adoptSessionIds: zod_1.z.array(zod_1.z.string().trim().min(1)).max(31).optional(),
});
// --------------------------------------------------
// Update
// --------------------------------------------------
exports.updateSheetSchema = zod_1.z
    .object({
    number: zod_1.z.coerce.number().int().min(1).max(99),
    label: zod_1.z.string().trim().max(60).nullish(),
    sessionCount: zod_1.z.coerce.number().int().min(1).max(31),
    note: zod_1.z.string().trim().max(500).nullish(),
})
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.sheetIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Sheet id is required"),
});
exports.sheetQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    /** رمزُ الورقة الممسوح — يُفرد كشفاً واحداً */
    code: zod_1.z.string().trim().min(1).max(20).optional(),
    teachingAssignmentId: zod_1.z.string().trim().min(1).optional(),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    subjectId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
    teacherId: zod_1.z.string().trim().min(1).optional(),
});
//# sourceMappingURL=attendance-sheet.schema.js.map