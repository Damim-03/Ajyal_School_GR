"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentEnrollmentQuerySchema = exports.putDocumentSchema = exports.documentTypeParamSchema = exports.studentQuerySchema = exports.studentIdSchema = exports.updateStudentSchema = exports.createStudentSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../../generated/prisma");
// --------------------------------------------------
// حقول مشتركة
// --------------------------------------------------
const phoneField = zod_1.z
    .string()
    .trim()
    .min(8, "Phone must be at least 8 characters")
    .max(20, "Phone must not exceed 20 characters")
    .regex(/^[0-9+\s-]+$/, "Phone may contain digits, spaces, + and - only");
// --------------------------------------------------
// Create
// --------------------------------------------------
exports.createStudentSchema = zod_1.z.object({
    firstName: zod_1.z
        .string({ error: "First name is required" })
        .trim()
        .min(2, "First name must be at least 2 characters")
        .max(50, "First name must not exceed 50 characters"),
    lastName: zod_1.z
        .string({ error: "Last name is required" })
        .trim()
        .min(2, "Last name must be at least 2 characters")
        .max(50, "Last name must not exceed 50 characters"),
    gender: zod_1.z.enum(prisma_1.Gender, { error: "Gender must be MALE or FEMALE" }),
    birthDate: zod_1.z.coerce
        .date()
        .refine((value) => value <= new Date(), {
        error: "Birth date must be in the past",
    })
        .nullish(),
    /*
     * مسار الصورة كما يُعيده POST /api/uploads — لا الملف نفسه.
     * أي قيمة أخرى تُرفض: العميل لا يختار أين تُخزَّن الملفّات.
     */
    avatar: zod_1.z
        .string()
        .trim()
        .startsWith("/uploads/", "مسار الصورة غير صالح")
        .max(255)
        .nullish(),
    phone: phoneField.nullish(),
    // إلزامي — وسيلة التواصل الأساسية مع ولي الأمر
    parentPhone: phoneField,
    address: zod_1.z.string().trim().max(200).nullish(),
    schoolName: zod_1.z.string().trim().max(100).nullish(),
    emergencyPhone: phoneField.nullish(),
    /*
     * المستوى الذي أنشأته الإدارة في «البنية الدراسية» — «أولى متوسط».
     *
     * والطور لا يُرسل: هو `Level.educationStageId` ويُستنتج منه. النموذج
     * يعرضه مرشّحاً للمستويات ليقصر القائمة، لا حقلاً يُحفظ.
     */
    levelId: zod_1.z.string().trim().min(1).nullish(),
    registrationDate: zod_1.z.coerce.date().optional(),
    note: zod_1.z.string().trim().max(1000).nullish(),
    isActive: zod_1.z.boolean().optional(),
});
// --------------------------------------------------
// Update
// --------------------------------------------------
exports.updateStudentSchema = exports.createStudentSchema
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.studentIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Student id is required"),
});
exports.studentQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().min(1).optional(),
    gender: zod_1.z.enum(prisma_1.Gender).optional(),
    isActive: zod_1.z
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
    subjectId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
    levelId: zod_1.z.string().trim().min(1).optional(),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    teacherId: zod_1.z.string().trim().min(1).optional(),
    /** هل يُحتسب التسجيل المعطَّل ضمن الفلاتر أعلاه */
    includeInactiveEnrollments: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
    /** اكتمال ملف الوثائق — تعريفه في document.types.ts */
    documentsComplete: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
// --------------------------------------------------
// وثائق الطالب
// --------------------------------------------------
exports.documentTypeParamSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Student id is required"),
    type: zod_1.z.string().trim().min(1, "Document type is required"),
});
exports.putDocumentSchema = zod_1.z.object({
    filePath: zod_1.z
        .string({ error: "مسار الملف مطلوب" })
        .trim()
        .startsWith("/uploads/", "مسار الملف غير صالح")
        .max(255),
    fileName: zod_1.z.string().trim().max(255).nullish(),
    note: zod_1.z.string().trim().max(300).nullish(),
});
exports.studentEnrollmentQuerySchema = zod_1.z.object({
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
});
//# sourceMappingURL=student.schema.js.map