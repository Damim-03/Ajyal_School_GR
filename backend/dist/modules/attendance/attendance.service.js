"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearSessionAttendanceService = exports.updateAttendanceService = exports.bulkAttendanceService = exports.createAttendanceService = exports.getAttendanceService = exports.listAttendanceService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const time_1 = require("../../core/utils/time");
const attendanceSelect = {
    id: true,
    studentEnrollmentId: true,
    sessionId: true,
    status: true,
    note: true,
    createdAt: true,
    updatedAt: true,
    studentEnrollment: {
        select: {
            id: true,
            isActive: true,
            student: {
                select: { id: true, firstName: true, lastName: true, parentPhone: true },
            },
        },
    },
    session: {
        select: {
            id: true,
            sessionDate: true,
            lessonNumber: true,
            status: true,
            schedule: {
                select: {
                    id: true,
                    dayOfWeek: true,
                    teachingAssignment: {
                        select: {
                            id: true,
                            subject: { select: { id: true, name: true } },
                            teacher: { select: { id: true, firstName: true, lastName: true } },
                            studyGroup: { select: { id: true, name: true } },
                        },
                    },
                },
            },
        },
    },
};
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const attendance = await client_1.prisma.attendance.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!attendance) {
        throw new app_errors_1.NotFoundException("Attendance record not found", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    return attendance;
};
/**
 * الحصة يجب أن تكون موجودة وغير ملغاة.
 * نُرجع معها معرّف الإسناد للتحقق من انتماء الطلبة.
 */
const getSessionOrThrow = async (sessionId) => {
    const session = await client_1.prisma.session.findUnique({
        where: { id: sessionId },
        select: {
            id: true,
            status: true,
            sessionDate: true,
            schedule: { select: { teachingAssignmentId: true } },
        },
    });
    if (!session) {
        throw new app_errors_1.NotFoundException("Session not found", error_code_enum_1.ErrorCodeEnum.SESSION_NOT_FOUND);
    }
    if (session.status === "CANCELLED") {
        throw new app_errors_1.BadRequestException("Cannot record attendance for a cancelled session", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    return {
        id: session.id,
        sessionDate: session.sessionDate,
        teachingAssignmentId: session.schedule.teachingAssignmentId,
    };
};
/**
 * الحصة تصير **منجزة** حين يُدوَّن حضور الجميع — قرار الإدارة.
 *
 * قبل هذا كانت الحصة تبقى `SCHEDULED` أبداً: الخادم يقبل تغيير حالتها
 * في `PATCH /sessions/:id` لكنّ الواجهة لا ترسله في أيّ موضع، فلا شيء
 * يُطلق الانتقال. وأثرُه ماليٌّ لا شكليّ — التخليص لا يحتسب إلّا
 * `COMPLETED`، فكشفٌ حضورُه كاملٌ كان يُخلَّص على صفر حصص.
 *
 * والمقياس المسجَّلون النشطون: لكلٍّ منهم علامةٌ في هذه الحصة — أيّ
 * علامة، فالغياب تدوينٌ كالحضور. ومن لا مسجَّل فيه لا يُنجز.
 *
 * **ولا تُنزَّل حصةٌ أُنجزت.** لأنّ طالباً يُسجَّل في الفوج بعد أسابيع
 * يرفع عدد المسجَّلين ولا علامة له في حصص مضت — فأوّلُ تصحيحٍ لخليةٍ
 * قديمة كان سيُعيدها «مجدولة» ويُسقطها من تخليصٍ محسوب. وقد وقعت
 * فعلاً، والحصة وقعت. فالتنزيل طريقُه `clearSessionAttendanceService`
 * وحده — تفريغُ الورقة كلّها فعلٌ صريح لا أثرٌ جانبيّ.
 */
const syncSessionCompletion = async (sessionId) => {
    const session = await client_1.prisma.session.findUnique({
        where: { id: sessionId },
        select: {
            id: true,
            status: true,
            sessionDate: true,
            schedule: { select: { teachingAssignmentId: true } },
        },
    });
    if (!session || session.status !== "SCHEDULED")
        return;
    const [enrolled, marked] = await Promise.all([
        /*
         * المؤهَّلون يوم الحصة لا كلُّ المسجَّلين.
         *
         * طالبٌ يلتحق بالفوج اليوم لم يكن فيه شهراً مضى، فاشتراطُ علامةٍ له
         * في حصصٍ سبقت التحاقه يجعلها لا تكتمل أبداً — ويجعله «غائباً» عن
         * درسٍ لم يكن طالباً فيه.
         */
        client_1.prisma.studentEnrollment.count({
            where: {
                teachingAssignmentId: session.schedule.teachingAssignmentId,
                isActive: true,
                OR: [
                    { eligibleFrom: null },
                    { eligibleFrom: { lte: session.sessionDate } },
                ],
            },
        }),
        // علاماتُ المسجَّلين النشطين وحدهم: علامةُ منقولٍ من الفوج تبقى
        // للتدقيق، وعدُّها كان سيُكمل النصاب بمن لم يعد فيه
        client_1.prisma.attendance.count({
            where: { sessionId, studentEnrollment: { isActive: true } },
        }),
    ]);
    if (enrolled === 0 || marked < enrolled)
        return;
    await client_1.prisma.session.update({
        where: { id: sessionId },
        data: { status: "COMPLETED" },
    });
};
/**
 * كل تسجيل يجب أن يخصّ نفس الإسناد التدريسي للحصة —
 * وإلا سُجّل حضور طالب في مادة لم يسجّل فيها.
 */
const ensureEnrollmentsBelongToSession = async (enrollmentIds, teachingAssignmentId) => {
    const enrollments = await client_1.prisma.studentEnrollment.findMany({
        where: { id: { in: enrollmentIds } },
        select: { id: true, teachingAssignmentId: true },
    });
    if (enrollments.length !== enrollmentIds.length) {
        const found = new Set(enrollments.map((e) => e.id));
        const missing = enrollmentIds.filter((id) => !found.has(id));
        throw new app_errors_1.NotFoundException(`Enrollment(s) not found: ${missing.join(", ")}`, error_code_enum_1.ErrorCodeEnum.ENROLLMENT_NOT_FOUND);
    }
    const foreign = enrollments.filter((e) => e.teachingAssignmentId !== teachingAssignmentId);
    if (foreign.length > 0) {
        throw new app_errors_1.BadRequestException(`Enrollment(s) do not belong to this session's class: ` +
            foreign.map((e) => e.id).join(", "), error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listAttendanceService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const assignmentFilter = {
        ...(query.subjectId && { subjectId: query.subjectId }),
        ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
        ...(query.academicYearId && { academicYearId: query.academicYearId }),
    };
    const sessionFilter = {
        ...((query.dateFrom || query.dateTo) && {
            sessionDate: {
                ...(query.dateFrom && { gte: (0, time_1.startOfUtcDay)(query.dateFrom) }),
                ...(query.dateTo && { lt: (0, time_1.addUtcDays)((0, time_1.startOfUtcDay)(query.dateTo), 1) }),
            },
        }),
        ...((query.teachingAssignmentId ||
            Object.keys(assignmentFilter).length > 0) && {
            schedule: {
                ...(query.teachingAssignmentId && {
                    teachingAssignmentId: query.teachingAssignmentId,
                }),
                ...(Object.keys(assignmentFilter).length > 0 && {
                    teachingAssignment: assignmentFilter,
                }),
            },
        }),
    };
    const where = {
        ...(query.sessionId && { sessionId: query.sessionId }),
        ...(query.studentEnrollmentId && {
            studentEnrollmentId: query.studentEnrollmentId,
        }),
        ...(query.status && { status: query.status }),
        ...(query.studentId && {
            studentEnrollment: { studentId: query.studentId },
        }),
        ...(Object.keys(sessionFilter).length > 0 && { session: sessionFilter }),
    };
    const [attendances, total] = await Promise.all([
        client_1.prisma.attendance.findMany({
            where,
            select: attendanceSelect,
            skip,
            take,
            orderBy: [
                { session: { sessionDate: "desc" } },
                { studentEnrollment: { student: { lastName: "asc" } } },
            ],
        }),
        client_1.prisma.attendance.count({ where }),
    ]);
    return { attendances, pagination: (0, api_response_1.buildPagination)(total, page, limit) };
};
exports.listAttendanceService = listAttendanceService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getAttendanceService = async (id) => {
    await findOrThrow(id);
    return client_1.prisma.attendance.findUnique({
        where: { id },
        select: attendanceSelect,
    });
};
exports.getAttendanceService = getAttendanceService;
// --------------------------------------------------
// Create — سجل واحد
//
// التكرار يُرفض هنا عمداً؛ التصحيح يتم عبر PATCH
// أو عبر المسار الجماعي الذي يُحدِّث.
// --------------------------------------------------
const createAttendanceService = async (body) => {
    const session = await getSessionOrThrow(body.sessionId);
    await ensureEnrollmentsBelongToSession([body.studentEnrollmentId], session.teachingAssignmentId);
    const existing = await client_1.prisma.attendance.findFirst({
        where: {
            sessionId: session.id,
            studentEnrollmentId: body.studentEnrollmentId,
        },
        select: { id: true },
    });
    if (existing) {
        throw new app_errors_1.ConflictException("Attendance already recorded for this student in this session", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    const attendance = await client_1.prisma.attendance.create({
        data: {
            sessionId: session.id,
            studentEnrollmentId: body.studentEnrollmentId,
            status: body.status ?? "PRESENT",
            note: body.note ?? null,
        },
        select: attendanceSelect,
    });
    // هذه العلامة قد تكون آخر ما ينقص الحصة لتُنجَز
    await syncSessionCompletion(session.id);
    return attendance;
};
exports.createAttendanceService = createAttendanceService;
// --------------------------------------------------
// Bulk — ورقة حضور الحصة كاملة
// --------------------------------------------------
const bulkAttendanceService = async (body) => {
    const session = await getSessionOrThrow(body.sessionId);
    const records = body.records ?? [];
    if (records.length > 0) {
        await ensureEnrollmentsBelongToSession(records.map((r) => r.studentEnrollmentId), session.teachingAssignmentId);
    }
    // المسجَّلون النشطون في هذا الإسناد
    const activeEnrollments = await client_1.prisma.studentEnrollment.findMany({
        where: {
            teachingAssignmentId: session.teachingAssignmentId,
            isActive: true,
            /*
             * «سجّل الباقي غائبين» لا يشمل من لم يكن في الفوج بعد.
             *
             * وهي أخطرُ نقطةٍ في هذه الميزة: ضغطةٌ واحدة كانت تكتب غياباً
             * لطالبٍ التحق الشهر التالي، فيصير له سجلُّ غيابٍ لا يمحوه إلّا
             * من عرف أنّه وقع.
             */
            OR: [
                { eligibleFrom: null },
                { eligibleFrom: { lte: session.sessionDate } },
            ],
        },
        select: { id: true },
    });
    const activeIds = new Set(activeEnrollments.map((e) => e.id));
    // السجلات القائمة لهذه الحصة — للتفريق بين إنشاء وتحديث
    const existing = await client_1.prisma.attendance.findMany({
        where: { sessionId: session.id },
        select: { id: true, studentEnrollmentId: true },
    });
    const existingByEnrollment = new Map(existing.map((a) => [a.studentEnrollmentId, a.id]));
    // ما يصل صراحةً في records
    const explicit = new Map(records.map((r) => [
        r.studentEnrollmentId,
        { status: r.status, note: r.note ?? null },
    ]));
    // markRemainingAs يملأ كل مسجَّل نشط لم يُذكر ولا سجل له
    if (body.markRemainingAs) {
        for (const id of activeIds) {
            if (explicit.has(id))
                continue;
            if (existingByEnrollment.has(id))
                continue;
            explicit.set(id, { status: body.markRemainingAs, note: null });
        }
    }
    let created = 0;
    let updated = 0;
    const operations = [];
    for (const [studentEnrollmentId, value] of explicit) {
        const existingId = existingByEnrollment.get(studentEnrollmentId);
        if (existingId) {
            updated++;
            operations.push(client_1.prisma.attendance.update({
                where: { id: existingId },
                data: { status: value.status, note: value.note },
            }));
        }
        else {
            created++;
            operations.push(client_1.prisma.attendance.create({
                data: {
                    sessionId: session.id,
                    studentEnrollmentId,
                    status: value.status,
                    note: value.note,
                },
            }));
        }
    }
    if (operations.length > 0) {
        await client_1.prisma.$transaction(operations);
    }
    // «سجّل الباقي حاضرين» هو الطريق المعتاد لإتمام الورقة
    await syncSessionCompletion(session.id);
    const attendances = await client_1.prisma.attendance.findMany({
        where: { sessionId: session.id },
        select: attendanceSelect,
        orderBy: { studentEnrollment: { student: { lastName: "asc" } } },
    });
    return { attendances, created, updated, total: attendances.length };
};
exports.bulkAttendanceService = bulkAttendanceService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateAttendanceService = async (id, body) => {
    await findOrThrow(id);
    const attendance = await client_1.prisma.attendance.update({
        where: { id },
        data: {
            ...(body.status !== undefined && { status: body.status }),
            ...(body.note !== undefined && { note: body.note }),
        },
        select: attendanceSelect,
    });
    /*
     * التعديل لا يغيّر عدد المدوَّن — السجلّ كان موجوداً. لكنّ النداء
     * هنا يُصلح ما سبق: كشوفُ ما قبل هذا التعديل حضورُها كاملٌ وحالتُها
     * «مجدولة»، فأوّلُ لمسةٍ لأيّ خليةٍ فيها تُصحّح الحالة من نفسها.
     */
    await syncSessionCompletion(attendance.sessionId);
    return attendance;
};
exports.updateAttendanceService = updateAttendanceService;
// --------------------------------------------------
// Clear — تفريغ ورقة حصة
//
// الاستثناء الوحيد لقاعدة «الحضور يُصحَّح ولا يُمحى»، ومحصورٌ عمداً في
// **حصة واحدة**: ورقةٌ مُلئت بالخطأ لا تُصحَّح بالتعديل، لأنّ الصواب
// أن تعود الخانات فارغة لا أن تصير غياباً — وبينهما فرقٌ في المعنى:
// الفارغ «لم يُسجَّل بعد»، والغياب «سُجّل أنه غاب».
//
// ولا مسار لحذف سجلّ حضورٍ منفرد: الخلية الواحدة تُصحَّح بتغيير حالتها،
// ولا حاجة إلى محوها.
// --------------------------------------------------
const clearSessionAttendanceService = async (sessionId) => {
    await getSessionOrThrow(sessionId);
    const { count } = await client_1.prisma.attendance.deleteMany({ where: { sessionId } });
    /*
     * الطريق الوحيد الذي تُنزَّل فيه حصةٌ أُنجزت — وهو صريح: من فرّغ
     * الورقة قال إنّ ما فيها خطأ. ولو بقيت «منجزة» بلا علامةٍ واحدة
     * لدخلت التخليص بصفر حاضرين وخفَّضت مستحقّ الأستاذ صامتةً.
     */
    await client_1.prisma.session.updateMany({
        where: { id: sessionId, status: "COMPLETED" },
        data: { status: "SCHEDULED" },
    });
    return { sessionId, deleted: count };
};
exports.clearSessionAttendanceService = clearSessionAttendanceService;
//# sourceMappingURL=attendance.service.js.map