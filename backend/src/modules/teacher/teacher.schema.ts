import { z } from "zod";
import { Gender } from "../../../generated/prisma";

// --------------------------------------------------
// حقول مشتركة
// --------------------------------------------------

const phoneField = z
  .string()
  .trim()
  .min(8, "Phone must be at least 8 characters")
  .max(20, "Phone must not exceed 20 characters")
  .regex(/^[0-9+\s-]+$/, "Phone may contain digits, spaces, + and - only");

const pastDate = (label: string) =>
  z.coerce.date().refine((value) => value <= new Date(), {
    error: `${label} must be in the past`,
  });

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createTeacherSchema = z.object({
  firstName: z
    .string({ error: "First name is required" })
    .trim()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must not exceed 50 characters"),

  lastName: z
    .string({ error: "Last name is required" })
    .trim()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must not exceed 50 characters"),

  email: z.email({ error: "Invalid email address" }).trim().nullish(),

  phone: phoneField.nullish(),

  gender: z.enum(Gender, { error: "Gender must be MALE or FEMALE" }),

  /* مسارُ الرفع لا رابطٌ خارجي — كصورة الطالب */
  avatar: z.string().trim().max(255).nullish(),

  birthDate: pastDate("Birth date").nullish(),

  hireDate: pastDate("Hire date"),

  address: z.string().trim().max(200).nullish(),

  qualification: z.string().trim().max(100).nullish(),

  specialization: z.string().trim().max(100).nullish(),

  salary: z.coerce
    .number()
    .positive("Salary must be greater than 0")
    .max(9_999_999, "Salary is too large")
    .nullish(),

  isActive: z.boolean().optional(),
});

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateTeacherSchema = createTeacherSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const teacherIdSchema = z.object({
  id: z.string().trim().min(1, "Teacher id is required"),
});

/** كشف الحساب — السنةُ إلزامية: ورقةٌ بلا سنةٍ تخلط سنتين */
export const teacherStatementQuerySchema = z.object({
  academicYearId: z.string().trim().min(1, "Academic year is required"),
});

export const teacherQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  gender: z.enum(Gender).optional(),
  specialization: z.string().trim().min(1).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// --------------------------------------------------
// وثائق ملفّ الأستاذ
// --------------------------------------------------

export const teacherDocumentParamSchema = z.object({
  id: z.string().trim().min(1, "Teacher id is required"),
  type: z.string().trim().min(1, "Document type is required"),
});

export const putTeacherDocumentSchema = z.object({
  filePath: z
    .string({ error: "مسار الملف مطلوب" })
    .trim()
    .startsWith("/uploads/", "مسار الملف غير صالح")
    .max(255),

  fileName: z.string().trim().max(255).nullish(),

  /* تسميةُ النوع المضاف — تُقرأ لمفاتيح `custom_` وحدها */
  label: z.string().trim().min(2, "التسمية قصيرة").max(80).nullish(),

  note: z.string().trim().max(300).nullish(),
});

export type PutTeacherDocumentInput = z.infer<typeof putTeacherDocumentSchema>;

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
export type TeacherQueryInput = z.infer<typeof teacherQuerySchema>;
