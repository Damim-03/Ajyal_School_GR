import { z } from "zod";
import { SessionStatus } from "../../../generated/prisma";

// --------------------------------------------------
// Create — حصة واحدة يدوياً
//
// lessonNumber اختياري: يُحسب تلقائياً (آخر رقم في هذا
// الجدول + 1) وهو المتوقَّع في الاستعمال العادي.
// --------------------------------------------------

export const createSessionSchema = z.object({
  scheduleId: z
    .string({ error: "Schedule is required" })
    .trim()
    .min(1, "Schedule is required"),

  sessionDate: z.coerce.date({ error: "Session date is required" }),

  lessonNumber: z.coerce.number().int().min(1).optional(),

  status: z.enum(SessionStatus).optional(),

  note: z.string().trim().max(500).nullish(),

  /** الكشف الذي تنتمي إليه — الحصة المنشأة من داخل كشفٍ تحمله */
  sheetId: z.string().trim().min(1).nullish(),
});

// --------------------------------------------------
// Generate — توليد الحصص من الجدول الأسبوعي
//
// لكل جدول: كل تاريخ بين startDate و endDate يوافق
// يوم الجدول يُنتج حصة، ما لم يكن في skipDates
// أو له حصة مسجَّلة سلفاً.
// --------------------------------------------------

export const generateSessionsSchema = z
  .object({
    scheduleIds: z
      .array(z.string().trim().min(1), { error: "Schedules are required" })
      .min(1, "At least one schedule must be selected")
      .max(100, "Cannot generate for more than 100 schedules at once")
      .transform((ids) => [...new Set(ids)]),

    startDate: z.coerce.date({ error: "Start date is required" }),

    endDate: z.coerce.date({ error: "End date is required" }),

    // العطل والأيام المستثناة
    skipDates: z.array(z.coerce.date()).max(100).optional(),
  })
  .refine((body) => body.endDate >= body.startDate, {
    error: "End date must not be before start date",
    path: ["endDate"],
  })
  .refine(
    (body) => {
      const days =
        (body.endDate.getTime() - body.startDate.getTime()) /
        (24 * 60 * 60 * 1000);
      return days <= 366;
    },
    { error: "Date range must not exceed 366 days", path: ["endDate"] },
  );

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateSessionSchema = z
  .object({
    sessionDate: z.coerce.date(),
    lessonNumber: z.coerce.number().int().min(1),
    status: z.enum(SessionStatus),
    note: z.string().trim().max(500).nullish(),

    /**
     * ضمُّ الحصة إلى كشف — أو فكُّها منه بـ null.
     *
     * كان غيابُه طريقاً مسدوداً: حذفُ الكشف يفكّ حصصه ولا يمحوها
     * (وهو الصواب — الحضور المسجَّل لا يضيع بحذف ورقة إدارية)، لكنّ
     * الحصة المفكوكة كانت تبقى كذلك أبداً. تحجز تاريخها فيُرفض إنشاء
     * عمودٍ جديد عليه، ولا سبيل إلى ضمّها إلى كشفٍ قائم.
     */
    sheetId: z.string().trim().min(1).nullish(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const sessionIdSchema = z.object({
  id: z.string().trim().min(1, "Session id is required"),
});

export const sessionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  scheduleId: z.string().trim().min(1).optional(),
  /** كل جداول إسنادٍ تدريسي — أضيق من المادة والأستاذ والفوج مجتمعةً */
  teachingAssignmentId: z.string().trim().min(1).optional(),
  status: z.enum(SessionStatus).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  teacherId: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional(),
  studyGroupId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type GenerateSessionsInput = z.infer<typeof generateSessionsSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type SessionQueryInput = z.infer<typeof sessionQuerySchema>;
