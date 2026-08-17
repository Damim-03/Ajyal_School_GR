import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import { recordAudit } from "../../core/audit/financial-audit";
import {
  buildPolicyScopeKey,
  policySpecificity,
  describePolicyScope,
} from "../../core/pricing/settlement-scope";
import {
  CreateSettlementPolicyInput,
  UpdateSettlementPolicyInput,
  SettlementPolicyQueryInput,
} from "./settlement-policy.schema";

const policySelect = {
  id: true,
  name: true,
  method: true,
  teacherPercentage: true,
  amountPerStudent: true,
  amountPerSession: true,
  countBasis: true,
  roundingMode: true,
  roundingPrecision: true,
  academicYearId: true,
  subjectId: true,
  studyGroupId: true,
  teacherId: true,
  scopeKey: true,
  effectiveFrom: true,
  effectiveTo: true,
  isActive: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  academicYear: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true } },
  studyGroup: { select: { id: true, name: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { settlements: true } },
} as const;

const num = (value: Prisma.Decimal | null) =>
  value === null ? null : Number(value);

const toResponse = <
  T extends {
    teacherPercentage: Prisma.Decimal | null;
    amountPerStudent: Prisma.Decimal | null;
    amountPerSession: Prisma.Decimal | null;
    subjectId: string | null;
    studyGroupId: string | null;
    teacherId: string | null;
    subject?: { name: string } | null;
    studyGroup?: { name: string } | null;
    teacher?: { firstName: string; lastName: string } | null;
  },
>(
  policy: T,
) => ({
  ...policy,
  teacherPercentage: num(policy.teacherPercentage),
  amountPerStudent: num(policy.amountPerStudent),
  amountPerSession: num(policy.amountPerSession),
  scope: describePolicyScope(policy),
  specificity: policySpecificity(policy),
});

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const policy = await prisma.settlementPolicy.findUnique({
    where: { id },
    select: policySelect,
  });

  if (!policy) {
    throw new NotFoundException(
      "Settlement policy not found",
      ErrorCodeEnum.SETTLEMENT_POLICY_NOT_FOUND,
    );
  }

  return policy;
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const ensureValidRange = (effectiveFrom: Date, effectiveTo?: Date | null) => {
  if (effectiveTo && effectiveTo <= effectiveFrom) {
    throw new BadRequestException(
      "Effective-to date must be after effective-from date",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }
};

const ensureRefsExist = async (scope: {
  academicYearId?: string;
  subjectId?: string | null;
  studyGroupId?: string | null;
  teacherId?: string | null;
}) => {
  if (scope.academicYearId) {
    const year = await prisma.academicYear.findUnique({
      where: { id: scope.academicYearId },
      select: { id: true },
    });

    if (!year) {
      throw new NotFoundException(
        "Academic year not found",
        ErrorCodeEnum.ACADEMIC_YEAR_NOT_FOUND,
      );
    }
  }

  if (scope.subjectId) {
    const subject = await prisma.subject.findUnique({
      where: { id: scope.subjectId },
      select: { id: true },
    });

    if (!subject) {
      throw new NotFoundException(
        "Subject not found",
        ErrorCodeEnum.SUBJECT_NOT_FOUND,
      );
    }
  }

  if (scope.studyGroupId) {
    const group = await prisma.studyGroup.findUnique({
      where: { id: scope.studyGroupId },
      select: { id: true },
    });

    if (!group) {
      throw new NotFoundException(
        "Study group not found",
        ErrorCodeEnum.STUDY_GROUP_NOT_FOUND,
      );
    }
  }

  if (scope.teacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: scope.teacherId },
      select: { id: true },
    });

    if (!teacher) {
      throw new NotFoundException(
        "Teacher not found",
        ErrorCodeEnum.TEACHER_NOT_FOUND,
      );
    }
  }
};

/** يمنع تداخل فترتين لنفس النطاق — كما في TuitionFee */
const ensureNoOverlappingPeriod = async (
  scopeKey: string,
  effectiveFrom: Date,
  effectiveTo: Date | null | undefined,
  excludeId?: string,
) => {
  const overlapping = await prisma.settlementPolicy.findFirst({
    where: {
      scopeKey,
      ...(excludeId && { NOT: { id: excludeId } }),
      ...(effectiveTo ? { effectiveFrom: { lt: effectiveTo } } : {}),
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
    },
    select: { name: true, effectiveFrom: true, effectiveTo: true },
  });

  if (overlapping) {
    const until = overlapping.effectiveTo
      ? formatDate(overlapping.effectiveTo)
      : "∞";

    throw new ConflictException(
      `Overlaps with policy "${overlapping.name}" for the same scope ` +
        `(${formatDate(overlapping.effectiveFrom)} → ${until})`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }
};

const decimalOrNull = (value: number | null | undefined) =>
  value === null || value === undefined ? null : new Prisma.Decimal(value);

// --------------------------------------------------
// List
// --------------------------------------------------

export const listSettlementPoliciesService = async (
  query: SettlementPolicyQueryInput,
) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const where: Prisma.SettlementPolicyWhereInput = {
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.academicYearId && { academicYearId: query.academicYearId }),
    ...(query.subjectId && { subjectId: query.subjectId }),
    ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
    ...(query.teacherId && { teacherId: query.teacherId }),
    ...(query.method && { method: query.method }),
    ...(query.effectiveOn && {
      effectiveFrom: { lte: query.effectiveOn },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: query.effectiveOn } }],
    }),
  };

  const [policies, total] = await Promise.all([
    prisma.settlementPolicy.findMany({
      where,
      select: policySelect,
      skip,
      take,
      orderBy: [{ effectiveFrom: "desc" }, { name: "asc" }],
    }),
    prisma.settlementPolicy.count({ where }),
  ]);

  return {
    settlementPolicies: policies.map(toResponse),
    pagination: buildPagination(total, page, limit),
  };
};

// --------------------------------------------------
// Get
// --------------------------------------------------

export const getSettlementPolicyService = async (id: string) =>
  toResponse(await findOrThrow(id));

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createSettlementPolicyService = async (
  body: CreateSettlementPolicyInput,
  userId?: string,
) => {
  await ensureRefsExist(body);
  ensureValidRange(body.effectiveFrom, body.effectiveTo);

  const scope = {
    academicYearId: body.academicYearId,
    subjectId: body.subjectId ?? null,
    studyGroupId: body.studyGroupId ?? null,
    teacherId: body.teacherId ?? null,
  };

  const scopeKey = buildPolicyScopeKey(scope);

  await ensureNoOverlappingPeriod(
    scopeKey,
    body.effectiveFrom,
    body.effectiveTo,
  );

  const policy = await prisma.settlementPolicy.create({
    data: {
      ...scope,
      scopeKey,
      name: body.name,
      method: body.method,
      teacherPercentage: decimalOrNull(body.teacherPercentage),
      amountPerStudent: decimalOrNull(body.amountPerStudent),
      amountPerSession: decimalOrNull(body.amountPerSession),
      countBasis: body.countBasis,
      roundingMode: body.roundingMode,
      roundingPrecision: body.roundingPrecision,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo ?? null,
      isActive: body.isActive ?? true,
      note: body.note ?? null,
    },
    select: policySelect,
  });

  await recordAudit({
    entity: "SettlementPolicy",
    entityId: policy.id,
    action: "CREATE",
    newValue: policy.name,
    userId,
  });

  return toResponse(policy);
};

// --------------------------------------------------
// Update
//
// التعديل لا يمسّ تخليصاً محسوباً: Settlement يحمل نسخته الخاصة من
// كل قيمة دخلت الحساب. ولذلك يُسمح بالتعديل هنا بلا خوف على التاريخ.
// --------------------------------------------------

const AUDITED_FIELDS = [
  "method",
  "teacherPercentage",
  "amountPerStudent",
  "amountPerSession",
  "countBasis",
  "roundingMode",
  "roundingPrecision",
  "effectiveFrom",
  "effectiveTo",
  "isActive",
] as const;

export const updateSettlementPolicyService = async (
  id: string,
  body: UpdateSettlementPolicyInput,
  userId?: string,
) => {
  const existing = await findOrThrow(id);

  await ensureRefsExist(body);

  const effectiveFrom = body.effectiveFrom ?? existing.effectiveFrom;
  const effectiveTo =
    body.effectiveTo !== undefined ? body.effectiveTo : existing.effectiveTo;

  ensureValidRange(effectiveFrom, effectiveTo);

  const pick = (
    sent: string | null | undefined,
    current: string | null,
  ): string | null => (sent !== undefined ? (sent ?? null) : current);

  const scope = {
    academicYearId: body.academicYearId ?? existing.academicYearId,
    subjectId: pick(body.subjectId, existing.subjectId),
    studyGroupId: pick(body.studyGroupId, existing.studyGroupId),
    teacherId: pick(body.teacherId, existing.teacherId),
  };

  const scopeKey = buildPolicyScopeKey(scope);

  if (
    scopeKey !== existing.scopeKey ||
    body.effectiveFrom !== undefined ||
    body.effectiveTo !== undefined
  ) {
    await ensureNoOverlappingPeriod(scopeKey, effectiveFrom, effectiveTo, id);
  }

  const method = body.method ?? existing.method;

  const policy = await prisma.settlementPolicy.update({
    where: { id },
    data: {
      ...scope,
      scopeKey,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.method !== undefined && { method: body.method }),
      ...(body.teacherPercentage !== undefined && {
        teacherPercentage: decimalOrNull(body.teacherPercentage),
      }),
      ...(body.amountPerStudent !== undefined && {
        amountPerStudent: decimalOrNull(body.amountPerStudent),
      }),
      ...(body.amountPerSession !== undefined && {
        amountPerSession: decimalOrNull(body.amountPerSession),
      }),
      ...(body.countBasis !== undefined && { countBasis: body.countBasis }),
      ...(body.roundingMode !== undefined && {
        roundingMode: body.roundingMode,
      }),
      ...(body.roundingPrecision !== undefined && {
        roundingPrecision: body.roundingPrecision,
      }),
      ...(body.effectiveFrom !== undefined && {
        effectiveFrom: body.effectiveFrom,
      }),
      ...(body.effectiveTo !== undefined && { effectiveTo: body.effectiveTo }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.note !== undefined && { note: body.note }),
    },
    select: policySelect,
  });

  // أثرٌ لكل حقل تغيّر فعلاً — §20
  for (const field of AUDITED_FIELDS) {
    const before = existing[field];
    const after = policy[field];

    if (String(before) !== String(after)) {
      await recordAudit({
        entity: "SettlementPolicy",
        entityId: id,
        action: "UPDATE",
        field,
        oldValue: before === null ? null : String(before),
        newValue: after === null ? null : String(after),
        userId,
      });
    }
  }

  void method;

  return toResponse(policy);
};

// --------------------------------------------------
// Delete
//
// السياسة المستعملة في تخليصٍ لا تُحذف: التخليص يشير إليها بمفتاح
// أجنبي، وحذفُها يقطع أثرَ «بأيّ سياسةٍ حُسب هذا المبلغ». تُعطَّل بدلاً
// من ذلك بـ isActive.
// --------------------------------------------------

export const deleteSettlementPolicyService = async (
  id: string,
  userId?: string,
) => {
  const policy = await findOrThrow(id);

  if (policy._count.settlements > 0) {
    throw new ConflictException(
      `Policy is used by ${policy._count.settlements} settlement(s). ` +
        `Deactivate it instead of deleting.`,
      ErrorCodeEnum.RESOURCE_IN_USE,
    );
  }

  await prisma.settlementPolicy.delete({ where: { id } });

  await recordAudit({
    entity: "SettlementPolicy",
    entityId: id,
    action: "CANCEL",
    oldValue: policy.name,
    userId,
  });
};
