"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTeachingAssignmentService = exports.updateTeachingAssignmentService = exports.createTeachingAssignmentService = exports.getTeachingAssignmentService = exports.listTeachingAssignmentsService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const assignmentSelect = {
    id: true,
    teacherId: true,
    subjectId: true,
    studyGroupId: true,
    academicYearId: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    teacher: {
        select: { id: true, firstName: true, lastName: true, isActive: true },
    },
    subject: { select: { id: true, name: true, code: true } },
    studyGroup: {
        select: {
            id: true,
            name: true,
            type: true,
            maxStudents: true,
            level: {
                select: {
                    id: true,
                    name: true,
                    educationStage: { select: { id: true, name: true } },
                },
            },
        },
    },
    academicYear: { select: { id: true, name: true, isCurrent: true } },
};
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const assignment = await client_1.prisma.teachingAssignment.findUnique({
        where: { id },
        select: {
            id: true,
            teacherId: true,
            subjectId: true,
            studyGroupId: true,
            academicYearId: true,
        },
    });
    if (!assignment) {
        throw new app_errors_1.NotFoundException("Teaching assignment not found", error_code_enum_1.ErrorCodeEnum.TEACHING_ASSIGNMENT_NOT_FOUND);
    }
    return assignment;
};
/**
 * يتحقق من وجود الأطراف الأربعة — **ونشاطِ** الثلاثة الأولى.
 *
 * التعطيل في هذا النظام يعني «لم يعد يُستعمل»: أستاذٌ غادر، مادةٌ رُفعت،
 * فوجٌ أُغلق. وإسنادٌ جديد إليها يُحيي المعطَّل من الباب الخلفي — فيظهر
 * في الجداول والكشوف بينما هو مخفيٌّ عن كل قائمة اختيار. فالمنع هنا لا
 * في الواجهة وحدها: الواجهة تُخفي، والخادم يرفض.
 *
 * السنة الدراسية مستثناة: تصحيحُ إسنادٍ في سنةٍ مضت عملٌ مشروع.
 */
const ensureRelationsExist = async (parts) => {
    if (parts.teacherId) {
        const teacher = await client_1.prisma.teacher.findUnique({
            where: { id: parts.teacherId },
            select: { id: true, isActive: true, firstName: true, lastName: true },
        });
        if (!teacher) {
            throw new app_errors_1.NotFoundException("Teacher not found", error_code_enum_1.ErrorCodeEnum.TEACHER_NOT_FOUND);
        }
        if (!teacher.isActive) {
            throw new app_errors_1.BadRequestException(`Cannot assign an inactive teacher (${teacher.lastName} ${teacher.firstName})`, error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
        }
    }
    if (parts.subjectId) {
        const subject = await client_1.prisma.subject.findUnique({
            where: { id: parts.subjectId },
            select: { id: true, isActive: true, name: true },
        });
        if (!subject) {
            throw new app_errors_1.NotFoundException("Subject not found", error_code_enum_1.ErrorCodeEnum.SUBJECT_NOT_FOUND);
        }
        if (!subject.isActive) {
            throw new app_errors_1.BadRequestException(`Cannot assign an inactive subject (${subject.name})`, error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
        }
    }
    if (parts.studyGroupId) {
        const studyGroup = await client_1.prisma.studyGroup.findUnique({
            where: { id: parts.studyGroupId },
            select: { id: true, isActive: true, name: true },
        });
        if (!studyGroup) {
            throw new app_errors_1.NotFoundException("Study group not found", error_code_enum_1.ErrorCodeEnum.STUDY_GROUP_NOT_FOUND);
        }
        if (!studyGroup.isActive) {
            throw new app_errors_1.BadRequestException(`Cannot assign to an inactive study group (${studyGroup.name})`, error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
        }
    }
    if (parts.academicYearId) {
        const academicYear = await client_1.prisma.academicYear.findUnique({
            where: { id: parts.academicYearId },
            select: { id: true },
        });
        if (!academicYear) {
            throw new app_errors_1.NotFoundException("Academic year not found", error_code_enum_1.ErrorCodeEnum.ACADEMIC_YEAR_NOT_FOUND);
        }
    }
};
/** @@unique([teacherId, subjectId, studyGroupId, academicYearId]) */
const ensureUniqueCombination = async (parts, excludeId) => {
    const duplicate = await client_1.prisma.teachingAssignment.findFirst({
        where: { ...parts, ...(excludeId && { NOT: { id: excludeId } }) },
        select: { id: true },
    });
    if (duplicate) {
        throw new app_errors_1.ConflictException("This teacher is already assigned to this subject for this study group and academic year", error_code_enum_1.ErrorCodeEnum.TEACHING_ASSIGNMENT_EXISTS);
    }
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listTeachingAssignmentsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const where = {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.teacherId && { teacherId: query.teacherId }),
        ...(query.subjectId && { subjectId: query.subjectId }),
        ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
        ...(query.academicYearId && { academicYearId: query.academicYearId }),
    };
    const [assignments, total] = await Promise.all([
        client_1.prisma.teachingAssignment.findMany({
            where,
            select: {
                ...assignmentSelect,
                _count: { select: { enrollments: true, schedules: true } },
            },
            skip,
            take,
            orderBy: [
                { academicYear: { startDate: "desc" } },
                { teacher: { lastName: "asc" } },
                { subject: { name: "asc" } },
            ],
        }),
        client_1.prisma.teachingAssignment.count({ where }),
    ]);
    return { teachingAssignments: assignments, pagination: (0, api_response_1.buildPagination)(total, page, limit) };
};
exports.listTeachingAssignmentsService = listTeachingAssignmentsService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getTeachingAssignmentService = async (id) => {
    await findOrThrow(id);
    return client_1.prisma.teachingAssignment.findUnique({
        where: { id },
        select: {
            ...assignmentSelect,
            _count: { select: { enrollments: true, schedules: true } },
        },
    });
};
exports.getTeachingAssignmentService = getTeachingAssignmentService;
// --------------------------------------------------
// Create
// --------------------------------------------------
const createTeachingAssignmentService = async (body) => {
    await ensureRelationsExist(body);
    await ensureUniqueCombination({
        teacherId: body.teacherId,
        subjectId: body.subjectId,
        studyGroupId: body.studyGroupId,
        academicYearId: body.academicYearId,
    });
    return client_1.prisma.teachingAssignment.create({
        data: {
            teacherId: body.teacherId,
            subjectId: body.subjectId,
            studyGroupId: body.studyGroupId,
            academicYearId: body.academicYearId,
            isActive: body.isActive ?? true,
        },
        select: assignmentSelect,
    });
};
exports.createTeachingAssignmentService = createTeachingAssignmentService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateTeachingAssignmentService = async (id, body) => {
    const existing = await findOrThrow(id);
    await ensureRelationsExist(body);
    const changesKey = body.teacherId !== undefined ||
        body.subjectId !== undefined ||
        body.studyGroupId !== undefined ||
        body.academicYearId !== undefined;
    if (changesKey) {
        await ensureUniqueCombination({
            teacherId: body.teacherId ?? existing.teacherId,
            subjectId: body.subjectId ?? existing.subjectId,
            studyGroupId: body.studyGroupId ?? existing.studyGroupId,
            academicYearId: body.academicYearId ?? existing.academicYearId,
        }, id);
    }
    return client_1.prisma.teachingAssignment.update({
        where: { id },
        data: {
            ...(body.teacherId !== undefined && { teacherId: body.teacherId }),
            ...(body.subjectId !== undefined && { subjectId: body.subjectId }),
            ...(body.studyGroupId !== undefined && {
                studyGroupId: body.studyGroupId,
            }),
            ...(body.academicYearId !== undefined && {
                academicYearId: body.academicYearId,
            }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: assignmentSelect,
    });
};
exports.updateTeachingAssignmentService = updateTeachingAssignmentService;
// --------------------------------------------------
// Delete — ممنوع إن كان له تسجيلات أو حصص
// --------------------------------------------------
const deleteTeachingAssignmentService = async (id) => {
    await findOrThrow(id);
    const relations = await client_1.prisma.teachingAssignment.findUnique({
        where: { id },
        select: { _count: { select: { enrollments: true, schedules: true } } },
    });
    const enrollments = relations?._count.enrollments ?? 0;
    const schedules = relations?._count.schedules ?? 0;
    if (enrollments > 0 || schedules > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: assignment has ${enrollments} enrollment(s) and ` +
            `${schedules} schedule(s). Deactivate it instead.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.teachingAssignment.delete({ where: { id } });
};
exports.deleteTeachingAssignmentService = deleteTeachingAssignmentService;
//# sourceMappingURL=teaching-assignment.service.js.map