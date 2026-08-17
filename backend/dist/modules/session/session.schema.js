"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionQuerySchema = exports.sessionIdSchema = exports.updateSessionSchema = exports.generateSessionsSchema = exports.createSessionSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../../../generated/prisma");
// --------------------------------------------------
// Create — حصة واحدة يدوياً
//
// lessonNumber اختياري: يُحسب تلقائياً (آخر رقم في هذا
// الجدول + 1) وهو المتوقَّع في الاستعمال العادي.
// --------------------------------------------------
exports.createSessionSchema = zod_1.z.object({
    scheduleId: zod_1.z
        .string({ error: "Schedule is required" })
        .trim()
        .min(1, "Schedule is required"),
    sessionDate: zod_1.z.coerce.date({ error: "Session date is required" }),
    lessonNumber: zod_1.z.coerce.number().int().min(1).optional(),
    status: zod_1.z.enum(prisma_1.SessionStatus).optional(),
    note: zod_1.z.string().trim().max(500).nullish(),
    /** الكشف الذي تنتمي إليه — الحصة المنشأة من داخل كشفٍ تحمله */
    sheetId: zod_1.z.string().trim().min(1).nullish(),
});
// --------------------------------------------------
// Generate — توليد الحصص من الجدول الأسبوعي
//
// لكل جدول: كل تاريخ بين startDate و endDate يوافق
// يوم الجدول يُنتج حصة، ما لم يكن في skipDates
// أو له حصة مسجَّلة سلفاً.
// --------------------------------------------------
exports.generateSessionsSchema = zod_1.z
    .object({
    scheduleIds: zod_1.z
        .array(zod_1.z.string().trim().min(1), { error: "Schedules are required" })
        .min(1, "At least one schedule must be selected")
        .max(100, "Cannot generate for more than 100 schedules at once")
        .transform((ids) => [...new Set(ids)]),
    startDate: zod_1.z.coerce.date({ error: "Start date is required" }),
    endDate: zod_1.z.coerce.date({ error: "End date is required" }),
    // العطل والأيام المستثناة
    skipDates: zod_1.z.array(zod_1.z.coerce.date()).max(100).optional(),
})
    .refine((body) => body.endDate >= body.startDate, {
    error: "End date must not be before start date",
    path: ["endDate"],
})
    .refine((body) => {
    const days = (body.endDate.getTime() - body.startDate.getTime()) /
        (24 * 60 * 60 * 1000);
    return days <= 366;
}, { error: "Date range must not exceed 366 days", path: ["endDate"] });
// --------------------------------------------------
// Update
// --------------------------------------------------
exports.updateSessionSchema = zod_1.z
    .object({
    sessionDate: zod_1.z.coerce.date(),
    lessonNumber: zod_1.z.coerce.number().int().min(1),
    status: zod_1.z.enum(prisma_1.SessionStatus),
    note: zod_1.z.string().trim().max(500).nullish(),
    /**
     * ضمُّ الحصة إلى كشف — أو فكُّها منه بـ null.
     *
     * كان غيابُه طريقاً مسدوداً: حذفُ الكشف يفكّ حصصه ولا يمحوها
     * (وهو الصواب — الحضور المسجَّل لا يضيع بحذف ورقة إدارية)، لكنّ
     * الحصة المفكوكة كانت تبقى كذلك أبداً. تحجز تاريخها فيُرفض إنشاء
     * عمودٍ جديد عليه، ولا سبيل إلى ضمّها إلى كشفٍ قائم.
     */
    sheetId: zod_1.z.string().trim().min(1).nullish(),
})
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.sessionIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Session id is required"),
});
exports.sessionQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    scheduleId: zod_1.z.string().trim().min(1).optional(),
    /** كل جداول إسنادٍ تدريسي — أضيق من المادة والأستاذ والفوج مجتمعةً */
    teachingAssignmentId: zod_1.z.string().trim().min(1).optional(),
    status: zod_1.z.enum(prisma_1.SessionStatus).optional(),
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
    teacherId: zod_1.z.string().trim().min(1).optional(),
    subjectId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
});
//# sourceMappingURL=session.schema.js.map