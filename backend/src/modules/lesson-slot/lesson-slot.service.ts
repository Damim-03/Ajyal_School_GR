import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import { parseTime, formatTime, toMinutes } from "../../core/utils/time";
import {
  CreateLessonSlotInput,
  UpdateLessonSlotInput,
  LessonSlotQueryInput,
} from "./lesson-slot.schema";

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
} as const;

/**
 * مالك الفترة — أستاذٌ أو المؤسسة.
 *
 * كل تحقّقات هذا الموديول تدور حوله: الترتيب فريدٌ داخل أوقات المالك،
 * والوقت المتطابق لا يتكرّر فيها. فأستاذان في 08:00 لا يتعارضان — وهو
 * الغرض من المِلكية أصلاً.
 */
const buildOwnerKey = (academicYearId: string, teacherId: string | null) =>
  `yr:${academicYearId}|tch:${teacherId ?? "-"}`;

type RawLessonSlot = {
  startTime: Date | string;
  endTime: Date | string;
  [key: string]: unknown;
};

/** يحوّل أعمدة TIME إلى "HH:mm" قبل إرسالها للواجهة */
const toResponse = <T extends RawLessonSlot>(slot: T) => ({
  ...slot,
  startTime: formatTime(slot.startTime),
  endTime: formatTime(slot.endTime),
});

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const slot = await prisma.lessonSlot.findUnique({
    where: { id },
    select: lessonSlotSelect,
  });

  if (!slot) {
    throw new NotFoundException(
      "Lesson slot not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  return slot;
};

const getAcademicYearOrThrow = async (academicYearId: string) => {
  const year = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    select: { id: true, name: true },
  });

  if (!year) {
    throw new NotFoundException(
      "Academic year not found",
      ErrorCodeEnum.ACADEMIC_YEAR_NOT_FOUND,
    );
  }

  return year;
};

const ensureTeacherExists = async (teacherId: string) => {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { id: true },
  });

  if (!teacher) {
    throw new NotFoundException(
      "Teacher not found",
      ErrorCodeEnum.TEACHER_NOT_FOUND,
    );
  }
};

/** الترتيب فريد داخل أوقات المالك: لكل أستاذٍ فترتُه رقم 1 */
const ensureUniqueOrder = async (
  ownerKey: string,
  order: number,
  excludeId?: string,
) => {
  const duplicate = await prisma.lessonSlot.findFirst({
    where: { ownerKey, order, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictException(
      `يوجد توقيتٌ بالترتيب ${order} لهذا المالك في هذه السنة`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }
};

const nextOrder = async (ownerKey: string): Promise<number> => {
  const last = await prisma.lessonSlot.findFirst({
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
const ensureNoDuplicateTime = async (
  ownerKey: string,
  startTime: string,
  endTime: string,
  excludeId?: string,
) => {
  const slots = await prisma.lessonSlot.findMany({
    where: { ownerKey, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { name: true, startTime: true, endTime: true },
  });

  const duplicate = slots.find(
    (slot) =>
      toMinutes(formatTime(slot.startTime)) === toMinutes(startTime) &&
      toMinutes(formatTime(slot.endTime)) === toMinutes(endTime),
  );

  if (duplicate) {
    throw new ConflictException(
      `للمالك فترةٌ بهذا الوقت نفسه: «${duplicate.name}» ` +
        `(${formatTime(duplicate.startTime)} – ${formatTime(duplicate.endTime)})`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }
};

const ensureValidRange = (startTime: string, endTime: string) => {
  if (toMinutes(endTime) <= toMinutes(startTime)) {
    throw new BadRequestException(
      "End time must be after start time",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listLessonSlotsService = async (query: LessonSlotQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const where: Prisma.LessonSlotWhereInput = {
    ...(query.academicYearId && { academicYearId: query.academicYearId }),
    ...(query.teacherId && { teacherId: query.teacherId }),
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.search && { name: { contains: query.search } }),
  };

  const [slots, total] = await Promise.all([
    prisma.lessonSlot.findMany({
      where,
      select: {
        ...lessonSlotSelect,
        _count: { select: { schedules: true } },
      },
      skip,
      take,
      orderBy: { order: "asc" },
    }),
    prisma.lessonSlot.count({ where }),
  ]);

  return {
    lessonSlots: slots.map(toResponse),
    pagination: buildPagination(total, page, limit),
  };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getLessonSlotService = async (id: string) => {
  await findOrThrow(id);

  const slot = await prisma.lessonSlot.findUnique({
    where: { id },
    select: {
      ...lessonSlotSelect,
      _count: { select: { schedules: true } },
    },
  });

  return slot ? toResponse(slot) : null;
};

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createLessonSlotService = async (body: CreateLessonSlotInput) => {
  await getAcademicYearOrThrow(body.academicYearId);

  const teacherId = body.teacherId ?? null;

  if (teacherId) await ensureTeacherExists(teacherId);

  const ownerKey = buildOwnerKey(body.academicYearId, teacherId);

  ensureValidRange(body.startTime, body.endTime);
  await ensureNoDuplicateTime(ownerKey, body.startTime, body.endTime);

  if (body.order !== undefined) {
    await ensureUniqueOrder(ownerKey, body.order);
  }

  const slot = await prisma.lessonSlot.create({
    data: {
      academicYearId: body.academicYearId,
      teacherId,
      ownerKey,
      name: body.name,
      order: body.order ?? (await nextOrder(ownerKey)),
      startTime: parseTime(body.startTime),
      endTime: parseTime(body.endTime),
      isActive: body.isActive ?? true,
    },
    select: lessonSlotSelect,
  });

  return toResponse(slot);
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateLessonSlotService = async (
  id: string,
  body: UpdateLessonSlotInput,
) => {
  const existing = await findOrThrow(id);

  // الوقت النهائي بعد التعديل — قد يُرسل أحد الطرفين فقط
  const startTime = body.startTime ?? formatTime(existing.startTime);
  const endTime = body.endTime ?? formatTime(existing.endTime);

  // المالك بعد التعديل — تغييرُه يُعيد حساب البصمة وكل التحقّقات معها
  const teacherId =
    body.teacherId !== undefined ? (body.teacherId ?? null) : existing.teacherId;

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

  const slot = await prisma.lessonSlot.update({
    where: { id },
    data: {
      teacherId,
      ownerKey,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.order !== undefined && { order: body.order }),
      ...(body.startTime !== undefined && {
        startTime: parseTime(body.startTime),
      }),
      ...(body.endTime !== undefined && { endTime: parseTime(body.endTime) }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    select: lessonSlotSelect,
  });

  return toResponse(slot);
};

// --------------------------------------------------
// Delete — ممنوع إن كانت مستعملة في جدول الحصص
// --------------------------------------------------

export const deleteLessonSlotService = async (id: string) => {
  await findOrThrow(id);

  const schedules = await prisma.schedule.count({
    where: { lessonSlotId: id },
  });

  if (schedules > 0) {
    throw new ConflictException(
      `Cannot delete: lesson slot is used in ${schedules} schedule(s). ` +
        `Deactivate it instead.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  await prisma.lessonSlot.delete({ where: { id } });
};
