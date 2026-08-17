"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTuitionFeeService = exports.updateTuitionFeeService = exports.createTuitionFeeService = exports.getTuitionFeeService = exports.listTuitionFeesService = void 0;
const prisma_1 = require("../../../generated/prisma");
const client_1 = require("../../core/prisma/client");
const tuition_scope_1 = require("../../core/pricing/tuition-scope");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const tuitionFeeSelect = {
    id: true,
    academicYearId: true,
    subjectId: true,
    studyGroupId: true,
    levelId: true,
    educationStageId: true,
    groupType: true,
    scopeKey: true,
    amount: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    academicYear: { select: { id: true, name: true } },
    subject: { select: { id: true, name: true, code: true } },
    studyGroup: {
        select: {
            id: true,
            name: true,
            type: true,
            level: { select: { id: true, name: true } },
        },
    },
    level: { select: { id: true, name: true } },
    educationStage: { select: { id: true, name: true } },
};
/**
 * Decimal → number، مع وصفٍ جاهز للنطاق.
 *
 * المبالغ هنا صغيرة (حقوق شهرية) فالتحويل آمن، ويُجنّب الواجهة
 * التعامل مع كائن Decimal. و`scope` و`specificity` محسوبان هنا لا
 * في الواجهة، فترتيبُ الأخصّ واحدٌ في الطرفين.
 */
const toResponse = (fee) => ({
    ...fee,
    amount: Number(fee.amount),
    scope: (0, tuition_scope_1.describeScope)(fee),
    specificity: (0, tuition_scope_1.scopeSpecificity)(fee),
});
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const fee = await client_1.prisma.tuitionFee.findUnique({
        where: { id },
        select: tuitionFeeSelect,
    });
    if (!fee) {
        throw new app_errors_1.NotFoundException("Tuition fee not found", error_code_enum_1.ErrorCodeEnum.TUITION_FEE_NOT_FOUND);
    }
    return fee;
};
const ensureSubjectExists = async (subjectId) => {
    const subject = await client_1.prisma.subject.findUnique({
        where: { id: subjectId },
        select: { id: true },
    });
    if (!subject) {
        throw new app_errors_1.NotFoundException("Subject not found", error_code_enum_1.ErrorCodeEnum.SUBJECT_NOT_FOUND);
    }
};
/**
 * وجودُ كل مرجعٍ في النطاق.
 *
 * ولا يُتحقَّق من الاتّساق بينها — أي أنّ الفوج ينتمي فعلاً إلى
 * المستوى المذكور — عمداً: النطاق شروطٌ تُجتمع لا شجرةٌ تُتبع، وصفٌّ
 * بفوجٍ ومستوًى لا ينتمي إليه ببساطة لا يطابق شيئاً. منعُه يحتاج
 * استعلاماتٍ إضافية لحماية المستخدم من إدخالٍ لا يضرّ.
 */
const ensureScopeExists = async (scope) => {
    if (scope.studyGroupId) {
        const studyGroup = await client_1.prisma.studyGroup.findUnique({
            where: { id: scope.studyGroupId },
            select: { id: true },
        });
        if (!studyGroup) {
            throw new app_errors_1.NotFoundException("Study group not found", error_code_enum_1.ErrorCodeEnum.STUDY_GROUP_NOT_FOUND);
        }
    }
    if (scope.levelId) {
        const level = await client_1.prisma.level.findUnique({
            where: { id: scope.levelId },
            select: { id: true },
        });
        if (!level) {
            throw new app_errors_1.NotFoundException("Level not found", error_code_enum_1.ErrorCodeEnum.LEVEL_NOT_FOUND);
        }
    }
    if (scope.educationStageId) {
        const stage = await client_1.prisma.educationStage.findUnique({
            where: { id: scope.educationStageId },
            select: { id: true },
        });
        if (!stage) {
            throw new app_errors_1.NotFoundException("Education stage not found", error_code_enum_1.ErrorCodeEnum.EDUCATION_STAGE_NOT_FOUND);
        }
    }
};
const ensureAcademicYearExists = async (academicYearId) => {
    const year = await client_1.prisma.academicYear.findUnique({
        where: { id: academicYearId },
        select: { id: true },
    });
    if (!year) {
        throw new app_errors_1.NotFoundException("Academic year not found", error_code_enum_1.ErrorCodeEnum.ACADEMIC_YEAR_NOT_FOUND);
    }
};
/**
 * سعرٌ واحد لكل نطاق في كل سنة.
 *
 * كان هنا فحصُ تداخل فتراتٍ زمنية؛ وقد سقط مع التواريخ. والمقارنة
 * بالبصمة لا بالمادة والفوج: نطاقان مختلفان يتعايشان في السنة نفسها،
 * وذلك هو الغرض من التدرّج — سعرٌ للطور وسعرٌ أخصّ لفوجٍ فيه، والأخصّ
 * يفوز عند الحساب.
 */
const ensureScopeIsFree = async (scopeKey, scopeLabel, excludeId) => {
    const existing = await client_1.prisma.tuitionFee.findFirst({
        where: {
            scopeKey,
            ...(excludeId && { NOT: { id: excludeId } }),
        },
        select: { amount: true },
    });
    if (existing) {
        throw new app_errors_1.ConflictException(`يوجد حقّ اشتراك بنفس النطاق (${scopeLabel}) لهذه المادة والسنة ` +
            `بمبلغ ${Number(existing.amount)} — عدّله بدل إضافة صفٍّ ثانٍ.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listTuitionFeesService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const where = {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.academicYearId && { academicYearId: query.academicYearId }),
        ...(query.subjectId && { subjectId: query.subjectId }),
        ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
        ...(query.levelId && { levelId: query.levelId }),
        ...(query.educationStageId && {
            educationStageId: query.educationStageId,
        }),
        ...(query.groupType && { groupType: query.groupType }),
    };
    const [fees, total] = await Promise.all([
        client_1.prisma.tuitionFee.findMany({
            where,
            select: tuitionFeeSelect,
            skip,
            take,
            orderBy: [
                { subject: { name: "asc" } },
                { studyGroup: { name: "asc" } },
            ],
        }),
        client_1.prisma.tuitionFee.count({ where }),
    ]);
    return {
        tuitionFees: fees.map(toResponse),
        pagination: (0, api_response_1.buildPagination)(total, page, limit),
    };
};
exports.listTuitionFeesService = listTuitionFeesService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getTuitionFeeService = async (id) => {
    const fee = await findOrThrow(id);
    return toResponse(fee);
};
exports.getTuitionFeeService = getTuitionFeeService;
// --------------------------------------------------
// Create
// --------------------------------------------------
const createTuitionFeeService = async (body) => {
    await ensureAcademicYearExists(body.academicYearId);
    await ensureSubjectExists(body.subjectId);
    await ensureScopeExists(body);
    const scope = {
        academicYearId: body.academicYearId,
        subjectId: body.subjectId,
        studyGroupId: body.studyGroupId ?? null,
        levelId: body.levelId ?? null,
        educationStageId: body.educationStageId ?? null,
        groupType: body.groupType ?? null,
    };
    const scopeKey = (0, tuition_scope_1.buildScopeKey)(scope);
    await ensureScopeIsFree(scopeKey, (0, tuition_scope_1.describeScope)(scope));
    const fee = await client_1.prisma.tuitionFee.create({
        data: {
            ...scope,
            scopeKey,
            amount: new prisma_1.Prisma.Decimal(body.amount),
            isActive: body.isActive ?? true,
        },
        select: tuitionFeeSelect,
    });
    return toResponse(fee);
};
exports.createTuitionFeeService = createTuitionFeeService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateTuitionFeeService = async (id, body) => {
    const existing = await findOrThrow(id);
    if (body.academicYearId) {
        await ensureAcademicYearExists(body.academicYearId);
    }
    if (body.subjectId) {
        await ensureSubjectExists(body.subjectId);
    }
    await ensureScopeExists(body);
    // النطاق بعد التعديل — الحقل غير المرسل يبقى على حاله،
    // والمرسل صراحةً بـ null يُفرَّغ
    const pick = (sent, key) => (sent !== undefined ? (sent ?? null) : (existing[key] ?? null));
    const scope = {
        academicYearId: body.academicYearId ?? existing.academicYearId,
        subjectId: body.subjectId ?? existing.subjectId,
        studyGroupId: pick(body.studyGroupId, "studyGroupId"),
        levelId: pick(body.levelId, "levelId"),
        educationStageId: pick(body.educationStageId, "educationStageId"),
        groupType: pick(body.groupType, "groupType"),
    };
    const scopeKey = (0, tuition_scope_1.buildScopeKey)(scope);
    if (scopeKey !== existing.scopeKey) {
        await ensureScopeIsFree(scopeKey, (0, tuition_scope_1.describeScope)(scope), id);
    }
    const fee = await client_1.prisma.tuitionFee.update({
        where: { id },
        data: {
            ...scope,
            scopeKey,
            ...(body.amount !== undefined && {
                amount: new prisma_1.Prisma.Decimal(body.amount),
            }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: tuitionFeeSelect,
    });
    return toResponse(fee);
};
exports.updateTuitionFeeService = updateTuitionFeeService;
// --------------------------------------------------
// Delete
//
// لا يوجد FK من Invoice نحو TuitionFee — الفاتورة تُخزّن
// المبلغ لحظة الإصدار، فالحذف لا يكسر سجلات سابقة.
// --------------------------------------------------
const deleteTuitionFeeService = async (id) => {
    await findOrThrow(id);
    await client_1.prisma.tuitionFee.delete({ where: { id } });
};
exports.deleteTuitionFeeService = deleteTuitionFeeService;
//# sourceMappingURL=tuition-fee.service.js.map