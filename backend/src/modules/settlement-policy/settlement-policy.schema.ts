import { z } from "zod";

const METHOD = z.enum([
  "PERCENTAGE",
  "PER_STUDENT",
  "PER_SESSION",
  "PER_ATTENDED_SHARE",
]);

const COUNT_BASIS = z.enum(["ENROLLED", "PAID", "PRESENT"]);
const ROUNDING = z.enum(["ROUND", "ROUND_UP", "ROUND_DOWN"]);

const scopeId = z.string().trim().min(1).nullish();

const money = z.coerce.number().positive().max(9_999_999);

/**
 * الحقول المشروطة — §8.
 *
 * «لا تجعل جميع هذه القيم إلزامية في كل طريقة». فكلُّ طريقة تطلب
 * حقلها وحده، والباقي يُترك فارغاً. والتحقق هنا لا في الخدمة، لأن
 * رفضَ الطلب قبل لمس القاعدة أوضح للمستخدم.
 */
const requireMethodField = <
  T extends {
    method?: string;
    teacherPercentage?: number | null;
    amountPerStudent?: number | null;
    amountPerSession?: number | null;
  },
>(
  body: T,
): boolean => {
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

const METHOD_FIELD_ERROR =
  "PERCENTAGE and PER_ATTENDED_SHARE require teacherPercentage; " +
  "PER_STUDENT requires amountPerStudent; PER_SESSION requires amountPerSession";

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createSettlementPolicySchema = z
  .object({
    name: z.string({ error: "Name is required" }).trim().min(1).max(120),

    method: METHOD,

    teacherPercentage: z.coerce
      .number()
      .min(0, "Percentage must not be negative")
      .max(100, "Percentage must not exceed 100")
      .nullish(),

    amountPerStudent: money.nullish(),
    amountPerSession: money.nullish(),

    countBasis: COUNT_BASIS.default("ENROLLED"),
    roundingMode: ROUNDING.default("ROUND"),
    roundingPrecision: z.coerce.number().int().min(0).max(4).default(2),

    academicYearId: z
      .string({ error: "Academic year is required" })
      .trim()
      .min(1),

    subjectId: scopeId,
    studyGroupId: scopeId,
    teacherId: scopeId,

    effectiveFrom: z.coerce.date({ error: "Effective from date is required" }),
    effectiveTo: z.coerce.date().nullish(),

    isActive: z.boolean().optional(),
    note: z.string().trim().max(500).nullish(),
  })
  .refine(requireMethodField, { error: METHOD_FIELD_ERROR, path: ["method"] });

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateSettlementPolicySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    method: METHOD,
    teacherPercentage: z.coerce.number().min(0).max(100).nullish(),
    amountPerStudent: money.nullish(),
    amountPerSession: money.nullish(),
    countBasis: COUNT_BASIS,
    roundingMode: ROUNDING,
    roundingPrecision: z.coerce.number().int().min(0).max(4),
    academicYearId: z.string().trim().min(1),
    subjectId: scopeId,
    studyGroupId: scopeId,
    teacherId: scopeId,
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().nullish(),
    isActive: z.boolean(),
    note: z.string().trim().max(500).nullish(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const settlementPolicyIdSchema = z.object({
  id: z.string().trim().min(1, "Settlement policy id is required"),
});

export const settlementPolicyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  academicYearId: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional(),
  studyGroupId: z.string().trim().min(1).optional(),
  teacherId: z.string().trim().min(1).optional(),
  method: METHOD.optional(),
  effectiveOn: z.coerce.date().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type CreateSettlementPolicyInput = z.infer<
  typeof createSettlementPolicySchema
>;
export type UpdateSettlementPolicyInput = z.infer<
  typeof updateSettlementPolicySchema
>;
export type SettlementPolicyQueryInput = z.infer<
  typeof settlementPolicyQuerySchema
>;
