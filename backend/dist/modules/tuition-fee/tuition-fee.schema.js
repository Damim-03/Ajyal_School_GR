"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tuitionFeeQuerySchema = exports.tuitionFeeIdSchema = exports.updateTuitionFeeSchema = exports.createTuitionFeeSchema = void 0;
const zod_1 = require("zod");
const GROUP_TYPE = zod_1.z.enum(["NORMAL", "ELITE", "INTENSIVE", "EVENING"]);
const scopeId = zod_1.z.string().trim().min(1).nullish();
// --------------------------------------------------
// Create
//
// المادة وحدها إلزامية. وحقول النطاق الأربعة اختيارية، والفارغُ منها
// يعني «أيّاً كان» — لكن أحدَها على الأقل مطلوب: صفٌّ بلا نطاق يسعّر
// المادة لكل أفواج المؤسسة، وذلك يكاد لا يكون مقصوداً، فيُطلب صراحةً
// بـ applyToAll بدل أن يقع سهواً بترك الحقول فارغة.
// --------------------------------------------------
const scopeFields = {
    studyGroupId: scopeId,
    levelId: scopeId,
    educationStageId: scopeId,
    groupType: GROUP_TYPE.nullish(),
    /// إقرارٌ صريح بأن السعر يشمل كل الأفواج
    applyToAll: zod_1.z.boolean().optional(),
};
const hasScope = (body) => Boolean(body.studyGroupId ||
    body.levelId ||
    body.educationStageId ||
    body.groupType ||
    body.applyToAll);
exports.createTuitionFeeSchema = zod_1.z
    .object({
    academicYearId: zod_1.z
        .string({ error: "Academic year is required" })
        .trim()
        .min(1, "Academic year is required"),
    subjectId: zod_1.z
        .string({ error: "Subject is required" })
        .trim()
        .min(1, "Subject is required"),
    ...scopeFields,
    amount: zod_1.z.coerce
        .number({ error: "Amount is required" })
        .positive("Amount must be greater than 0")
        .max(9999999, "Amount is too large"),
    isActive: zod_1.z.boolean().optional(),
})
    .refine(hasScope, {
    error: "Specify at least one scope (study group, level, education stage or group type), " +
        "or set applyToAll to price every group of this subject",
    path: ["studyGroupId"],
});
// --------------------------------------------------
// Update
// --------------------------------------------------
exports.updateTuitionFeeSchema = zod_1.z
    .object({
    academicYearId: zod_1.z.string().trim().min(1),
    subjectId: zod_1.z.string().trim().min(1),
    ...scopeFields,
    amount: zod_1.z.coerce.number().positive().max(9999999),
    isActive: zod_1.z.boolean(),
})
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.tuitionFeeIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Tuition fee id is required"),
});
exports.tuitionFeeQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    subjectId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
    levelId: zod_1.z.string().trim().min(1).optional(),
    educationStageId: zod_1.z.string().trim().min(1).optional(),
    groupType: GROUP_TYPE.optional(),
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
//# sourceMappingURL=tuition-fee.schema.js.map