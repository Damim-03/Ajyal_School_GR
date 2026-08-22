import { z } from "zod";

// --------------------------------------------------
// Create
//
// عدد الأعمدة لا يُرسَل عادةً: يُنسخ عن سياسة السنة الدراسية لحظة
// الإنشاء. وإرسالُه يبقى ممكناً لكشفٍ استثنائي.
// --------------------------------------------------

export const createSheetSchema = z.object({
  teachingAssignmentId: z
    .string({ error: "Teaching assignment is required" })
    .trim()
    .min(1, "Teaching assignment is required"),

  /** يُحسب تلقائياً (آخر رقم في هذا الإسناد + 1) إن تُرك */
  number: z.coerce.number().int().min(1).max(99).optional(),

  label: z.string().trim().max(60).nullish(),

  sessionCount: z.coerce.number().int().min(1).max(31).optional(),

  note: z.string().trim().max(500).nullish(),

  /** حصص قائمة تُضمّ إلى الكشف عند إنشائه */
  adoptSessionIds: z.array(z.string().trim().min(1)).max(31).optional(),
});

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateSheetSchema = z
  .object({
    number: z.coerce.number().int().min(1).max(99),
    label: z.string().trim().max(60).nullish(),
    sessionCount: z.coerce.number().int().min(1).max(31),
    note: z.string().trim().max(500).nullish(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const sheetIdSchema = z.object({
  id: z.string().trim().min(1, "Sheet id is required"),
});

export const sheetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** رمزُ الورقة الممسوح — يُفرد كشفاً واحداً */
  code: z.string().trim().min(1).max(20).optional(),
  teachingAssignmentId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional(),
  studyGroupId: z.string().trim().min(1).optional(),
  teacherId: z.string().trim().min(1).optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateSheetInput = z.infer<typeof createSheetSchema>;
export type UpdateSheetInput = z.infer<typeof updateSheetSchema>;
export type SheetQueryInput = z.infer<typeof sheetQuerySchema>;
