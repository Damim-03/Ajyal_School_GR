"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteStudyGroupService = exports.updateStudyGroupService = exports.createStudyGroupService = exports.getStudyGroupService = exports.listStudyGroupsService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const studyGroupSelect = {
    id: true,
    levelId: true,
    name: true,
    type: true,
    maxStudents: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    level: {
        select: {
            id: true,
            name: true,
            educationStage: { select: { id: true, name: true, type: true } },
        },
    },
};
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const studyGroup = await client_1.prisma.studyGroup.findUnique({
        where: { id },
        select: studyGroupSelect,
    });
    if (!studyGroup) {
        throw new app_errors_1.NotFoundException("Study group not found", error_code_enum_1.ErrorCodeEnum.STUDY_GROUP_NOT_FOUND);
    }
    return studyGroup;
};
const ensureLevelExists = async (levelId) => {
    const level = await client_1.prisma.level.findUnique({
        where: { id: levelId },
        select: { id: true },
    });
    if (!level) {
        throw new app_errors_1.NotFoundException("Level not found", error_code_enum_1.ErrorCodeEnum.LEVEL_NOT_FOUND);
    }
};
/** الاسم فريد داخل المستوى — @@unique([levelId, name]) */
const ensureUniqueName = async (levelId, name, excludeId) => {
    const duplicate = await client_1.prisma.studyGroup.findFirst({
        where: { levelId, name, ...(excludeId && { NOT: { id: excludeId } }) },
        select: { id: true },
    });
    if (duplicate) {
        throw new app_errors_1.ConflictException("A study group with this name already exists in this level", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listStudyGroupsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const where = {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.levelId && { levelId: query.levelId }),
        ...(query.type && { type: query.type }),
        ...(query.search && { name: { contains: query.search } }),
    };
    const [studyGroups, total] = await Promise.all([
        client_1.prisma.studyGroup.findMany({
            where,
            select: {
                ...studyGroupSelect,
                _count: { select: { teachingAssignments: true, tuitionFees: true } },
            },
            skip,
            take,
            orderBy: [{ level: { sortOrder: "asc" } }, { name: "asc" }],
        }),
        client_1.prisma.studyGroup.count({ where }),
    ]);
    return { studyGroups, pagination: (0, api_response_1.buildPagination)(total, page, limit) };
};
exports.listStudyGroupsService = listStudyGroupsService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getStudyGroupService = async (id) => {
    await findOrThrow(id);
    return client_1.prisma.studyGroup.findUnique({
        where: { id },
        select: {
            ...studyGroupSelect,
            _count: { select: { teachingAssignments: true, tuitionFees: true } },
        },
    });
};
exports.getStudyGroupService = getStudyGroupService;
// --------------------------------------------------
// Create
// --------------------------------------------------
const createStudyGroupService = async (body) => {
    await ensureLevelExists(body.levelId);
    await ensureUniqueName(body.levelId, body.name);
    return client_1.prisma.studyGroup.create({
        data: {
            levelId: body.levelId,
            name: body.name,
            type: body.type ?? "NORMAL",
            maxStudents: body.maxStudents ?? null,
            isActive: body.isActive ?? true,
        },
        select: studyGroupSelect,
    });
};
exports.createStudyGroupService = createStudyGroupService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateStudyGroupService = async (id, body) => {
    const existing = await findOrThrow(id);
    if (body.levelId) {
        await ensureLevelExists(body.levelId);
    }
    const targetLevelId = body.levelId ?? existing.levelId;
    if (body.name || body.levelId) {
        await ensureUniqueName(targetLevelId, body.name ?? existing.name, id);
    }
    return client_1.prisma.studyGroup.update({
        where: { id },
        data: {
            ...(body.levelId !== undefined && { levelId: body.levelId }),
            ...(body.name !== undefined && { name: body.name }),
            ...(body.type !== undefined && { type: body.type }),
            ...(body.maxStudents !== undefined && { maxStudents: body.maxStudents }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: studyGroupSelect,
    });
};
exports.updateStudyGroupService = updateStudyGroupService;
// --------------------------------------------------
// Delete
// --------------------------------------------------
const deleteStudyGroupService = async (id) => {
    await findOrThrow(id);
    const relations = await client_1.prisma.studyGroup.findUnique({
        where: { id },
        select: {
            _count: { select: { teachingAssignments: true, tuitionFees: true } },
        },
    });
    const assignments = relations?._count.teachingAssignments ?? 0;
    const fees = relations?._count.tuitionFees ?? 0;
    if (assignments > 0 || fees > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: study group is linked to ${assignments} teaching assignment(s) ` +
            `and ${fees} tuition fee(s). Deactivate it instead.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.studyGroup.delete({ where: { id } });
};
exports.deleteStudyGroupService = deleteStudyGroupService;
//# sourceMappingURL=study-group.service.js.map