"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLessonSlotService = exports.updateLessonSlotService = exports.createLessonSlotService = exports.getLessonSlotService = exports.listLessonSlotsService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const time_1 = require("../../core/utils/time");
const lessonSlotSelect = {
    id: true,
    academicYearId: true,
    teacherId: true,
    ownerKey: true,
    name: true,
    order: true,
    startTime: true,
    endTime: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    academicYear: { select: { id: true, name: true } },
    teacher: { select: { id: true, firstName: true, lastName: true } },
};
/**
 * مالك الفترة — أستاذٌ أو المؤسسة.
 *
 * كل تحقّقات هذا الموديول تدور حوله: الترتيب فريدٌ داخل أوقات المالك،
 * والوقت المتطابق لا يتكرّر فيها. فأستاذان في 08:00 لا يتعارضان — وهو
 * الغرض من المِلكية أصلاً.
 */
const buildOwnerKey = (academicYearId, teacherId) => `yr:${academicYearId}|tch:${teacherId ?? "-"}`;
/** يحوّل أعمدة TIME إلى "HH:mm" قبل إرسالها للواجهة */
const toResponse = (slot) => ({
    ...slot,
    startTime: (0, time_1.formatTime)(slot.startTime),
    endTime: (0, time_1.formatTime)(slot.endTime),
});
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const slot = await client_1.prisma.lessonSlot.findUnique({
        where: { id },
        select: lessonSlotSelect,
    });
    if (!slot) {
        throw new app_errors_1.NotFoundException("Lesson slot not found", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    return slot;
};
const getAcademicYearOrThrow = async (academicYearId) => {
    const year = await client_1.prisma.academicYear.findUnique({
        where: { id: academicYearId },
        select: { id: true, name: true },
    });
    if (!year) {
        throw new app_errors_1.NotFoundException("Academic year not found", error_code_enum_1.ErrorCodeEnum.ACADEMIC_YEAR_NOT_FOUND);
    }
    return year;
};
const ensureTeacherExists = async (teacherId) => {
    const teacher = await client_1.prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { id: true },
    });
    if (!teacher) {
        throw new app_errors_1.NotFoundException("Teacher not found", error_code_enum_1.ErrorCodeEnum.TEACHER_NOT_FOUND);
    }
};
/** الترتيب فريد داخل أوقات المالك: لكل أستاذٍ فترتُه رقم 1 */
const ensureUniqueOrder = async (ownerKey, order, excludeId) => {
    const duplicate = await client_1.prisma.lessonSlot.findFirst({
        where: { ownerKey, order, ...(excludeId && { NOT: { id: excludeId } }) },
        select: { id: true },
    });
    if (duplicate) {
        throw new app_errors_1.ConflictException(`يوجد توقيتٌ بالترتيب ${order} لهذا المالك في هذه السنة`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
};
const nextOrder = async (ownerKey) => {
    const last = await client_1.prisma.lessonSlot.findFirst({
        where: { ownerKey },
        orderBy: { order: "desc" },
        select: { order: true },
    });
    return (last?.order ?? 0) + 1;
};
/**
 * يمنع تكرار **الوقت نفسه** عند المالك نفسه — لا التداخل.
 *
 * كان المنع للتداخل: فترتان تشتركان في دقيقةٍ واحدة تُرفض ثانيتهما عند
 * الأستاذ الواحد. وهو خلطٌ بين تعريف الوقت وبين الدرس الواقع فيه:
 * الفترة ليست حصّةً بل قالبٌ زمني بلا يوم، فأستاذةٌ تدرّس الفرنسية
 * 08:00–10:00 يومَ الاثنين لها أن تدرّس الإنجليزية 08:00–09:30 يومَ
 * الجمعة — ولا تعارض. والمنعُ كان يقطع هذا الطريق ويطلب منها وقتاً
 * ثالثاً لا تريده.
 *
 * والحمايةُ الحقيقية في مكانها: `schedule.service` يرفض أن يكون
 * الأستاذ أو الفوج أو القاعة في وقتين متداخلين **من يومٍ واحد** —
 * وهناك يقع التعارض فعلاً.
 *
 * ويبقى الوقت المتطابق ممنوعاً: فترتان لأستاذٍ واحد بالبداية والنهاية
 * نفسِهما لا تختلفان إلّا بالاسم، وتجعلان اختيار إحداهما عند الجدولة
 * قرعةً.
 */
const ensureNoDuplicateTime = async (ownerKey, startTime, endTime, excludeId) => {
    const slots = await client_1.prisma.lessonSlot.findMany({
        where: { ownerKey, ...(excludeId && { NOT: { id: excludeId } }) },
        select: { name: true, startTime: true, endTime: true },
    });
    const duplicate = slots.find((slot) => (0, time_1.toMinutes)((0, time_1.formatTime)(slot.startTime)) === (0, time_1.toMinutes)(startTime) &&
        (0, time_1.toMinutes)((0, time_1.formatTime)(slot.endTime)) === (0, time_1.toMinutes)(endTime));
    if (duplicate) {
        throw new app_errors_1.ConflictException(`للمالك فترةٌ بهذا الوقت نفسه: «${duplicate.name}» ` +
            `(${(0, time_1.formatTime)(duplicate.startTime)} – ${(0, time_1.formatTime)(duplicate.endTime)})`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
};
const ensureValidRange = (startTime, endTime) => {
    if ((0, time_1.toMinutes)(endTime) <= (0, time_1.toMinutes)(startTime)) {
        throw new app_errors_1.BadRequestException("End time must be after start time", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listLessonSlotsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const where = {
        ...(query.academicYearId && { academicYearId: query.academicYearId }),
        ...(query.teacherId && { teacherId: query.teacherId }),
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.search && { name: { contains: query.search } }),
    };
    const [slots, total] = await Promise.all([
        client_1.prisma.lessonSlot.findMany({
            where,
            select: {
                ...lessonSlotSelect,
                _count: { select: { schedules: true } },
            },
            skip,
            take,
            orderBy: { order: "asc" },
        }),
        client_1.prisma.lessonSlot.count({ where }),
    ]);
    return {
        lessonSlots: slots.map(toResponse),
        pagination: (0, api_response_1.buildPagination)(total, page, limit),
    };
};
exports.listLessonSlotsService = listLessonSlotsService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getLessonSlotService = async (id) => {
    await findOrThrow(id);
    const slot = await client_1.prisma.lessonSlot.findUnique({
        where: { id },
        select: {
            ...lessonSlotSelect,
            _count: { select: { schedules: true } },
        },
    });
    return slot ? toResponse(slot) : null;
};
exports.getLessonSlotService = getLessonSlotService;
// --------------------------------------------------
// Create
// --------------------------------------------------
const createLessonSlotService = async (body) => {
    await getAcademicYearOrThrow(body.academicYearId);
    const teacherId = body.teacherId ?? null;
    if (teacherId)
        await ensureTeacherExists(teacherId);
    const ownerKey = buildOwnerKey(body.academicYearId, teacherId);
    ensureValidRange(body.startTime, body.endTime);
    await ensureNoDuplicateTime(ownerKey, body.startTime, body.endTime);
    if (body.order !== undefined) {
        await ensureUniqueOrder(ownerKey, body.order);
    }
    const slot = await client_1.prisma.lessonSlot.create({
        data: {
            academicYearId: body.academicYearId,
            teacherId,
            ownerKey,
            name: body.name,
            order: body.order ?? (await nextOrder(ownerKey)),
            startTime: (0, time_1.parseTime)(body.startTime),
            endTime: (0, time_1.parseTime)(body.endTime),
            isActive: body.isActive ?? true,
        },
        select: lessonSlotSelect,
    });
    return toResponse(slot);
};
exports.createLessonSlotService = createLessonSlotService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateLessonSlotService = async (id, body) => {
    const existing = await findOrThrow(id);
    // الوقت النهائي بعد التعديل — قد يُرسل أحد الطرفين فقط
    const startTime = body.startTime ?? (0, time_1.formatTime)(existing.startTime);
    const endTime = body.endTime ?? (0, time_1.formatTime)(existing.endTime);
    // المالك بعد التعديل — تغييرُه يُعيد حساب البصمة وكل التحقّقات معها
    const teacherId = body.teacherId !== undefined ? (body.teacherId ?? null) : existing.teacherId;
    if (teacherId && teacherId !== existing.teacherId) {
        await ensureTeacherExists(teacherId);
    }
    const ownerKey = buildOwnerKey(existing.academicYearId, teacherId);
    const ownerChanged = ownerKey !== existing.ownerKey;
    if (body.startTime !== undefined || body.endTime !== undefined || ownerChanged) {
        ensureValidRange(startTime, endTime);
        await ensureNoDuplicateTime(ownerKey, startTime, endTime, id);
    }
    if (body.order !== undefined || ownerChanged) {
        await ensureUniqueOrder(ownerKey, body.order ?? existing.order, id);
    }
    const slot = await client_1.prisma.lessonSlot.update({
        where: { id },
        data: {
            teacherId,
            ownerKey,
            ...(body.name !== undefined && { name: body.name }),
            ...(body.order !== undefined && { order: body.order }),
            ...(body.startTime !== undefined && {
                startTime: (0, time_1.parseTime)(body.startTime),
            }),
            ...(body.endTime !== undefined && { endTime: (0, time_1.parseTime)(body.endTime) }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: lessonSlotSelect,
    });
    return toResponse(slot);
};
exports.updateLessonSlotService = updateLessonSlotService;
// --------------------------------------------------
// Delete — ممنوع إن كانت مستعملة في جدول الحصص
// --------------------------------------------------
const deleteLessonSlotService = async (id) => {
    await findOrThrow(id);
    const schedules = await client_1.prisma.schedule.count({
        where: { lessonSlotId: id },
    });
    if (schedules > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: lesson slot is used in ${schedules} schedule(s). ` +
            `Deactivate it instead.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.lessonSlot.delete({ where: { id } });
};
exports.deleteLessonSlotService = deleteLessonSlotService;
//# sourceMappingURL=lesson-slot.service.js.map