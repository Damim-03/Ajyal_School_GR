"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSessionService = exports.updateSessionService = exports.generateSessionsService = exports.createSessionService = exports.getSessionService = exports.listSessionsService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const time_1 = require("../../core/utils/time");
const sessionSelect = {
    id: true,
    scheduleId: true,
    /* يميّز الحصة اليتيمة عن المنسوبة إلى كشف — تحتاجه الواجهة للضمّ */
    sheetId: true,
    lessonNumber: true,
    sessionDate: true,
    status: true,
    note: true,
    createdAt: true,
    updatedAt: true,
    schedule: {
        select: {
            id: true,
            dayOfWeek: true,
            lessonSlot: {
                select: { id: true, name: true, order: true, startTime: true, endTime: true },
            },
            classroom: { select: { id: true, name: true } },
            teachingAssignment: {
                select: {
                    id: true,
                    subject: { select: { id: true, name: true } },
                    teacher: { select: { id: true, firstName: true, lastName: true } },
                    studyGroup: {
                        select: {
                            id: true,
                            name: true,
                            level: { select: { id: true, name: true } },
                        },
                    },
                    academicYear: { select: { id: true, name: true } },
                },
            },
        },
    },
};
const toResponse = (session) => ({
    ...session,
    schedule: {
        ...session.schedule,
        lessonSlot: {
            ...session.schedule.lessonSlot,
            startTime: (0, time_1.formatTime)(session.schedule.lessonSlot.startTime),
            endTime: (0, time_1.formatTime)(session.schedule.lessonSlot.endTime),
        },
    },
});
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const session = await client_1.prisma.session.findUnique({
        where: { id },
        select: {
            id: true,
            scheduleId: true,
            lessonNumber: true,
            sessionDate: true,
        },
    });
    if (!session) {
        throw new app_errors_1.NotFoundException("Session not found", error_code_enum_1.ErrorCodeEnum.SESSION_NOT_FOUND);
    }
    return session;
};
const getScheduleOrThrow = async (scheduleId) => {
    const schedule = await client_1.prisma.schedule.findUnique({
        where: { id: scheduleId },
        select: { id: true, dayOfWeek: true, isActive: true },
    });
    if (!schedule) {
        throw new app_errors_1.NotFoundException("Schedule not found", error_code_enum_1.ErrorCodeEnum.SCHEDULE_NOT_FOUND);
    }
    return schedule;
};
/** آخر رقم حصة في هذا الجدول + 1 */
const nextLessonNumber = async (scheduleId) => {
    const last = await client_1.prisma.session.findFirst({
        where: { scheduleId },
        orderBy: { lessonNumber: "desc" },
        select: { lessonNumber: true },
    });
    return (last?.lessonNumber ?? 0) + 1;
};
const ensureUniqueLessonNumber = async (scheduleId, lessonNumber, excludeId) => {
    const duplicate = await client_1.prisma.session.findFirst({
        where: {
            scheduleId,
            lessonNumber,
            ...(excludeId && { NOT: { id: excludeId } }),
        },
        select: { id: true },
    });
    if (duplicate) {
        throw new app_errors_1.ConflictException(`Lesson number ${lessonNumber} already exists for this schedule`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
};
/** حصتان لنفس الجدول في نفس اليوم خطأ بيانات */
const ensureUniqueDate = async (scheduleId, sessionDate, excludeId) => {
    const day = (0, time_1.startOfUtcDay)(sessionDate);
    const duplicate = await client_1.prisma.session.findFirst({
        where: {
            scheduleId,
            sessionDate: { gte: day, lt: (0, time_1.addUtcDays)(day, 1) },
            ...(excludeId && { NOT: { id: excludeId } }),
        },
        select: { id: true, sheetId: true, lessonNumber: true },
    });
    if (duplicate) {
        /*
         * الحصة اليتيمة تُسمَّى باسمها.
         *
         * حذفُ كشفٍ يفكّ حصصه ولا يمحوها — والحضور المسجَّل فيها يبقى.
         * لكنّ الحصة المفكوكة تحجز تاريخها، فيُرفض إنشاء عمودٍ عليه
         * برسالةٍ تقول «موجودة» بينما لا يراها المستخدم في أيّ كشف.
         *
         * فيُقال له أين هي وما الحلّ، ويُرفق معرّفها لتضمّها الواجهة
         * بضغطة بدل أن يقف عند طريقٍ مسدود.
         */
        throw new app_errors_1.ConflictException(duplicate.sheetId
            ? `يوجد عمودٌ بتاريخ ${(0, time_1.formatDate)(day)} في هذا الكشف بالفعل`
            : `توجد حصةٌ بتاريخ ${(0, time_1.formatDate)(day)} غير منسوبة إلى أيّ كشف — ` +
                `ضُمَّها إلى هذا الكشف بدل إنشاء حصةٍ ثانية بنفس التاريخ.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listSessionsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const assignmentFilter = {
        ...(query.teacherId && { teacherId: query.teacherId }),
        ...(query.subjectId && { subjectId: query.subjectId }),
        ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
        ...(query.academicYearId && { academicYearId: query.academicYearId }),
    };
    const where = {
        ...(query.scheduleId && { scheduleId: query.scheduleId }),
        ...(query.teachingAssignmentId && {
            schedule: { teachingAssignmentId: query.teachingAssignmentId },
        }),
        ...(query.status && { status: query.status }),
        ...((query.dateFrom || query.dateTo) && {
            sessionDate: {
                ...(query.dateFrom && { gte: (0, time_1.startOfUtcDay)(query.dateFrom) }),
                // شامل ليوم النهاية
                ...(query.dateTo && { lt: (0, time_1.addUtcDays)((0, time_1.startOfUtcDay)(query.dateTo), 1) }),
            },
        }),
        ...(Object.keys(assignmentFilter).length > 0 && {
            schedule: { teachingAssignment: assignmentFilter },
        }),
    };
    const [sessions, total] = await Promise.all([
        client_1.prisma.session.findMany({
            where,
            select: { ...sessionSelect, _count: { select: { attendances: true } } },
            skip,
            take,
            orderBy: [{ sessionDate: "asc" }, { lessonNumber: "asc" }],
        }),
        client_1.prisma.session.count({ where }),
    ]);
    return {
        sessions: sessions.map(toResponse),
        pagination: (0, api_response_1.buildPagination)(total, page, limit),
    };
};
exports.listSessionsService = listSessionsService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getSessionService = async (id) => {
    await findOrThrow(id);
    const session = await client_1.prisma.session.findUnique({
        where: { id },
        select: { ...sessionSelect, _count: { select: { attendances: true } } },
    });
    return session ? toResponse(session) : null;
};
exports.getSessionService = getSessionService;
// --------------------------------------------------
// Create — يدوي
// --------------------------------------------------
const createSessionService = async (body) => {
    const schedule = await getScheduleOrThrow(body.scheduleId);
    const sessionDate = (0, time_1.startOfUtcDay)(body.sessionDate);
    await ensureUniqueDate(schedule.id, sessionDate);
    const lessonNumber = body.lessonNumber ?? (await nextLessonNumber(schedule.id));
    if (body.lessonNumber !== undefined) {
        await ensureUniqueLessonNumber(schedule.id, body.lessonNumber);
    }
    const session = await client_1.prisma.session.create({
        data: {
            scheduleId: schedule.id,
            sessionDate,
            lessonNumber,
            status: body.status ?? "SCHEDULED",
            note: body.note ?? null,
            /* الحصة المنشأة من داخل كشفٍ تُنسب إليه فوراً */
            sheetId: body.sheetId ?? null,
        },
        select: sessionSelect,
    });
    return toResponse(session);
};
exports.createSessionService = createSessionService;
// --------------------------------------------------
// Generate — توليد من الجدول الأسبوعي
//
// لكل جدول نمشي على أيام المدى ونلتقط ما يوافق يومه.
// التواريخ الموجودة سلفاً تُتخطّى بدل أن تُفشل العملية،
// فإعادة التشغيل على نفس المدى آمنة.
// --------------------------------------------------
const generateSessionsService = async (body) => {
    const schedules = await client_1.prisma.schedule.findMany({
        where: { id: { in: body.scheduleIds } },
        select: { id: true, dayOfWeek: true, isActive: true },
    });
    if (schedules.length !== body.scheduleIds.length) {
        const found = new Set(schedules.map((s) => s.id));
        const missing = body.scheduleIds.filter((id) => !found.has(id));
        throw new app_errors_1.NotFoundException(`Schedule(s) not found: ${missing.join(", ")}`, error_code_enum_1.ErrorCodeEnum.SCHEDULE_NOT_FOUND);
    }
    const inactive = schedules.filter((s) => !s.isActive);
    if (inactive.length > 0) {
        throw new app_errors_1.ConflictException(`Cannot generate sessions for inactive schedule(s): ${inactive
            .map((s) => s.id)
            .join(", ")}`, error_code_enum_1.ErrorCodeEnum.SCHEDULE_CONFLICT);
    }
    const start = (0, time_1.startOfUtcDay)(body.startDate);
    const end = (0, time_1.startOfUtcDay)(body.endDate);
    const skip = new Set((body.skipDates ?? []).map((date) => (0, time_1.formatDate)((0, time_1.startOfUtcDay)(date))));
    let createdCount = 0;
    let skippedExisting = 0;
    let skippedHoliday = 0;
    const created = [];
    for (const schedule of schedules) {
        const weekday = time_1.DAY_OF_WEEK_INDEX[schedule.dayOfWeek];
        // التواريخ المسجَّلة سلفاً لهذا الجدول ضمن المدى
        const existing = await client_1.prisma.session.findMany({
            where: {
                scheduleId: schedule.id,
                sessionDate: { gte: start, lt: (0, time_1.addUtcDays)(end, 1) },
            },
            select: { sessionDate: true },
        });
        const taken = new Set(existing.map((s) => (0, time_1.formatDate)(s.sessionDate)));
        let lessonNumber = await nextLessonNumber(schedule.id);
        const rows = [];
        for (let date = new Date(start); date <= end; date = (0, time_1.addUtcDays)(date, 1)) {
            if (date.getUTCDay() !== weekday)
                continue;
            const key = (0, time_1.formatDate)(date);
            if (skip.has(key)) {
                skippedHoliday++;
                continue;
            }
            if (taken.has(key)) {
                skippedExisting++;
                continue;
            }
            rows.push({ sessionDate: new Date(date), lessonNumber });
            lessonNumber++;
        }
        if (rows.length === 0)
            continue;
        const inserted = await client_1.prisma.$transaction(rows.map((row) => client_1.prisma.session.create({
            data: {
                scheduleId: schedule.id,
                sessionDate: row.sessionDate,
                lessonNumber: row.lessonNumber,
            },
            select: { id: true },
        })));
        created.push(...inserted.map((s) => s.id));
        createdCount += inserted.length;
    }
    const sessions = await client_1.prisma.session.findMany({
        where: { id: { in: created } },
        select: sessionSelect,
        orderBy: [{ sessionDate: "asc" }, { lessonNumber: "asc" }],
    });
    return {
        sessions: sessions.map(toResponse),
        created: createdCount,
        skippedExisting,
        skippedHoliday,
    };
};
exports.generateSessionsService = generateSessionsService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateSessionService = async (id, body) => {
    const existing = await findOrThrow(id);
    if (body.sessionDate !== undefined) {
        await ensureUniqueDate(existing.scheduleId, (0, time_1.startOfUtcDay)(body.sessionDate), id);
    }
    if (body.lessonNumber !== undefined) {
        await ensureUniqueLessonNumber(existing.scheduleId, body.lessonNumber, id);
    }
    /*
     * الضمّ لا يعبر الإسنادات.
     *
     * كشفٌ يخصّ إسناداً تدريسياً بعينه، وضمُّ حصةِ فوجٍ آخر إليه يخلط
     * حضور فوجين في ورقة واحدة. فيُتحقَّق أنّ الكشف والحصة يتبعان
     * الإسناد نفسه قبل الربط.
     */
    if (body.sheetId) {
        const sheet = await client_1.prisma.attendanceSheet.findUnique({
            where: { id: body.sheetId },
            select: { id: true, teachingAssignmentId: true },
        });
        if (!sheet) {
            throw new app_errors_1.NotFoundException("كشف الحضور غير موجود", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
        }
        const owner = await client_1.prisma.session.findUnique({
            where: { id },
            select: { schedule: { select: { teachingAssignmentId: true } } },
        });
        if (owner?.schedule.teachingAssignmentId !== sheet.teachingAssignmentId) {
            throw new app_errors_1.BadRequestException("لا تُضمّ الحصة إلى كشفٍ يخصّ إسناداً تدريسياً آخر", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
        }
    }
    const session = await client_1.prisma.session.update({
        where: { id },
        data: {
            ...(body.sessionDate !== undefined && {
                sessionDate: (0, time_1.startOfUtcDay)(body.sessionDate),
            }),
            ...(body.lessonNumber !== undefined && {
                lessonNumber: body.lessonNumber,
            }),
            ...(body.status !== undefined && { status: body.status }),
            ...(body.note !== undefined && { note: body.note }),
            ...(body.sheetId !== undefined && { sheetId: body.sheetId ?? null }),
        },
        select: sessionSelect,
    });
    return toResponse(session);
};
exports.updateSessionService = updateSessionService;
// --------------------------------------------------
// Delete — ممنوع إن كان لها حضور مسجَّل
// --------------------------------------------------
const deleteSessionService = async (id) => {
    await findOrThrow(id);
    const attendances = await client_1.prisma.attendance.count({
        where: { sessionId: id },
    });
    if (attendances > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: session has ${attendances} attendance record(s). ` +
            `Cancel the session instead (status = CANCELLED).`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.session.delete({ where: { id } });
};
exports.deleteSessionService = deleteSessionService;
//# sourceMappingURL=session.service.js.map