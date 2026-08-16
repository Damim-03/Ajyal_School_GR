"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTeacherService = exports.updateTeacherService = exports.createTeacherService = exports.getTeacherService = exports.listTeachersService = void 0;
const prisma_1 = require("../../generated/prisma");
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
// --------------------------------------------------
// Selects
//
// الراتب بيانات حسّاسة — نستثنيه من القائمة ونُظهره
// في التفصيل فقط. لتوسيع ذلك أضف صلاحية مستقلة.
// --------------------------------------------------
const teacherListSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    gender: true,
    birthDate: true,
    hireDate: true,
    specialization: true,
    qualification: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
};
const teacherDetailSelect = {
    ...teacherListSelect,
    address: true,
    salary: true,
};
/** Decimal → number (أو null) قبل الإرسال */
const toResponse = (teacher) => ({
    ...teacher,
    ...(teacher.salary !== undefined && {
        salary: teacher.salary === null ? null : Number(teacher.salary),
    }),
});
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const teacher = await client_1.prisma.teacher.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!teacher) {
        throw new app_errors_1.NotFoundException("Teacher not found", error_code_enum_1.ErrorCodeEnum.TEACHER_NOT_FOUND);
    }
    return teacher;
};
const ensureUniqueEmail = async (email, excludeId) => {
    const duplicate = await client_1.prisma.teacher.findFirst({
        where: { email, ...(excludeId && { NOT: { id: excludeId } }) },
        select: { id: true },
    });
    if (duplicate) {
        throw new app_errors_1.ConflictException("A teacher with this email already exists", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listTeachersService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const where = {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.gender && { gender: query.gender }),
        ...(query.specialization && {
            specialization: { contains: query.specialization },
        }),
        ...(query.search && {
            OR: [
                { firstName: { contains: query.search } },
                { lastName: { contains: query.search } },
                { email: { contains: query.search } },
                { phone: { contains: query.search } },
            ],
        }),
    };
    const [teachers, total] = await Promise.all([
        client_1.prisma.teacher.findMany({
            where,
            select: {
                ...teacherListSelect,
                _count: { select: { teachingAssignments: true } },
            },
            skip,
            take,
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        }),
        client_1.prisma.teacher.count({ where }),
    ]);
    return { teachers, pagination: (0, api_response_1.buildPagination)(total, page, limit) };
};
exports.listTeachersService = listTeachersService;
// --------------------------------------------------
// Get by id — مع الإسنادات التدريسية
// --------------------------------------------------
const getTeacherService = async (id) => {
    await findOrThrow(id);
    const teacher = await client_1.prisma.teacher.findUnique({
        where: { id },
        select: {
            ...teacherDetailSelect,
            teachingAssignments: {
                select: {
                    id: true,
                    isActive: true,
                    subject: { select: { id: true, name: true } },
                    studyGroup: {
                        select: {
                            id: true,
                            name: true,
                            level: { select: { id: true, name: true } },
                        },
                    },
                    academicYear: { select: { id: true, name: true, isCurrent: true } },
                },
                orderBy: { createdAt: "desc" },
            },
            _count: { select: { teachingAssignments: true } },
        },
    });
    return teacher ? toResponse(teacher) : null;
};
exports.getTeacherService = getTeacherService;
// --------------------------------------------------
// Create
// --------------------------------------------------
const createTeacherService = async (body) => {
    if (body.email) {
        await ensureUniqueEmail(body.email);
    }
    const teacher = await client_1.prisma.teacher.create({
        data: {
            firstName: body.firstName,
            lastName: body.lastName,
            email: body.email ?? null,
            phone: body.phone ?? null,
            gender: body.gender,
            birthDate: body.birthDate ?? null,
            hireDate: body.hireDate,
            address: body.address ?? null,
            qualification: body.qualification ?? null,
            specialization: body.specialization ?? null,
            salary: body.salary === null || body.salary === undefined
                ? null
                : new prisma_1.Prisma.Decimal(body.salary),
            isActive: body.isActive ?? true,
        },
        select: teacherDetailSelect,
    });
    return toResponse(teacher);
};
exports.createTeacherService = createTeacherService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateTeacherService = async (id, body) => {
    await findOrThrow(id);
    if (body.email) {
        await ensureUniqueEmail(body.email, id);
    }
    const teacher = await client_1.prisma.teacher.update({
        where: { id },
        data: {
            ...(body.firstName !== undefined && { firstName: body.firstName }),
            ...(body.lastName !== undefined && { lastName: body.lastName }),
            ...(body.email !== undefined && { email: body.email }),
            ...(body.phone !== undefined && { phone: body.phone }),
            ...(body.gender !== undefined && { gender: body.gender }),
            ...(body.birthDate !== undefined && { birthDate: body.birthDate }),
            ...(body.hireDate !== undefined && { hireDate: body.hireDate }),
            ...(body.address !== undefined && { address: body.address }),
            ...(body.qualification !== undefined && {
                qualification: body.qualification,
            }),
            ...(body.specialization !== undefined && {
                specialization: body.specialization,
            }),
            ...(body.salary !== undefined && {
                salary: body.salary === null ? null : new prisma_1.Prisma.Decimal(body.salary),
            }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: teacherDetailSelect,
    });
    return toResponse(teacher);
};
exports.updateTeacherService = updateTeacherService;
// --------------------------------------------------
// Delete — ممنوع إن كان له إسنادات تدريسية
// --------------------------------------------------
const deleteTeacherService = async (id) => {
    await findOrThrow(id);
    const assignments = await client_1.prisma.teachingAssignment.count({
        where: { teacherId: id },
    });
    if (assignments > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: teacher has ${assignments} teaching assignment(s). ` +
            `Deactivate the teacher instead.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.teacher.delete({ where: { id } });
};
exports.deleteTeacherService = deleteTeacherService;
//# sourceMappingURL=teacher.service.js.map