"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteStudentService = exports.updateStudentService = exports.createStudentService = exports.getStudentEnrollmentsService = exports.getStudentService = exports.listStudentsService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const document_types_1 = require("./document.types");
const studentSelect = {
    id: true,
    firstName: true,
    lastName: true,
    gender: true,
    birthDate: true,
    avatar: true,
    phone: true,
    parentPhone: true,
    address: true,
    schoolName: true,
    emergencyPhone: true,
    registrationDate: true,
    note: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
};
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const student = await client_1.prisma.student.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!student) {
        throw new app_errors_1.NotFoundException("Student not found", error_code_enum_1.ErrorCodeEnum.STUDENT_NOT_FOUND);
    }
    return student;
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listStudentsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    /*
     * شروط الإسناد التدريسي المرتبط بتسجيلات الطالب.
     * المستوى يمرّ عبر الفوج: TeachingAssignment ← StudyGroup ← Level.
     */
    const assignmentFilter = {
        ...(query.subjectId && { subjectId: query.subjectId }),
        ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
        ...(query.teacherId && { teacherId: query.teacherId }),
        ...(query.academicYearId && { academicYearId: query.academicYearId }),
        ...(query.levelId && { studyGroup: { levelId: query.levelId } }),
    };
    const hasEnrollmentFilter = Object.keys(assignmentFilter).length > 0;
    const where = {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.gender && { gender: query.gender }),
        ...(query.search && {
            OR: [
                { firstName: { contains: query.search } },
                { lastName: { contains: query.search } },
                { phone: { contains: query.search } },
                { parentPhone: { contains: query.search } },
            ],
        }),
        /*
         * `some` لا `every`: الطالب يُطابق إن كان **أحد** تسجيلاته يحقّق
         * الشرط. و`every` كانت ستعني «كل مواده هي هذه المادة» — وهو سؤال
         * لا يطرحه أحد.
         */
        ...(hasEnrollmentFilter && {
            enrollments: {
                some: {
                    ...(query.includeInactiveEnrollments !== true && { isActive: true }),
                    teachingAssignment: assignmentFilter,
                },
            },
        }),
    };
    /*
     * فلتر اكتمال الملف.
     *
     * «مكتمل» = يملك كلّ الأنواع المطلوبة، فيُترجَم إلى شرطٍ لكلّ نوع
     * على حدة. وهذا يبقيه استعلاماً واحداً يحترم الترقيم — بخلاف الترشيح
     * بعد الجلب الذي يكسر أعداد الصفحات.
     */
    if (query.documentsComplete !== undefined) {
        const hasAllRequired = document_types_1.REQUIRED_KEYS.map((type) => ({
            documents: { some: { type } },
        }));
        if (query.documentsComplete)
            where.AND = hasAllRequired;
        else
            where.NOT = { AND: hasAllRequired };
    }
    const [students, total] = await Promise.all([
        client_1.prisma.student.findMany({
            where,
            select: {
                ...studentSelect,
                _count: { select: { enrollments: true } },
                /*
                 * أنواع الوثائق الموجودة فقط — لا مساراتها.
                 * الاكتمال يُحسب منها في الواجهة بلا طلبٍ إضافي لكل طالب.
                 */
                documents: { select: { type: true } },
            },
            skip,
            take,
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        }),
        client_1.prisma.student.count({ where }),
    ]);
    return {
        students: students.map((student) => ({
            ...student,
            documentTypes: student.documents.map((d) => d.type),
            documents: undefined,
            completeness: (0, document_types_1.completenessOf)(student.documents.map((d) => d.type)),
        })),
        pagination: (0, api_response_1.buildPagination)(total, page, limit),
    };
};
exports.listStudentsService = listStudentsService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getStudentService = async (id) => {
    await findOrThrow(id);
    return client_1.prisma.student.findUnique({
        where: { id },
        select: {
            ...studentSelect,
            _count: { select: { enrollments: true } },
        },
    });
};
exports.getStudentService = getStudentService;
// --------------------------------------------------
// Enrollments — GET /students/:id/enrollments
//
// المواد التي سجّل فيها الطالب، مع الأستاذ والفوج والسنة.
// --------------------------------------------------
const getStudentEnrollmentsService = async (id, query) => {
    await findOrThrow(id);
    return client_1.prisma.studentEnrollment.findMany({
        where: {
            studentId: id,
            ...(query.isActive !== undefined && { isActive: query.isActive }),
            ...(query.academicYearId && {
                teachingAssignment: { academicYearId: query.academicYearId },
            }),
        },
        select: {
            id: true,
            enrolledAt: true,
            isActive: true,
            teachingAssignment: {
                select: {
                    id: true,
                    isActive: true,
                    subject: { select: { id: true, name: true, code: true } },
                    teacher: { select: { id: true, firstName: true, lastName: true } },
                    studyGroup: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            level: { select: { id: true, name: true } },
                        },
                    },
                    academicYear: { select: { id: true, name: true, isCurrent: true } },
                },
            },
            _count: { select: { invoices: true, attendances: true } },
        },
        orderBy: { enrolledAt: "desc" },
    });
};
exports.getStudentEnrollmentsService = getStudentEnrollmentsService;
// --------------------------------------------------
// Create
// --------------------------------------------------
const createStudentService = async (body) => {
    return client_1.prisma.student.create({
        data: {
            firstName: body.firstName,
            lastName: body.lastName,
            gender: body.gender,
            birthDate: body.birthDate ?? null,
            avatar: body.avatar ?? null,
            phone: body.phone ?? null,
            parentPhone: body.parentPhone,
            address: body.address ?? null,
            schoolName: body.schoolName ?? null,
            emergencyPhone: body.emergencyPhone ?? null,
            ...(body.registrationDate && { registrationDate: body.registrationDate }),
            note: body.note ?? null,
            isActive: body.isActive ?? true,
        },
        select: studentSelect,
    });
};
exports.createStudentService = createStudentService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateStudentService = async (id, body) => {
    await findOrThrow(id);
    return client_1.prisma.student.update({
        where: { id },
        data: {
            ...(body.firstName !== undefined && { firstName: body.firstName }),
            ...(body.lastName !== undefined && { lastName: body.lastName }),
            ...(body.gender !== undefined && { gender: body.gender }),
            ...(body.birthDate !== undefined && { birthDate: body.birthDate }),
            ...(body.avatar !== undefined && { avatar: body.avatar }),
            ...(body.phone !== undefined && { phone: body.phone }),
            ...(body.parentPhone !== undefined && { parentPhone: body.parentPhone }),
            ...(body.address !== undefined && { address: body.address }),
            ...(body.schoolName !== undefined && { schoolName: body.schoolName }),
            ...(body.emergencyPhone !== undefined && {
                emergencyPhone: body.emergencyPhone,
            }),
            ...(body.registrationDate !== undefined && {
                registrationDate: body.registrationDate,
            }),
            ...(body.note !== undefined && { note: body.note }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: studentSelect,
    });
};
exports.updateStudentService = updateStudentService;
// --------------------------------------------------
// Delete — ممنوع إن كان مسجَّلاً في أي مادة
// --------------------------------------------------
const deleteStudentService = async (id) => {
    await findOrThrow(id);
    const enrollments = await client_1.prisma.studentEnrollment.count({
        where: { studentId: id },
    });
    if (enrollments > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: student has ${enrollments} enrollment(s). ` +
            `Deactivate the student instead.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.student.delete({ where: { id } });
};
exports.deleteStudentService = deleteStudentService;
//# sourceMappingURL=student.service.js.map