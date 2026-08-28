"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLevelService = exports.updateLevelService = exports.createLevelService = exports.getLevelService = exports.listLevelsService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const text_match_1 = require("../../core/search/text-match");
const levelSelect = {
    id: true,
    educationStageId: true,
    name: true,
    sortOrder: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    educationStage: {
        select: { id: true, name: true, type: true },
    },
};
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const level = await client_1.prisma.level.findUnique({
        where: { id },
        select: levelSelect,
    });
    if (!level) {
        throw new app_errors_1.NotFoundException("Level not found", error_code_enum_1.ErrorCodeEnum.LEVEL_NOT_FOUND);
    }
    return level;
};
const ensureStageExists = async (educationStageId) => {
    const stage = await client_1.prisma.educationStage.findUnique({
        where: { id: educationStageId },
        select: { id: true },
    });
    if (!stage) {
        throw new app_errors_1.NotFoundException("Education stage not found", error_code_enum_1.ErrorCodeEnum.EDUCATION_STAGE_NOT_FOUND);
    }
};
/** الاسم فريد داخل الطور الواحد — @@unique([educationStageId, name]) */
const ensureUniqueName = async (educationStageId, name, excludeId) => {
    const duplicate = await client_1.prisma.level.findFirst({
        where: {
            educationStageId,
            name,
            ...(excludeId && { NOT: { id: excludeId } }),
        },
        select: { id: true },
    });
    if (duplicate) {
        throw new app_errors_1.ConflictException("A level with this name already exists in this education stage", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
};
const nextSortOrder = async (educationStageId) => {
    const last = await client_1.prisma.level.findFirst({
        where: { educationStageId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listLevelsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    /* مطابقةٌ بترتيبٍ صريح — انظر `core/search/text-match` */
    const searchIds = query.search
        ? await (0, text_match_1.matchTextIds)("Level", [(0, text_match_1.containsOn)(["name"], query.search)])
        : null;
    const where = {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.educationStageId && {
            educationStageId: query.educationStageId,
        }),
        ...(searchIds && { id: { in: searchIds } }),
    };
    const [levels, total] = await Promise.all([
        client_1.prisma.level.findMany({
            where,
            select: {
                ...levelSelect,
                _count: { select: { studyGroups: true } },
            },
            skip,
            take,
            orderBy: [
                { educationStage: { sortOrder: "asc" } },
                { sortOrder: "asc" },
            ],
        }),
        client_1.prisma.level.count({ where }),
    ]);
    return { levels, pagination: (0, api_response_1.buildPagination)(total, page, limit) };
};
exports.listLevelsService = listLevelsService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getLevelService = async (id) => {
    await findOrThrow(id);
    return client_1.prisma.level.findUnique({
        where: { id },
        select: {
            ...levelSelect,
            studyGroups: {
                select: { id: true, name: true, type: true, isActive: true },
                orderBy: { name: "asc" },
            },
            _count: { select: { studyGroups: true } },
        },
    });
};
exports.getLevelService = getLevelService;
// --------------------------------------------------
// Create
// --------------------------------------------------
const createLevelService = async (body) => {
    await ensureStageExists(body.educationStageId);
    await ensureUniqueName(body.educationStageId, body.name);
    return client_1.prisma.level.create({
        data: {
            educationStageId: body.educationStageId,
            name: body.name,
            sortOrder: body.sortOrder ?? (await nextSortOrder(body.educationStageId)),
            isActive: body.isActive ?? true,
        },
        select: levelSelect,
    });
};
exports.createLevelService = createLevelService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateLevelService = async (id, body) => {
    const existing = await findOrThrow(id);
    if (body.educationStageId) {
        await ensureStageExists(body.educationStageId);
    }
    // الطور المستهدف بعد التعديل — لفحص تفرّد الاسم داخله
    const targetStageId = body.educationStageId ?? existing.educationStageId;
    if (body.name || body.educationStageId) {
        await ensureUniqueName(targetStageId, body.name ?? existing.name, id);
    }
    return client_1.prisma.level.update({
        where: { id },
        data: {
            ...(body.educationStageId !== undefined && {
                educationStageId: body.educationStageId,
            }),
            ...(body.name !== undefined && { name: body.name }),
            ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: levelSelect,
    });
};
exports.updateLevelService = updateLevelService;
// --------------------------------------------------
// Delete — ممنوع إن كان يحتوي أفواجاً
// --------------------------------------------------
const deleteLevelService = async (id) => {
    await findOrThrow(id);
    const studyGroups = await client_1.prisma.studyGroup.count({ where: { levelId: id } });
    if (studyGroups > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: level contains ${studyGroups} study group(s). ` +
            `Delete them first or deactivate the level instead.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.level.delete({ where: { id } });
};
exports.deleteLevelService = deleteLevelService;
//# sourceMappingURL=level.service.js.map