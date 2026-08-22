"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSubjectService = exports.updateSubjectService = exports.createSubjectService = exports.getSubjectService = exports.listSubjectsService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
// --------------------------------------------------
// Select موحّد — نفس الحقول في كل الردود
// --------------------------------------------------
const subjectSelect = {
    id: true,
    name: true,
    code: true,
    description: true,
    color: true,
    imagePath: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
};
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findSubjectOrThrow = async (id) => {
    const subject = await client_1.prisma.subject.findUnique({
        where: { id },
        select: subjectSelect,
    });
    if (!subject) {
        throw new app_errors_1.NotFoundException("Subject not found", error_code_enum_1.ErrorCodeEnum.SUBJECT_NOT_FOUND);
    }
    return subject;
};
/**
 * يتحقق من عدم تكرار الاسم أو الرمز.
 * excludeId يُستعمل عند التعديل لتجاهل السجل نفسه.
 */
const ensureUnique = async (data, excludeId) => {
    const conditions = [];
    if (data.name) {
        conditions.push({ name: data.name });
    }
    if (data.code) {
        conditions.push({ code: data.code });
    }
    if (conditions.length === 0)
        return;
    const duplicate = await client_1.prisma.subject.findFirst({
        where: {
            OR: conditions,
            ...(excludeId && { NOT: { id: excludeId } }),
        },
        select: { name: true, code: true },
    });
    if (!duplicate)
        return;
    const field = data.name && duplicate.name === data.name ? "name" : "code";
    throw new app_errors_1.ConflictException(`A subject with this ${field} already exists`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listSubjectsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    // ترتيب الأعمدة في MySQL غير حسّاس لحالة الأحرف (utf8mb4_unicode_ci)
    // لذلك لا حاجة لـ mode: "insensitive" — وهو غير مدعوم أصلاً على MySQL
    const where = {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.search && {
            OR: [
                { name: { contains: query.search } },
                { code: { contains: query.search } },
            ],
        }),
    };
    const [subjects, total] = await Promise.all([
        client_1.prisma.subject.findMany({
            where,
            select: subjectSelect,
            skip,
            take,
            orderBy: { name: "asc" },
        }),
        client_1.prisma.subject.count({ where }),
    ]);
    return { subjects, pagination: (0, api_response_1.buildPagination)(total, page, limit) };
};
exports.listSubjectsService = listSubjectsService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getSubjectService = async (id) => {
    await findSubjectOrThrow(id);
    const subject = await client_1.prisma.subject.findUnique({
        where: { id },
        select: {
            ...subjectSelect,
            _count: {
                select: {
                    teachingAssignments: true,
                    tuitionFees: true,
                },
            },
        },
    });
    return subject;
};
exports.getSubjectService = getSubjectService;
// --------------------------------------------------
// Create
// --------------------------------------------------
const createSubjectService = async (body) => {
    await ensureUnique({ name: body.name, code: body.code });
    return client_1.prisma.subject.create({
        data: {
            name: body.name,
            code: body.code ?? null,
            description: body.description ?? null,
            color: body.color ?? null,
            imagePath: body.imagePath ?? null,
            isActive: body.isActive ?? true,
        },
        select: subjectSelect,
    });
};
exports.createSubjectService = createSubjectService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateSubjectService = async (id, body) => {
    await findSubjectOrThrow(id);
    await ensureUnique({ name: body.name, code: body.code }, id);
    // نمرّر الحقول المُرسلة فقط — undefined يعني "لا تغيّر"
    return client_1.prisma.subject.update({
        where: { id },
        data: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.code !== undefined && { code: body.code }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.color !== undefined && { color: body.color }),
            ...(body.imagePath !== undefined && { imagePath: body.imagePath }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: subjectSelect,
    });
};
exports.updateSubjectService = updateSubjectService;
// --------------------------------------------------
// Delete
//
// المادة مرتبطة بـ TeachingAssignment و TuitionFee بدون onDelete،
// فالحذف مع وجود ارتباطات يفشل على مستوى قاعدة البيانات.
// نمنعه مسبقاً برسالة واضحة ونقترح التعطيل بدل الحذف.
// --------------------------------------------------
const deleteSubjectService = async (id) => {
    await findSubjectOrThrow(id);
    const relations = await client_1.prisma.subject.findUnique({
        where: { id },
        select: {
            _count: {
                select: {
                    teachingAssignments: true,
                    tuitionFees: true,
                },
            },
        },
    });
    const assignments = relations?._count.teachingAssignments ?? 0;
    const fees = relations?._count.tuitionFees ?? 0;
    if (assignments > 0 || fees > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: subject is linked to ${assignments} teaching assignment(s) ` +
            `and ${fees} tuition fee(s). Deactivate it instead.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.subject.delete({ where: { id } });
};
exports.deleteSubjectService = deleteSubjectService;
//# sourceMappingURL=subject.service.js.map