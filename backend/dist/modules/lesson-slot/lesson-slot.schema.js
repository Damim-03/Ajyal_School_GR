"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lessonSlotQuerySchema = exports.lessonSlotIdSchema = exports.updateLessonSlotSchema = exports.createLessonSlotSchema = void 0;
const zod_1 = require("zod");
const time_1 = require("../../core/utils/time");
// --------------------------------------------------
// Create
//
// الأوقات نصوص "HH:mm" — تُحوَّل إلى Date في الـ service
// لأن Prisma يمثّل عمود TIME كـ DateTime.
// --------------------------------------------------
const timeField = (label) => zod_1.z
    .string({ error: `${label} is required` })
    .trim()
    .regex(time_1.TIME_PATTERN, `${label} must be in HH:mm format (00:00 - 23:59)`);
exports.createLessonSlotSchema = zod_1.z.object({
    // الحصص سياسةُ سنةٍ دراسية: عددها وأوقاتها تخصّ تلك السنة وحدها
    academicYearId: zod_1.z
        .string({ error: "Academic year is required" })
        .trim()
        .min(1, "Academic year is required"),
    name: zod_1.z
        .string({ error: "Lesson slot name is required" })
        .trim()
        .min(1, "Name must not be empty")
        .max(50, "Name must not exceed 50 characters"),
    // الأستاذ صاحب الفترة — والفارغُ فترةٌ عامّة للمؤسسة.
    //
    // `nullable` لا `optional` وحدها: التعديل يحتاج أن يقول «لا أستاذ»
    // صراحةً ليُعيد فترةً مملوكة إلى العموم، وحذفُ المفتاح من الجسم
    // يعني «لا تغيّرها» لا «فرّغها».
    teacherId: zod_1.z.string().trim().min(1).nullable().optional(),
    // اختياري — يُحسب تلقائياً (آخر ترتيب في هذه السنة + 1)
    order: zod_1.z.coerce.number().int().min(0).optional(),
    startTime: timeField("Start time"),
    endTime: timeField("End time"),
    isActive: zod_1.z.boolean().optional(),
});
// --------------------------------------------------
// Update
// --------------------------------------------------
// السنة الدراسية لا تُعدَّل بعد الإنشاء — نقل حصة إلى سنة أخرى
// يُبطل جداولها وحصصها الفعلية، والصواب إنشاء حصة في السنة الجديدة.
exports.updateLessonSlotSchema = exports.createLessonSlotSchema
    .omit({ academicYearId: true })
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.lessonSlotIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Lesson slot id is required"),
});
exports.lessonSlotQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    teacherId: zod_1.z.string().trim().min(1).optional(),
    search: zod_1.z.string().trim().min(1).optional(),
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
//# sourceMappingURL=lesson-slot.schema.js.map