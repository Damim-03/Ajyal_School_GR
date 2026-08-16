"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSettlementPolicyService = exports.updateSettlementPolicyService = exports.createSettlementPolicyService = exports.getSettlementPolicyService = exports.listSettlementPoliciesService = void 0;
const prisma_1 = require("../../generated/prisma");
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const financial_audit_1 = require("../../core/audit/financial-audit");
const settlement_scope_1 = require("../../core/pricing/settlement-scope");
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
};
const num = (value) => value === null ? null : Number(value);
const toResponse = (policy) => ({
    ...policy,
    teacherPercentage: num(policy.teacherPercentage),
    amountPerStudent: num(policy.amountPerStudent),
    amountPerSession: num(policy.amountPerSession),
    scope: (0, settlement_scope_1.describePolicyScope)(policy),
    specificity: (0, settlement_scope_1.policySpecificity)(policy),
});
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const policy = await client_1.prisma.settlementPolicy.findUnique({
        where: { id },
        select: policySelect,
    });
    if (!policy) {
        throw new app_errors_1.NotFoundException("Settlement policy not found", error_code_enum_1.ErrorCodeEnum.SETTLEMENT_POLICY_NOT_FOUND);
    }
    return policy;
};
const formatDate = (date) => date.toISOString().slice(0, 10);
const ensureValidRange = (effectiveFrom, effectiveTo) => {
    if (effectiveTo && effectiveTo <= effectiveFrom) {
        throw new app_errors_1.BadRequestException("Effective-to date must be after effective-from date", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
};
const ensureRefsExist = async (scope) => {
    if (scope.academicYearId) {
        const year = await client_1.prisma.academicYear.findUnique({
            where: { id: scope.academicYearId },
            select: { id: true },
        });
        if (!year) {
            throw new app_errors_1.NotFoundException("Academic year not found", error_code_enum_1.ErrorCodeEnum.ACADEMIC_YEAR_NOT_FOUND);
        }
    }
    if (scope.subjectId) {
        const subject = await client_1.prisma.subject.findUnique({
            where: { id: scope.subjectId },
            select: { id: true },
        });
        if (!subject) {
            throw new app_errors_1.NotFoundException("Subject not found", error_code_enum_1.ErrorCodeEnum.SUBJECT_NOT_FOUND);
        }
    }
    if (scope.studyGroupId) {
        const group = await client_1.prisma.studyGroup.findUnique({
            where: { id: scope.studyGroupId },
            select: { id: true },
        });
        if (!group) {
            throw new app_errors_1.NotFoundException("Study group not found", error_code_enum_1.ErrorCodeEnum.STUDY_GROUP_NOT_FOUND);
        }
    }
    if (scope.teacherId) {
        const teacher = await client_1.prisma.teacher.findUnique({
            where: { id: scope.teacherId },
            select: { id: true },
        });
        if (!teacher) {
            throw new app_errors_1.NotFoundException("Teacher not found", error_code_enum_1.ErrorCodeEnum.TEACHER_NOT_FOUND);
        }
    }
};
/** يمنع تداخل فترتين لنفس النطاق — كما في TuitionFee */
const ensureNoOverlappingPeriod = async (scopeKey, effectiveFrom, effectiveTo, excludeId) => {
    const overlapping = await client_1.prisma.settlementPolicy.findFirst({
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
        throw new app_errors_1.ConflictException(`Overlaps with policy "${overlapping.name}" for the same scope ` +
            `(${formatDate(overlapping.effectiveFrom)} → ${until})`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
};
const decimalOrNull = (value) => value === null || value === undefined ? null : new prisma_1.Prisma.Decimal(value);
// --------------------------------------------------
// List
// --------------------------------------------------
const listSettlementPoliciesService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const where = {
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
        client_1.prisma.settlementPolicy.findMany({
            where,
            select: policySelect,
            skip,
            take,
            orderBy: [{ effectiveFrom: "desc" }, { name: "asc" }],
        }),
        client_1.prisma.settlementPolicy.count({ where }),
    ]);
    return {
        settlementPolicies: policies.map(toResponse),
        pagination: (0, api_response_1.buildPagination)(total, page, limit),
    };
};
exports.listSettlementPoliciesService = listSettlementPoliciesService;
// --------------------------------------------------
// Get
// --------------------------------------------------
const getSettlementPolicyService = async (id) => toResponse(await findOrThrow(id));
exports.getSettlementPolicyService = getSettlementPolicyService;
// --------------------------------------------------
// Create
// --------------------------------------------------
const createSettlementPolicyService = async (body, userId) => {
    await ensureRefsExist(body);
    ensureValidRange(body.effectiveFrom, body.effectiveTo);
    const scope = {
        academicYearId: body.academicYearId,
        subjectId: body.subjectId ?? null,
        studyGroupId: body.studyGroupId ?? null,
        teacherId: body.teacherId ?? null,
    };
    const scopeKey = (0, settlement_scope_1.buildPolicyScopeKey)(scope);
    await ensureNoOverlappingPeriod(scopeKey, body.effectiveFrom, body.effectiveTo);
    const policy = await client_1.prisma.settlementPolicy.create({
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
    await (0, financial_audit_1.recordAudit)({
        entity: "SettlementPolicy",
        entityId: policy.id,
        action: "CREATE",
        newValue: policy.name,
        userId,
    });
    return toResponse(policy);
};
exports.createSettlementPolicyService = createSettlementPolicyService;
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
];
const updateSettlementPolicyService = async (id, body, userId) => {
    const existing = await findOrThrow(id);
    await ensureRefsExist(body);
    const effectiveFrom = body.effectiveFrom ?? existing.effectiveFrom;
    const effectiveTo = body.effectiveTo !== undefined ? body.effectiveTo : existing.effectiveTo;
    ensureValidRange(effectiveFrom, effectiveTo);
    const pick = (sent, current) => (sent !== undefined ? (sent ?? null) : current);
    const scope = {
        academicYearId: body.academicYearId ?? existing.academicYearId,
        subjectId: pick(body.subjectId, existing.subjectId),
        studyGroupId: pick(body.studyGroupId, existing.studyGroupId),
        teacherId: pick(body.teacherId, existing.teacherId),
    };
    const scopeKey = (0, settlement_scope_1.buildPolicyScopeKey)(scope);
    if (scopeKey !== existing.scopeKey ||
        body.effectiveFrom !== undefined ||
        body.effectiveTo !== undefined) {
        await ensureNoOverlappingPeriod(scopeKey, effectiveFrom, effectiveTo, id);
    }
    const method = body.method ?? existing.method;
    const policy = await client_1.prisma.settlementPolicy.update({
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
            await (0, financial_audit_1.recordAudit)({
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
exports.updateSettlementPolicyService = updateSettlementPolicyService;
// --------------------------------------------------
// Delete
//
// السياسة المستعملة في تخليصٍ لا تُحذف: التخليص يشير إليها بمفتاح
// أجنبي، وحذفُها يقطع أثرَ «بأيّ سياسةٍ حُسب هذا المبلغ». تُعطَّل بدلاً
// من ذلك بـ isActive.
// --------------------------------------------------
const deleteSettlementPolicyService = async (id, userId) => {
    const policy = await findOrThrow(id);
    if (policy._count.settlements > 0) {
        throw new app_errors_1.ConflictException(`Policy is used by ${policy._count.settlements} settlement(s). ` +
            `Deactivate it instead of deleting.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_IN_USE);
    }
    await client_1.prisma.settlementPolicy.delete({ where: { id } });
    await (0, financial_audit_1.recordAudit)({
        entity: "SettlementPolicy",
        entityId: id,
        action: "CANCEL",
        oldValue: policy.name,
        userId,
    });
};
exports.deleteSettlementPolicyService = deleteSettlementPolicyService;
//# sourceMappingURL=settlement-policy.service.js.map