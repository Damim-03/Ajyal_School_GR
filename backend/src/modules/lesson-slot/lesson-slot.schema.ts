import { z } from "zod";
import { TIME_PATTERN } from "../../core/utils/time";

// --------------------------------------------------
// Create
//
// الأوقات نصوص "HH:mm" — تُحوَّل إلى Date في الـ service
// لأن Prisma يمثّل عمود TIME كـ DateTime.
// --------------------------------------------------

const timeField = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .regex(TIME_PATTERN, `${label} must be in HH:mm format (00:00 - 23:59)`);

export const createLessonSlotSchema = z.object({
  // الحصص سياسةُ سنةٍ دراسية: عددها وأوقاتها تخصّ تلك السنة وحدها
  academicYearId: z
    .string({ error: "Academic year is required" })
    .trim()
    .min(1, "Academic year is required"),

  name: z
    .string({ error: "Lesson slot name is required" })
    .trim()
    .min(1, "Name must not be empty")
    .max(50, "Name must not exceed 50 characters"),

  // الأستاذ صاحب الفترة — والفارغُ فترةٌ عامّة للمؤسسة.
  //
  // `nullable` لا `optional` وحدها: التعديل يحتاج أن يقول «لا أستاذ»
  // صراحةً ليُعيد فترةً مملوكة إلى العموم، وحذفُ المفتاح من الجسم
  // يعني «لا تغيّرها» لا «فرّغها».
  teacherId: z.string().trim().min(1).nullable().optional(),

  // اختياري — يُحسب تلقائياً (آخر ترتيب في هذه السنة + 1)
  order: z.coerce.number().int().min(0).optional(),

  startTime: timeField("Start time"),

  endTime: timeField("End time"),

  isActive: z.boolean().optional(),
});

// --------------------------------------------------
// Update
// --------------------------------------------------

// السنة الدراسية لا تُعدَّل بعد الإنشاء — نقل حصة إلى سنة أخرى
// يُبطل جداولها وحصصها الفعلية، والصواب إنشاء حصة في السنة الجديدة.
export const updateLessonSlotSchema = createLessonSlotSchema
  .omit({ academicYearId: true })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const lessonSlotIdSchema = z.object({
  id: z.string().trim().min(1, "Lesson slot id is required"),
});

export const lessonSlotQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  academicYearId: z.string().trim().min(1).optional(),
  teacherId: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateLessonSlotInput = z.infer<typeof createLessonSlotSchema>;
export type UpdateLessonSlotInput = z.infer<typeof updateLessonSlotSchema>;
export type LessonSlotQueryInput = z.infer<typeof lessonSlotQuerySchema>;
