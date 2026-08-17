"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceQuerySchema = exports.attendanceSessionIdSchema = exports.attendanceIdSchema = exports.updateAttendanceSchema = exports.bulkAttendanceSchema = exports.createAttendanceSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../../../generated/prisma");
// --------------------------------------------------
// Create — سجل واحد
// --------------------------------------------------
exports.createAttendanceSchema = zod_1.z.object({
    sessionId: zod_1.z
        .string({ error: "Session is required" })
        .trim()
        .min(1, "Session is required"),
    studentEnrollmentId: zod_1.z
        .string({ error: "Enrollment is required" })
        .trim()
        .min(1, "Enrollment is required"),
    status: zod_1.z.enum(prisma_1.AttendanceStatus).optional(),
    note: zod_1.z.string().trim().max(500).nullish(),
});
// --------------------------------------------------
// Bulk — تسجيل الفوج كاملاً في حصة واحدة
//
// الاستعمال المعتاد: يُرسل الأساتذة قائمة الاستثناءات
// (الغائبون والمتأخرون) مع markRemainingAs = PRESENT
// فيُسجَّل الباقي حاضرين تلقائياً.
//
// إعادة الإرسال تُحدِّث السجلات القائمة (upsert)،
// فتصحيح ورقة الحضور لا يحتاج حذفاً.
// --------------------------------------------------
exports.bulkAttendanceSchema = zod_1.z
    .object({
    sessionId: zod_1.z
        .string({ error: "Session is required" })
        .trim()
        .min(1, "Session is required"),
    records: zod_1.z
        .array(zod_1.z.object({
        studentEnrollmentId: zod_1.z.string().trim().min(1),
        status: zod_1.z.enum(prisma_1.AttendanceStatus),
        note: zod_1.z.string().trim().max(500).nullish(),
    }))
        .max(200, "Cannot mark more than 200 students at once")
        .optional(),
    // يُطبَّق على كل مسجَّل نشط لا سجل له بعد
    markRemainingAs: zod_1.z.enum(prisma_1.AttendanceStatus).optional(),
})
    .refine((body) => (body.records && body.records.length > 0) ||
    body.markRemainingAs !== undefined, { error: "Provide records, markRemainingAs, or both" })
    .refine((body) => {
    if (!body.records)
        return true;
    const ids = body.records.map((r) => r.studentEnrollmentId);
    return new Set(ids).size === ids.length;
}, { error: "Duplicate enrollment in records", path: ["records"] });
// --------------------------------------------------
// Update
// --------------------------------------------------
exports.updateAttendanceSchema = zod_1.z
    .object({
    status: zod_1.z.enum(prisma_1.AttendanceStatus),
    note: zod_1.z.string().trim().max(500).nullish(),
})
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.attendanceIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Attendance id is required"),
});
exports.attendanceSessionIdSchema = zod_1.z.object({
    sessionId: zod_1.z.string().trim().min(1, "Session id is required"),
});
exports.attendanceQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(20),
    sessionId: zod_1.z.string().trim().min(1).optional(),
    studentEnrollmentId: zod_1.z.string().trim().min(1).optional(),
    studentId: zod_1.z.string().trim().min(1).optional(),
    status: zod_1.z.enum(prisma_1.AttendanceStatus).optional(),
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
    teachingAssignmentId: zod_1.z.string().trim().min(1).optional(),
    subjectId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
});
//# sourceMappingURL=attendance.schema.js.map