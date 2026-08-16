import { z } from "zod";
import { AttendanceStatus } from "../../generated/prisma";

// --------------------------------------------------
// Create — سجل واحد
// --------------------------------------------------

export const createAttendanceSchema = z.object({
  sessionId: z
    .string({ error: "Session is required" })
    .trim()
    .min(1, "Session is required"),

  studentEnrollmentId: z
    .string({ error: "Enrollment is required" })
    .trim()
    .min(1, "Enrollment is required"),

  status: z.enum(AttendanceStatus).optional(),

  note: z.string().trim().max(500).nullish(),
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

export const bulkAttendanceSchema = z
  .object({
    sessionId: z
      .string({ error: "Session is required" })
      .trim()
      .min(1, "Session is required"),

    records: z
      .array(
        z.object({
          studentEnrollmentId: z.string().trim().min(1),
          status: z.enum(AttendanceStatus),
          note: z.string().trim().max(500).nullish(),
        }),
      )
      .max(200, "Cannot mark more than 200 students at once")
      .optional(),

    // يُطبَّق على كل مسجَّل نشط لا سجل له بعد
    markRemainingAs: z.enum(AttendanceStatus).optional(),
  })
  .refine(
    (body) =>
      (body.records && body.records.length > 0) ||
      body.markRemainingAs !== undefined,
    { error: "Provide records, markRemainingAs, or both" },
  )
  .refine(
    (body) => {
      if (!body.records) return true;
      const ids = body.records.map((r) => r.studentEnrollmentId);
      return new Set(ids).size === ids.length;
    },
    { error: "Duplicate enrollment in records", path: ["records"] },
  );

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateAttendanceSchema = z
  .object({
    status: z.enum(AttendanceStatus),
    note: z.string().trim().max(500).nullish(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const attendanceIdSchema = z.object({
  id: z.string().trim().min(1, "Attendance id is required"),
});

export const attendanceSessionIdSchema = z.object({
  sessionId: z.string().trim().min(1, "Session id is required"),
});

export const attendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sessionId: z.string().trim().min(1).optional(),
  studentEnrollmentId: z.string().trim().min(1).optional(),
  studentId: z.string().trim().min(1).optional(),
  status: z.enum(AttendanceStatus).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  teachingAssignmentId: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional(),
  studyGroupId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type BulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type AttendanceQueryInput = z.infer<typeof attendanceQuerySchema>;
