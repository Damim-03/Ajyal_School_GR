"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expectedSessionsReportQuerySchema = exports.sessionClearanceReportQuerySchema = exports.monthlyFeesReportQuerySchema = exports.dailyAttendanceReportQuerySchema = exports.attendanceReportQuerySchema = exports.outstandingReportQuerySchema = exports.financialReportQuerySchema = void 0;
const zod_1 = require("zod");
// --------------------------------------------------
// Financial
// --------------------------------------------------
exports.financialReportQuerySchema = zod_1.z.object({
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
    // التقرير اليومي والشهري والسنوي تقريرٌ واحد بثلاث دقّات:
    // الفرق بينها التجميع لا البيانات.
    groupBy: zod_1.z.enum(["day", "month", "year"]).default("month"),
});
// --------------------------------------------------
// Outstanding — الفواتير غير المسدَّدة
// --------------------------------------------------
exports.outstandingReportQuerySchema = zod_1.z.object({
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
    // المتأخرة فقط (تجاوزت تاريخ الاستحقاق)
    overdueOnly: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(500).default(100),
});
// --------------------------------------------------
// Attendance
// --------------------------------------------------
exports.attendanceReportQuerySchema = zod_1.z.object({
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
    subjectId: zod_1.z.string().trim().min(1).optional(),
    studentId: zod_1.z.string().trim().min(1).optional(),
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
});
// --------------------------------------------------
// Daily attendance — كشف الحضور اليومي
//
// يومٌ واحد إلزامي: الكشف ورقةُ يومٍ تُطبع وتُوقَّع،
// لا تجميعُ مدى تاريخي.
// --------------------------------------------------
exports.dailyAttendanceReportQuerySchema = zod_1.z.object({
    date: zod_1.z.coerce.date({ error: "Date is required" }),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
    subjectId: zod_1.z.string().trim().min(1).optional(),
    teacherId: zod_1.z.string().trim().min(1).optional(),
});
// --------------------------------------------------
// Monthly fees — كشف الحقوق الشهرية
// --------------------------------------------------
const monthField = zod_1.z.coerce
    .number()
    .int()
    .min(1, "Month must be between 1 and 12")
    .max(12, "Month must be between 1 and 12");
const yearField = zod_1.z.coerce
    .number()
    .int()
    .min(2000, "Year must be 2000 or later")
    .max(2100, "Year must be 2100 or earlier");
exports.monthlyFeesReportQuerySchema = zod_1.z.object({
    month: monthField,
    year: yearField,
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
    studentId: zod_1.z.string().trim().min(1).optional(),
    // PENDING / PARTIAL / PAID — لعرض غير المسدَّد وحده مثلاً
    status: zod_1.z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
});
// --------------------------------------------------
// Session clearance — كشف التخليص اليومي للحصص
// --------------------------------------------------
exports.sessionClearanceReportQuerySchema = zod_1.z.object({
    date: zod_1.z.coerce.date({ error: "Date is required" }),
    teacherId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
});
// --------------------------------------------------
// Expected sessions — الكشف التقديري للحصص
//
// المتوقَّع يُشتقّ من الجدول الأسبوعي بعدّ أيام الأسبوع
// في المدى، ويُقابَل بما وقع فعلاً في جدول Session.
// --------------------------------------------------
exports.expectedSessionsReportQuerySchema = zod_1.z.object({
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    dateFrom: zod_1.z.coerce.date({ error: "Start date is required" }),
    dateTo: zod_1.z.coerce.date({ error: "End date is required" }),
    teacherId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
});
//# sourceMappingURL=report.schema.js.map