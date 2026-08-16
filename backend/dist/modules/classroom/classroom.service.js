"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteClassroomService = exports.updateClassroomService = exports.createClassroomService = exports.getClassroomService = exports.listClassroomsService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const classroomSelect = {
    id: true,
    name: true,
    code: true,
    capacity: true,
    floor: true,
    description: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
};
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const classroom = await client_1.prisma.classroom.findUnique({
        where: { id },
        select: classroomSelect,
    });
    if (!classroom) {
        throw new app_errors_1.NotFoundException("Classroom not found", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    return classroom;
};
/**
 * الاسم غير فريد في الـ schema، لكن code فريد.
 * نمنع تكرار الرمز برسالة واضحة بدل خطأ P2002.
 */
const ensureUniqueCode = async (code, excludeId) => {
    const duplicate = await client_1.prisma.classroom.findFirst({
        where: { code, ...(excludeId && { NOT: { id: excludeId } }) },
        select: { id: true },
    });
    if (duplicate) {
        throw new app_errors_1.ConflictException("A classroom with this code already exists", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listClassroomsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const where = {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.floor !== undefined && { floor: query.floor }),
        ...(query.search && {
            OR: [
                { name: { contains: query.search } },
                { code: { contains: query.search } },
            ],
        }),
    };
    const [classrooms, total] = await Promise.all([
        client_1.prisma.classroom.findMany({
            where,
            select: {
                ...classroomSelect,
                _count: { select: { schedules: true } },
            },
            skip,
            take,
            orderBy: [{ floor: "asc" }, { name: "asc" }],
        }),
        client_1.prisma.classroom.count({ where }),
    ]);
    return { classrooms, pagination: (0, api_response_1.buildPagination)(total, page, limit) };
};
exports.listClassroomsService = listClassroomsService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getClassroomService = async (id) => {
    await findOrThrow(id);
    return client_1.prisma.classroom.findUnique({
        where: { id },
        select: {
            ...classroomSelect,
            _count: { select: { schedules: true } },
        },
    });
};
exports.getClassroomService = getClassroomService;
// --------------------------------------------------
// Create
// --------------------------------------------------
const createClassroomService = async (body) => {
    if (body.code) {
        await ensureUniqueCode(body.code);
    }
    return client_1.prisma.classroom.create({
        data: {
            name: body.name,
            code: body.code ?? null,
            capacity: body.capacity ?? null,
            floor: body.floor ?? null,
            description: body.description ?? null,
            isActive: body.isActive ?? true,
        },
        select: classroomSelect,
    });
};
exports.createClassroomService = createClassroomService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateClassroomService = async (id, body) => {
    await findOrThrow(id);
    if (body.code) {
        await ensureUniqueCode(body.code, id);
    }
    return client_1.prisma.classroom.update({
        where: { id },
        data: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.code !== undefined && { code: body.code }),
            ...(body.capacity !== undefined && { capacity: body.capacity }),
            ...(body.floor !== undefined && { floor: body.floor }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: classroomSelect,
    });
};
exports.updateClassroomService = updateClassroomService;
// --------------------------------------------------
// Delete — ممنوع إن كانت مستعملة في جدول الحصص
// --------------------------------------------------
const deleteClassroomService = async (id) => {
    await findOrThrow(id);
    const schedules = await client_1.prisma.schedule.count({ where: { classroomId: id } });
    if (schedules > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: classroom is used in ${schedules} schedule(s). ` +
            `Deactivate it instead.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.classroom.delete({ where: { id } });
};
exports.deleteClassroomService = deleteClassroomService;
//# sourceMappingURL=classroom.service.js.map