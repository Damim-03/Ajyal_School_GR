import { z } from "zod";

const GROUP_TYPE = z.enum(["NORMAL", "ELITE", "INTENSIVE", "EVENING"]);

const scopeId = z.string().trim().min(1).nullish();

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
  applyToAll: z.boolean().optional(),
};

const hasScope = (body: {
  studyGroupId?: string | null;
  levelId?: string | null;
  educationStageId?: string | null;
  groupType?: string | null;
  applyToAll?: boolean;
}) =>
  Boolean(
    body.studyGroupId ||
      body.levelId ||
      body.educationStageId ||
      body.groupType ||
      body.applyToAll,
  );

export const createTuitionFeeSchema = z
  .object({
    academicYearId: z
      .string({ error: "Academic year is required" })
      .trim()
      .min(1, "Academic year is required"),

    subjectId: z
      .string({ error: "Subject is required" })
      .trim()
      .min(1, "Subject is required"),

    ...scopeFields,

    amount: z.coerce
      .number({ error: "Amount is required" })
      .positive("Amount must be greater than 0")
      .max(9_999_999, "Amount is too large"),

    isActive: z.boolean().optional(),
  })
  .refine(hasScope, {
    error:
      "Specify at least one scope (study group, level, education stage or group type), " +
      "or set applyToAll to price every group of this subject",
    path: ["studyGroupId"],
  });

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateTuitionFeeSchema = z
  .object({
    academicYearId: z.string().trim().min(1),
    subjectId: z.string().trim().min(1),
    ...scopeFields,
    amount: z.coerce.number().positive().max(9_999_999),
    isActive: z.boolean(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const tuitionFeeIdSchema = z.object({
  id: z.string().trim().min(1, "Tuition fee id is required"),
});

export const tuitionFeeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  academicYearId: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional(),
  studyGroupId: z.string().trim().min(1).optional(),
  levelId: z.string().trim().min(1).optional(),
  educationStageId: z.string().trim().min(1).optional(),
  groupType: GROUP_TYPE.optional(),

  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateTuitionFeeInput = z.infer<typeof createTuitionFeeSchema>;
export type UpdateTuitionFeeInput = z.infer<typeof updateTuitionFeeSchema>;
export type TuitionFeeQueryInput = z.infer<typeof tuitionFeeQuerySchema>;
