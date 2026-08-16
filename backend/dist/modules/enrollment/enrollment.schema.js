"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrollmentQuerySchema = exports.enrollmentIdSchema = exports.transferEnrollmentSchema = exports.updateEnrollmentSchema = exports.createEnrollmentSchema = void 0;
const zod_1 = require("zod");
// --------------------------------------------------
// Create — تسجيل الطالب في عدة مواد دفعة واحدة
//
// كل عنصر في teachingAssignmentIds يُنتج StudentEnrollment.
// العملية ذرّية: إما تنجح كلها أو لا يُسجَّل شيء.
// --------------------------------------------------
exports.createEnrollmentSchema = zod_1.z.object({
    studentId: zod_1.z
        .string({ error: "Student is required" })
        .trim()
        .min(1, "Student is required"),
    teachingAssignmentIds: zod_1.z
        .array(zod_1.z.string().trim().min(1), {
        error: "Teaching assignments are required",
    })
        .min(1, "At least one teaching assignment must be selected")
        .max(20, "Cannot enroll in more than 20 subjects at once")
        // نزيل التكرار داخل الطلب نفسه
        .transform((ids) => [...new Set(ids)]),
    enrolledAt: zod_1.z.coerce.date().optional(),
});
// --------------------------------------------------
// Update — على تسجيل واحد
// المفتاح (طالب + إسناد) لا يُعدَّل: يُحذف ويُعاد إنشاؤه
// --------------------------------------------------
exports.updateEnrollmentSchema = zod_1.z
    .object({
    isActive: zod_1.z.boolean(),
    enrolledAt: zod_1.z.coerce.date(),
})
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Transfer — نقل الطالب من فوج إلى فوج
//
// وجهةٌ واحدة لا قائمة: النقل حركةٌ من موضعٍ إلى موضع، وقبولُ عدّة
// وجهات يجعله إسناداً جماعياً بثوب آخر.
// --------------------------------------------------
exports.transferEnrollmentSchema = zod_1.z.object({
    teachingAssignmentId: zod_1.z
        .string({ error: "Target teaching assignment is required" })
        .trim()
        .min(1, "Target teaching assignment is required"),
    enrolledAt: zod_1.z.coerce.date().optional(),
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.enrollmentIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Enrollment id is required"),
});
exports.enrollmentQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    studentId: zod_1.z.string().trim().min(1).optional(),
    teachingAssignmentId: zod_1.z.string().trim().min(1).optional(),
    subjectId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
    teacherId: zod_1.z.string().trim().min(1).optional(),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
//# sourceMappingURL=enrollment.schema.js.map