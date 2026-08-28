"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEducationStageService = exports.updateEducationStageService = exports.createEducationStageService = exports.getEducationStageService = exports.listEducationStagesService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const text_match_1 = require("../../core/search/text-match");
const educationStageSelect = {
    id: true,
    name: true,
    type: true,
    sortOrder: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
};
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const stage = await client_1.prisma.educationStage.findUnique({
        where: { id },
        select: educationStageSelect,
    });
    if (!stage) {
        throw new app_errors_1.NotFoundException("Education stage not found", error_code_enum_1.ErrorCodeEnum.EDUCATION_STAGE_NOT_FOUND);
    }
    return stage;
};
const ensureUniqueName = async (name, excludeId) => {
    const duplicate = await client_1.prisma.educationStage.findFirst({
        where: { name, ...(excludeId && { NOT: { id: excludeId } }) },
        select: { id: true },
    });
    if (duplicate) {
        throw new app_errors_1.ConflictException("An education stage with this name already exists", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
};
/** آخر ترتيب + 1 — يُستعمل حين لا تُرسل sortOrder */
const nextSortOrder = async () => {
    const last = await client_1.prisma.educationStage.findFirst({
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listEducationStagesService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    /* مطابقةٌ بترتيبٍ صريح — انظر `core/search/text-match` */
    const searchIds = query.search
        ? await (0, text_match_1.matchTextIds)("EducationStage", [(0, text_match_1.containsOn)(["name"], query.search)])
        : null;
    const where = {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.type && { type: query.type }),
        ...(searchIds && { id: { in: searchIds } }),
    };
    const [educationStages, total] = await Promise.all([
        client_1.prisma.educationStage.findMany({
            where,
            select: {
                ...educationStageSelect,
                _count: { select: { levels: true } },
            },
            skip,
            take,
            orderBy: { sortOrder: "asc" },
        }),
        client_1.prisma.educationStage.count({ where }),
    ]);
    return { educationStages, pagination: (0, api_response_1.buildPagination)(total, page, limit) };
};
exports.listEducationStagesService = listEducationStagesService;
// --------------------------------------------------
// Get by id — مع المستويات التابعة
// --------------------------------------------------
const getEducationStageService = async (id) => {
    await findOrThrow(id);
    return client_1.prisma.educationStage.findUnique({
        where: { id },
        select: {
            ...educationStageSelect,
            levels: {
                select: { id: true, name: true, sortOrder: true, isActive: true },
                orderBy: { sortOrder: "asc" },
            },
            _count: { select: { levels: true } },
        },
    });
};
exports.getEducationStageService = getEducationStageService;
// --------------------------------------------------
// Create
// --------------------------------------------------
const createEducationStageService = async (body) => {
    await ensureUniqueName(body.name);
    return client_1.prisma.educationStage.create({
        data: {
            name: body.name,
            type: body.type,
            sortOrder: body.sortOrder ?? (await nextSortOrder()),
            isActive: body.isActive ?? true,
        },
        select: educationStageSelect,
    });
};
exports.createEducationStageService = createEducationStageService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateEducationStageService = async (id, body) => {
    await findOrThrow(id);
    if (body.name) {
        await ensureUniqueName(body.name, id);
    }
    return client_1.prisma.educationStage.update({
        where: { id },
        data: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.type !== undefined && { type: body.type }),
            ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: educationStageSelect,
    });
};
exports.updateEducationStageService = updateEducationStageService;
// --------------------------------------------------
// Delete — ممنوع إن كانت تحتوي مستويات
// --------------------------------------------------
const deleteEducationStageService = async (id) => {
    await findOrThrow(id);
    const levels = await client_1.prisma.level.count({ where: { educationStageId: id } });
    if (levels > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: education stage contains ${levels} level(s). ` +
            `Delete them first or deactivate the stage instead.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.educationStage.delete({ where: { id } });
};
exports.deleteEducationStageService = deleteEducationStageService;
//# sourceMappingURL=education-stage.service.js.map