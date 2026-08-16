"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAcademicYearService = exports.updateAcademicYearService = exports.createAcademicYearService = exports.getAcademicYearService = exports.listAcademicYearsService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const academicYearSelect = {
    id: true,
    name: true,
    startDate: true,
    endDate: true,
    isCurrent: true,
    isActive: true,
    sessionsPerMonth: true,
    createdAt: true,
    updatedAt: true,
};
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const academicYear = await client_1.prisma.academicYear.findUnique({
        where: { id },
        select: academicYearSelect,
    });
    if (!academicYear) {
        throw new app_errors_1.NotFoundException("Academic year not found", error_code_enum_1.ErrorCodeEnum.ACADEMIC_YEAR_NOT_FOUND);
    }
    return academicYear;
};
const ensureUniqueName = async (name, excludeId) => {
    const duplicate = await client_1.prisma.academicYear.findFirst({
        where: {
            name,
            ...(excludeId && { NOT: { id: excludeId } }),
        },
        select: { id: true },
    });
    if (duplicate) {
        throw new app_errors_1.ConflictException("An academic year with this name already exists", error_code_enum_1.ErrorCodeEnum.ACADEMIC_YEAR_ALREADY_EXISTS);
    }
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listAcademicYearsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const where = {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.isCurrent !== undefined && { isCurrent: query.isCurrent }),
        ...(query.search && { name: { contains: query.search } }),
    };
    const [academicYears, total] = await Promise.all([
        client_1.prisma.academicYear.findMany({
            where,
            select: academicYearSelect,
            skip,
            take,
            orderBy: { startDate: "desc" },
        }),
        client_1.prisma.academicYear.count({ where }),
    ]);
    return { academicYears, pagination: (0, api_response_1.buildPagination)(total, page, limit) };
};
exports.listAcademicYearsService = listAcademicYearsService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getAcademicYearService = async (id) => {
    await findOrThrow(id);
    return client_1.prisma.academicYear.findUnique({
        where: { id },
        select: {
            ...academicYearSelect,
            _count: {
                select: {
                    teachingAssignments: true,
                    invoices: true,
                },
            },
        },
    });
};
exports.getAcademicYearService = getAcademicYearService;
// --------------------------------------------------
// Create
//
// isCurrent = true → ننزع العلم عن الباقي داخل transaction
// --------------------------------------------------
const createAcademicYearService = async (body) => {
    await ensureUniqueName(body.name);
    return client_1.prisma.$transaction(async (tx) => {
        if (body.isCurrent) {
            await tx.academicYear.updateMany({
                where: { isCurrent: true },
                data: { isCurrent: false },
            });
        }
        return tx.academicYear.create({
            data: {
                name: body.name,
                startDate: body.startDate,
                endDate: body.endDate,
                isCurrent: body.isCurrent ?? false,
                isActive: body.isActive ?? true,
                ...(body.sessionsPerMonth !== undefined && {
                    sessionsPerMonth: body.sessionsPerMonth,
                }),
            },
            select: academicYearSelect,
        });
    });
};
exports.createAcademicYearService = createAcademicYearService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateAcademicYearService = async (id, body) => {
    const existing = await findOrThrow(id);
    if (body.name) {
        await ensureUniqueName(body.name, id);
    }
    // نقارن التاريخ المُرسل بالمخزَّن عند إرسال أحدهما فقط
    const startDate = body.startDate ?? existing.startDate;
    const endDate = body.endDate ?? existing.endDate;
    if (endDate <= startDate) {
        throw new app_errors_1.BadRequestException("End date must be after start date", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    return client_1.prisma.$transaction(async (tx) => {
        if (body.isCurrent === true) {
            await tx.academicYear.updateMany({
                where: { isCurrent: true, NOT: { id } },
                data: { isCurrent: false },
            });
        }
        return tx.academicYear.update({
            where: { id },
            data: {
                ...(body.name !== undefined && { name: body.name }),
                ...(body.startDate !== undefined && { startDate: body.startDate }),
                ...(body.endDate !== undefined && { endDate: body.endDate }),
                ...(body.isCurrent !== undefined && { isCurrent: body.isCurrent }),
                ...(body.isActive !== undefined && { isActive: body.isActive }),
                ...(body.sessionsPerMonth !== undefined && {
                    sessionsPerMonth: body.sessionsPerMonth,
                }),
            },
            select: academicYearSelect,
        });
    });
};
exports.updateAcademicYearService = updateAcademicYearService;
// --------------------------------------------------
// Delete
// --------------------------------------------------
const deleteAcademicYearService = async (id) => {
    await findOrThrow(id);
    const relations = await client_1.prisma.academicYear.findUnique({
        where: { id },
        select: {
            _count: {
                select: { teachingAssignments: true, invoices: true },
            },
        },
    });
    const assignments = relations?._count.teachingAssignments ?? 0;
    const invoices = relations?._count.invoices ?? 0;
    if (assignments > 0 || invoices > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: academic year is linked to ${assignments} teaching assignment(s) ` +
            `and ${invoices} invoice(s). Deactivate it instead.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.academicYear.delete({ where: { id } });
};
exports.deleteAcademicYearService = deleteAcademicYearService;
//# sourceMappingURL=academic-year.service.js.map