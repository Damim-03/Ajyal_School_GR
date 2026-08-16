"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementPolicyQuerySchema = exports.settlementPolicyIdSchema = exports.updateSettlementPolicySchema = exports.createSettlementPolicySchema = void 0;
const zod_1 = require("zod");
const METHOD = zod_1.z.enum([
    "PERCENTAGE",
    "PER_STUDENT",
    "PER_SESSION",
    "PER_ATTENDED_SHARE",
]);
const COUNT_BASIS = zod_1.z.enum(["ENROLLED", "PAID", "PRESENT"]);
const ROUNDING = zod_1.z.enum(["ROUND", "ROUND_UP", "ROUND_DOWN"]);
const scopeId = zod_1.z.string().trim().min(1).nullish();
const money = zod_1.z.coerce.number().positive().max(9999999);
/**
 * الحقول المشروطة — §8.
 *
 * «لا تجعل جميع هذه القيم إلزامية في كل طريقة». فكلُّ طريقة تطلب
 * حقلها وحده، والباقي يُترك فارغاً. والتحقق هنا لا في الخدمة، لأن
 * رفضَ الطلب قبل لمس القاعدة أوضح للمستخدم.
 */
const requireMethodField = (body) => {
    switch (body.method) {
        case "PERCENTAGE":
        case "PER_ATTENDED_SHARE":
            return body.teacherPercentage != null;
        case "PER_STUDENT":
            return body.amountPerStudent != null;
        case "PER_SESSION":
            return body.amountPerSession != null;
        default:
            return true;
    }
};
const METHOD_FIELD_ERROR = "PERCENTAGE and PER_ATTENDED_SHARE require teacherPercentage; " +
    "PER_STUDENT requires amountPerStudent; PER_SESSION requires amountPerSession";
// --------------------------------------------------
// Create
// --------------------------------------------------
exports.createSettlementPolicySchema = zod_1.z
    .object({
    name: zod_1.z.string({ error: "Name is required" }).trim().min(1).max(120),
    method: METHOD,
    teacherPercentage: zod_1.z.coerce
        .number()
        .min(0, "Percentage must not be negative")
        .max(100, "Percentage must not exceed 100")
        .nullish(),
    amountPerStudent: money.nullish(),
    amountPerSession: money.nullish(),
    countBasis: COUNT_BASIS.default("ENROLLED"),
    roundingMode: ROUNDING.default("ROUND"),
    roundingPrecision: zod_1.z.coerce.number().int().min(0).max(4).default(2),
    academicYearId: zod_1.z
        .string({ error: "Academic year is required" })
        .trim()
        .min(1),
    subjectId: scopeId,
    studyGroupId: scopeId,
    teacherId: scopeId,
    effectiveFrom: zod_1.z.coerce.date({ error: "Effective from date is required" }),
    effectiveTo: zod_1.z.coerce.date().nullish(),
    isActive: zod_1.z.boolean().optional(),
    note: zod_1.z.string().trim().max(500).nullish(),
})
    .refine(requireMethodField, { error: METHOD_FIELD_ERROR, path: ["method"] });
// --------------------------------------------------
// Update
// --------------------------------------------------
exports.updateSettlementPolicySchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1).max(120),
    method: METHOD,
    teacherPercentage: zod_1.z.coerce.number().min(0).max(100).nullish(),
    amountPerStudent: money.nullish(),
    amountPerSession: money.nullish(),
    countBasis: COUNT_BASIS,
    roundingMode: ROUNDING,
    roundingPrecision: zod_1.z.coerce.number().int().min(0).max(4),
    academicYearId: zod_1.z.string().trim().min(1),
    subjectId: scopeId,
    studyGroupId: scopeId,
    teacherId: scopeId,
    effectiveFrom: zod_1.z.coerce.date(),
    effectiveTo: zod_1.z.coerce.date().nullish(),
    isActive: zod_1.z.boolean(),
    note: zod_1.z.string().trim().max(500).nullish(),
})
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.settlementPolicyIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Settlement policy id is required"),
});
exports.settlementPolicyQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    subjectId: zod_1.z.string().trim().min(1).optional(),
    studyGroupId: zod_1.z.string().trim().min(1).optional(),
    teacherId: zod_1.z.string().trim().min(1).optional(),
    method: METHOD.optional(),
    effectiveOn: zod_1.z.coerce.date().optional(),
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
//# sourceMappingURL=settlement-policy.schema.js.map