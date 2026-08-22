"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSheetService = exports.updateSheetService = exports.createSheetService = exports.getSheetService = exports.listSheetsService = void 0;
const client_1 = require("../../core/prisma/client");
const enrollment_service_1 = require("../enrollment/enrollment.service");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const time_1 = require("../../core/utils/time");
const document_number_1 = require("../../core/utils/document-number");
/**
 * كشف الحضور — وحدةٌ إدارية يملك حصصه.
 *
 * قبله كان الكشف يُشتقّ من نافذة تواريخ، فكان يورث سؤالاً بلا جواب:
 * حصةٌ في مطلع الشهر التالي — ذيلُ هذا الكشف أم مطلعُ الذي يليه؟
 * وحين يكون العمود في كشفٍ لأنّ أحداً وضعه فيه، يسقط السؤال.
 */
const sheetSelect = {
    id: true,
    code: true,
    teachingAssignmentId: true,
    academicYearId: true,
    number: true,
    label: true,
    sessionCount: true,
    note: true,
    createdAt: true,
    updatedAt: true,
    teachingAssignment: {
        select: {
            id: true,
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
            studyGroup: {
                select: {
                    id: true,
                    name: true,
                    level: {
                        select: {
                            id: true,
                            name: true,
                            educationStage: { select: { id: true, name: true } },
                        },
                    },
                },
            },
            academicYear: { select: { id: true, name: true } },
        },
    },
    _count: { select: { sessions: true } },
};
const sessionSelect = {
    id: true,
    scheduleId: true,
    lessonNumber: true,
    sessionDate: true,
    status: true,
    note: true,
    schedule: {
        select: {
            id: true,
            dayOfWeek: true,
            lessonSlot: {
                select: { id: true, name: true, order: true, startTime: true, endTime: true },
            },
            classroom: { select: { id: true, name: true } },
        },
    },
};
const sessionToResponse = (session) => ({
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
    const sheet = await client_1.prisma.attendanceSheet.findUnique({
        where: { id },
        select: {
            id: true,
            teachingAssignmentId: true,
            number: true,
            sessionCount: true,
        },
    });
    if (!sheet) {
        throw new app_errors_1.NotFoundException("Attendance sheet not found", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    return sheet;
};
const getAssignmentOrThrow = async (teachingAssignmentId) => {
    const assignment = await client_1.prisma.teachingAssignment.findUnique({
        where: { id: teachingAssignmentId },
        select: {
            id: true,
            academicYearId: true,
            academicYear: { select: { id: true, name: true, sessionsPerMonth: true } },
            _count: { select: { schedules: true } },
        },
    });
    if (!assignment) {
        throw new app_errors_1.NotFoundException("Teaching assignment not found", error_code_enum_1.ErrorCodeEnum.TEACHING_ASSIGNMENT_NOT_FOUND);
    }
    return assignment;
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listSheetsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const assignmentFilter = {
        ...(query.subjectId && { subjectId: query.subjectId }),
        ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
        ...(query.teacherId && { teacherId: query.teacherId }),
    };
    const where = {
        /*
         * الرمز يُفرد صفّاً واحداً — وهو مدخلُ الباركود: يُمسح فيُعرف
         * الكشف بلا معرفة إسناده ولا سنته.
         */
        ...(query.code && { code: query.code }),
        ...(query.teachingAssignmentId && {
            teachingAssignmentId: query.teachingAssignmentId,
        }),
        ...(query.academicYearId && { academicYearId: query.academicYearId }),
        ...(Object.keys(assignmentFilter).length > 0 && {
            teachingAssignment: assignmentFilter,
        }),
    };
    const [sheets, total] = await Promise.all([
        client_1.prisma.attendanceSheet.findMany({
            where,
            select: sheetSelect,
            skip,
            take,
            orderBy: { number: "asc" },
        }),
        client_1.prisma.attendanceSheet.count({ where }),
    ]);
    return { sheets, pagination: (0, api_response_1.buildPagination)(total, page, limit) };
};
exports.listSheetsService = listSheetsService;
// --------------------------------------------------
// Get — الكشف بأعمدته
// --------------------------------------------------
const getSheetService = async (id) => {
    await findOrThrow(id);
    const sheet = await client_1.prisma.attendanceSheet.findUnique({
        where: { id },
        select: sheetSelect,
    });
    if (!sheet)
        return null;
    /* الأعمدة بالتاريخ — كما تُقرأ الورقة */
    const sessions = await client_1.prisma.session.findMany({
        where: { sheetId: id },
        select: sessionSelect,
        orderBy: [{ sessionDate: "asc" }, { lessonNumber: "asc" }],
    });
    return { ...sheet, sessions: sessions.map(sessionToResponse) };
};
exports.getSheetService = getSheetService;
// --------------------------------------------------
// Create
// --------------------------------------------------
const createSheetService = async (body) => {
    const assignment = await getAssignmentOrThrow(body.teachingAssignmentId);
    /*
     * الكشف يحتاج خانةَ جدولٍ تُعلَّق عليها حصصُه: الحصة واقعةُ خانة،
     * ولا سبيل لإنشائها بلا `scheduleId`.
     */
    if (assignment._count.schedules === 0) {
        throw new app_errors_1.BadRequestException("This teaching assignment has no weekly schedule slot. " +
            "Add it to the weekly schedule first.", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    const number = body.number ??
        ((await client_1.prisma.attendanceSheet.findFirst({
            where: { teachingAssignmentId: body.teachingAssignmentId },
            orderBy: { number: "desc" },
            select: { number: true },
        }))?.number ?? 0) + 1;
    const duplicate = await client_1.prisma.attendanceSheet.findFirst({
        where: { teachingAssignmentId: body.teachingAssignmentId, number },
        select: { id: true },
    });
    if (duplicate) {
        throw new app_errors_1.ConflictException(`A sheet numbered ${number} already exists for this teaching assignment`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    /* العدد يُنسخ لا يُقرأ: تغيير السياسة لاحقاً لا يُعيد رسم كشفٍ مضى */
    const sessionCount = body.sessionCount ?? assignment.academicYear.sessionsPerMonth;
    const sheet = await client_1.prisma.$transaction(async (tx) => {
        /*
         * الرمز يُفحص **داخل** المعاملة التي تحفظ الصف — لا قبلها: بين
         * الفحص والحفظ متّسعٌ لكشفٍ آخر يأخذ الرقم نفسه. وقيد التفرّد في
         * القاعدة حارسٌ أخير خلفه.
         */
        const code = await (0, document_number_1.uniqueDocumentNumber)(async (candidate) => (await tx.attendanceSheet.count({ where: { code: candidate } })) > 0);
        if (!code) {
            throw new app_errors_1.ConflictException("Could not allocate a sheet code", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
        }
        const created = await tx.attendanceSheet.create({
            data: {
                code,
                teachingAssignmentId: body.teachingAssignmentId,
                academicYearId: assignment.academicYearId,
                number,
                label: body.label ?? null,
                sessionCount,
                note: body.note ?? null,
            },
            select: { id: true },
        });
        /*
         * ضمُّ حصصٍ قائمة — تُقبل الحصص غير المنسوبة إلى كشفٍ آخر وحدها،
         * فلا تُنتزع أعمدةٌ من كشفٍ قائم بضغطة زر.
         */
        if (body.adoptSessionIds?.length) {
            const adoptable = await tx.session.findMany({
                where: {
                    id: { in: body.adoptSessionIds },
                    sheetId: null,
                    schedule: { teachingAssignmentId: body.teachingAssignmentId },
                },
                select: { id: true },
            });
            if (adoptable.length > 0) {
                await tx.session.updateMany({
                    where: { id: { in: adoptable.map((s) => s.id) } },
                    data: { sheetId: created.id },
                });
            }
        }
        return created;
    });
    /*
     * فتحُ كشفٍ جديد هو حدُّ الشهر — وعنده تسري النقولُ المؤجَّلة.
     *
     * ولا يقع داخل المعاملة: النقلُ يمسّ فوجاً آخر بفواتيره وحضوره،
     * وربطُه بمعاملة إنشاء الكشف يجعل تعثُّرَ نقلِ طالبٍ واحد يُسقط
     * الكشفَ كلَّه. فيُنفَّذ بعده، وما تعثّر منه يبقى معلَّقاً بملاحظته
     * ظاهرةً لمن يُصلحه.
     */
    const pending = await (0, enrollment_service_1.runPendingTransfersService)(body.teachingAssignmentId, sheet.id);
    const full = await (0, exports.getSheetService)(sheet.id);
    return pending.moved > 0 || pending.failed.length > 0
        ? { ...full, pendingTransfers: pending }
        : full;
};
exports.createSheetService = createSheetService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateSheetService = async (id, body) => {
    const existing = await findOrThrow(id);
    if (body.number !== undefined && body.number !== existing.number) {
        const duplicate = await client_1.prisma.attendanceSheet.findFirst({
            where: {
                teachingAssignmentId: existing.teachingAssignmentId,
                number: body.number,
                NOT: { id },
            },
            select: { id: true },
        });
        if (duplicate) {
            throw new app_errors_1.ConflictException(`A sheet numbered ${body.number} already exists for this teaching assignment`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
        }
    }
    /* تقليص العدد دون ما هو مسجَّل يُخفي أعمدةً فيها حضور */
    if (body.sessionCount !== undefined) {
        const dated = await client_1.prisma.session.count({ where: { sheetId: id } });
        if (body.sessionCount < dated) {
            throw new app_errors_1.ConflictException(`The sheet already has ${dated} dated session(s); ` +
                `the count cannot be lowered below that.`, error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
        }
    }
    await client_1.prisma.attendanceSheet.update({
        where: { id },
        data: {
            ...(body.number !== undefined && { number: body.number }),
            ...(body.label !== undefined && { label: body.label }),
            ...(body.sessionCount !== undefined && { sessionCount: body.sessionCount }),
            ...(body.note !== undefined && { note: body.note }),
        },
    });
    return (0, exports.getSheetService)(id);
};
exports.updateSheetService = updateSheetService;
// --------------------------------------------------
// Delete
//
// الكشف يُحذف بحصصه وحضورِها — قرار الإدارة.
//
// كانت الحصص تُفَكّ نسبتُها ويبقى الحضور، حرصاً على ألّا يمحو حذفُ
// ورقةٍ إدارية تدويناً حقيقياً. والحرصُ صحيح والنتيجة كانت أسوأ:
// ثلاثٌ وأربعون حصةً يتيمة تحمل 536 خانة، تسدّ تواريخَها على كل كشفٍ
// جديد وتُجبر المستخدم على نافذة ضمٍّ في كل مرّة. وكشفٌ جديد يعني
// تدويناً جديداً وحقوقاً جديدة — فلا معنى لأن يرث حصصَ كشفٍ أُلغي.
//
// **وثلاثة حدودٍ لا تُتجاوز:**
//
//   • لا تُمَسّ فاتورةٌ ولا دفعةٌ ولا إيصال. الحضور تدوينٌ تربوي،
//     والمالُ سجلٌّ مستقلّ يبقى ولو مُحي الكشف كلُّه.
//   • لا تُمَسّ حصةُ كشفٍ آخر: الحذف مقيَّدٌ بـ`sheetId` هذا الكشف
//     وحده، فالحصص اليتيمة (المولَّدة من الجدول ولم تُضمّ) لا تدخله.
//   • ولا يُحذف كشفٌ خُلّص عليه. المبلغ المدفوع للأستاذ سنَدُه هذا
//     الحضور، ومحوُه يترك رقماً لا يُفسَّر — وهو نقضٌ لقاعدة أنّ كل
//     مبلغٍ يُعاد بناؤه من مصدره.
// --------------------------------------------------
const deleteSheetService = async (id) => {
    await findOrThrow(id);
    const settlement = await client_1.prisma.settlement.findFirst({
        where: { attendanceSheetId: id, status: { not: "CANCELLED" } },
        select: { settlementNumber: true, status: true },
    });
    if (settlement) {
        throw new app_errors_1.ConflictException(`لا يُحذف كشفٌ خُلّص عليه — التخليص ${settlement.settlementNumber} ` +
            `(${settlement.status}) مبنيٌّ على حضوره. ألغِ التخليص أوّلاً إن أردت حذفه.`, error_code_enum_1.ErrorCodeEnum.SETTLEMENT_LOCKED);
    }
    const removed = await client_1.prisma.$transaction(async (tx) => {
        const sessions = await tx.session.findMany({
            where: { sheetId: id },
            select: { id: true },
        });
        const sessionIds = sessions.map((session) => session.id);
        const { count: marks } = await tx.attendance.deleteMany({
            where: { sessionId: { in: sessionIds } },
        });
        await tx.settlementLine.deleteMany({
            where: { sessionId: { in: sessionIds } },
        });
        await tx.session.deleteMany({ where: { id: { in: sessionIds } } });
        await tx.attendanceSheet.delete({ where: { id } });
        return { sessions: sessionIds.length, marks };
    });
    return { id, ...removed };
};
exports.deleteSheetService = deleteSheetService;
//# sourceMappingURL=attendance-sheet.service.js.map