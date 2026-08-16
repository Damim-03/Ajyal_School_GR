import { z } from "zod";
import { Gender } from "../../generated/prisma";

// --------------------------------------------------
// حقول مشتركة
// --------------------------------------------------

const phoneField = z
  .string()
  .trim()
  .min(8, "Phone must be at least 8 characters")
  .max(20, "Phone must not exceed 20 characters")
  .regex(/^[0-9+\s-]+$/, "Phone may contain digits, spaces, + and - only");

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createStudentSchema = z.object({
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

  gender: z.enum(Gender, { error: "Gender must be MALE or FEMALE" }),

  birthDate: z.coerce
    .date()
    .refine((value) => value <= new Date(), {
      error: "Birth date must be in the past",
    })
    .nullish(),

  /*
   * مسار الصورة كما يُعيده POST /api/uploads — لا الملف نفسه.
   * أي قيمة أخرى تُرفض: العميل لا يختار أين تُخزَّن الملفّات.
   */
  avatar: z
    .string()
    .trim()
    .startsWith("/uploads/", "مسار الصورة غير صالح")
    .max(255)
    .nullish(),

  phone: phoneField.nullish(),

  // إلزامي — وسيلة التواصل الأساسية مع ولي الأمر
  parentPhone: phoneField,

  address: z.string().trim().max(200).nullish(),

  schoolName: z.string().trim().max(100).nullish(),

  emergencyPhone: phoneField.nullish(),

  registrationDate: z.coerce.date().optional(),

  note: z.string().trim().max(1000).nullish(),

  isActive: z.boolean().optional(),
});

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateStudentSchema = createStudentSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const studentIdSchema = z.object({
  id: z.string().trim().min(1, "Student id is required"),
});

export const studentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  gender: z.enum(Gender).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),

  /*
   * فلاتر تمرّ عبر التسجيل.
   *
   * الطالب لا يرتبط بمادة ولا فوج ولا سنة مباشرة في المخطّط — الرابط
   * هو StudentEnrollment ← TeachingAssignment. فهذه الفلاتر تُترجَم إلى
   * «له تسجيلٌ نشط يطابق الشرط» لا إلى عمود على الطالب.
   */
  subjectId: z.string().trim().min(1).optional(),
  studyGroupId: z.string().trim().min(1).optional(),
  levelId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
  teacherId: z.string().trim().min(1).optional(),

  /** هل يُحتسب التسجيل المعطَّل ضمن الفلاتر أعلاه */
  includeInactiveEnrollments: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),

  /** اكتمال ملف الوثائق — تعريفه في document.types.ts */
  documentsComplete: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// --------------------------------------------------
// وثائق الطالب
// --------------------------------------------------

export const documentTypeParamSchema = z.object({
  id: z.string().trim().min(1, "Student id is required"),
  type: z.string().trim().min(1, "Document type is required"),
});

export const putDocumentSchema = z.object({
  filePath: z
    .string({ error: "مسار الملف مطلوب" })
    .trim()
    .startsWith("/uploads/", "مسار الملف غير صالح")
    .max(255),

  fileName: z.string().trim().max(255).nullish(),

  note: z.string().trim().max(300).nullish(),
});

export type PutDocumentInput = z.infer<typeof putDocumentSchema>;

export const studentEnrollmentQuerySchema = z.object({
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  academicYearId: z.string().trim().min(1).optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type StudentQueryInput = z.infer<typeof studentQuerySchema>;
export type StudentEnrollmentQueryInput = z.infer<
  typeof studentEnrollmentQuerySchema
>;
