import { z } from "zod";

// --------------------------------------------------
// Financial
// --------------------------------------------------

export const financialReportQuerySchema = z.object({
  academicYearId: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  // التقرير اليومي والشهري والسنوي تقريرٌ واحد بثلاث دقّات:
  // الفرق بينها التجميع لا البيانات.
  groupBy: z.enum(["day", "month", "year"]).default("month"),
});

// --------------------------------------------------
// Outstanding — الفواتير غير المسدَّدة
// --------------------------------------------------

export const outstandingReportQuerySchema = z.object({
  academicYearId: z.string().trim().min(1).optional(),
  studyGroupId: z.string().trim().min(1).optional(),
  // المتأخرة فقط (تجاوزت تاريخ الاستحقاق)
  overdueOnly: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

// --------------------------------------------------
// Attendance
// --------------------------------------------------

export const attendanceReportQuerySchema = z.object({
  academicYearId: z.string().trim().min(1).optional(),
  studyGroupId: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional(),
  studentId: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// --------------------------------------------------
// Daily attendance — كشف الحضور اليومي
//
// يومٌ واحد إلزامي: الكشف ورقةُ يومٍ تُطبع وتُوقَّع،
// لا تجميعُ مدى تاريخي.
// --------------------------------------------------

export const dailyAttendanceReportQuerySchema = z.object({
  date: z.coerce.date({ error: "Date is required" }),
  studyGroupId: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional(),
  teacherId: z.string().trim().min(1).optional(),
});

// --------------------------------------------------
// Monthly fees — كشف الحقوق الشهرية
// --------------------------------------------------

const monthField = z.coerce
  .number()
  .int()
  .min(1, "Month must be between 1 and 12")
  .max(12, "Month must be between 1 and 12");

const yearField = z.coerce
  .number()
  .int()
  .min(2000, "Year must be 2000 or later")
  .max(2100, "Year must be 2100 or earlier");

export const monthlyFeesReportQuerySchema = z.object({
  month: monthField,
  year: yearField,
  academicYearId: z.string().trim().min(1).optional(),
  studyGroupId: z.string().trim().min(1).optional(),
  studentId: z.string().trim().min(1).optional(),
  // PENDING / PARTIAL / PAID — لعرض غير المسدَّد وحده مثلاً
  status: z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
});

// --------------------------------------------------
// Session clearance — كشف التخليص اليومي للحصص
// --------------------------------------------------

export const sessionClearanceReportQuerySchema = z.object({
  date: z.coerce.date({ error: "Date is required" }),
  teacherId: z.string().trim().min(1).optional(),
  studyGroupId: z.string().trim().min(1).optional(),
});

// --------------------------------------------------
// Expected sessions — الكشف التقديري للحصص
//
// المتوقَّع يُشتقّ من الجدول الأسبوعي بعدّ أيام الأسبوع
// في المدى، ويُقابَل بما وقع فعلاً في جدول Session.
// --------------------------------------------------

export const expectedSessionsReportQuerySchema = z.object({
  academicYearId: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date({ error: "Start date is required" }),
  dateTo: z.coerce.date({ error: "End date is required" }),
  teacherId: z.string().trim().min(1).optional(),
  studyGroupId: z.string().trim().min(1).optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type FinancialReportQuery = z.infer<typeof financialReportQuerySchema>;
export type OutstandingReportQuery = z.infer<
  typeof outstandingReportQuerySchema
>;
export type AttendanceReportQuery = z.infer<typeof attendanceReportQuerySchema>;
export type DailyAttendanceReportQuery = z.infer<
  typeof dailyAttendanceReportQuerySchema
>;
export type MonthlyFeesReportQuery = z.infer<
  typeof monthlyFeesReportQuerySchema
>;
export type SessionClearanceReportQuery = z.infer<
  typeof sessionClearanceReportQuerySchema
>;
export type ExpectedSessionsReportQuery = z.infer<
  typeof expectedSessionsReportQuerySchema
>;
