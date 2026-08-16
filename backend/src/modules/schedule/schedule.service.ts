import { Prisma, DayOfWeek } from "../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import { formatTime, toMinutes } from "../../core/utils/time";
import {
  CreateScheduleInput,
  UpdateScheduleInput,
  ScheduleQueryInput,
} from "./schedule.schema";

const scheduleSelect = {
  id: true,
  teachingAssignmentId: true,
  classroomId: true,
  lessonSlotId: true,
  dayOfWeek: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  lessonSlot: {
    select: { id: true, name: true, order: true, startTime: true, endTime: true },
  },
  classroom: { select: { id: true, name: true, code: true } },
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
} as const;

type RawSchedule = {
  lessonSlot: { startTime: Date | string; endTime: Date | string; [k: string]: unknown };
  [key: string]: unknown;
};

/** أوقات الحصة تُرسل نصوصاً "HH:mm" */
const toResponse = <T extends RawSchedule>(schedule: T) => ({
  ...schedule,
  lessonSlot: {
    ...schedule.lessonSlot,
    startTime: formatTime(schedule.lessonSlot.startTime),
    endTime: formatTime(schedule.lessonSlot.endTime),
  },
});

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const schedule = await prisma.schedule.findUnique({
    where: { id },
    select: {
      id: true,
      teachingAssignmentId: true,
      classroomId: true,
      lessonSlotId: true,
      dayOfWeek: true,
    },
  });

  if (!schedule) {
    throw new NotFoundException(
      "Schedule not found",
      ErrorCodeEnum.SCHEDULE_NOT_FOUND,
    );
  }

  return schedule;
};

/** يجلب الإسناد بأطرافه — نحتاج الأستاذ والفوج والسنة لفحص التعارض */
const getAssignmentOrThrow = async (teachingAssignmentId: string) => {
  const assignment = await prisma.teachingAssignment.findUnique({
    where: { id: teachingAssignmentId },
    select: {
      id: true,
      teacherId: true,
      studyGroupId: true,
      academicYearId: true,
      teacher: { select: { firstName: true, lastName: true } },
      studyGroup: { select: { name: true } },
    },
  });

  if (!assignment) {
    throw new NotFoundException(
      "Teaching assignment not found",
      ErrorCodeEnum.TEACHING_ASSIGNMENT_NOT_FOUND,
    );
  }

  return assignment;
};

/**
 * الفترة تقبل الإسناد أو ترفضه — سنةً ومالكاً.
 *
 * السنة: لا معنى لجدولة إسنادِ 2026/2027 في فترةٍ مُعرَّفة ضمن سياسة
 * 2027/2028.
 *
 * والمالك: الفترة صارت تخصّ أستاذاً بعينه (`LessonSlot.teacherId`)،
 * فوضعُ حصّة زميله فيها يجعل عمود التوقيت يقول اسماً والخانةُ تقول
 * غيرَه. والفارغُ منها فترةٌ عامّة يجدولها من شاء.
 *
 * وتُعيد الفترةَ بأوقاتها لأنّ فحصَ التعارض بعدها يحتاجها.
 */
const ensureSlotFitsAssignment = async (
  lessonSlotId: string,
  assignment: {
    academicYearId: string;
    teacherId: string;
    teacher: { firstName: string; lastName: string };
  },
) => {
  const slot = await prisma.lessonSlot.findUnique({
    where: { id: lessonSlotId },
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      academicYearId: true,
      teacherId: true,
      academicYear: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  });

  if (!slot) {
    throw new NotFoundException(
      "Lesson slot not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (slot.academicYearId !== assignment.academicYearId) {
    throw new BadRequestException(
      `الفترة «${slot.name}» تخصّ السنة الدراسية ${slot.academicYear.name}، ` +
        `وهي غير سنة الإسناد`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  if (slot.teacherId && slot.teacherId !== assignment.teacherId) {
    throw new BadRequestException(
      `الفترة «${slot.name}» تخصّ الأستاذ ` +
        `${slot.teacher!.lastName} ${slot.teacher!.firstName}، ` +
        `فلا تُبرمج فيها حصّةُ ${assignment.teacher.lastName} ${assignment.teacher.firstName}`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  return slot;
};

const ensureClassroomExists = async (classroomId: string) => {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { id: true },
  });

  if (!classroom) {
    throw new NotFoundException(
      "Classroom not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }
};

/**
 * وصف مختصر لحصة متعارضة — يُستعمل في رسالة الخطأ.
 *
 * ووقتُها جزءٌ منه: التعارض صار بالتداخل لا بالتطابق، فقد يقع بين
 * 08:00–10:00 و09:00–11:00 — ومن لا يرى وقتَ الطرف الآخر لا يفهم لِمَ
 * رُفضت حصّته.
 */
const describe = (conflict: {
  lessonSlot: { startTime: Date | string; endTime: Date | string };
  teachingAssignment: {
    subject: { name: string };
    teacher: { firstName: string; lastName: string };
    studyGroup: { name: string };
  };
}) =>
  `${conflict.teachingAssignment.subject.name} — ` +
  `${conflict.teachingAssignment.teacher.lastName} ${conflict.teachingAssignment.teacher.firstName} — ` +
  `${conflict.teachingAssignment.studyGroup.name} ` +
  `(${formatTime(conflict.lessonSlot.startTime)} – ${formatTime(conflict.lessonSlot.endTime)})`;

const conflictSelect = {
  id: true,
  classroomId: true,
  lessonSlot: { select: { name: true, startTime: true, endTime: true } },
  teachingAssignment: {
    select: {
      id: true,
      teacherId: true,
      studyGroupId: true,
      subject: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
      studyGroup: { select: { name: true } },
    },
  },
} as const;

/**
 * ثلاثة تعارضات ممنوعة في اليوم نفسه والسنة نفسها:
 *
 *   1. القاعة   — قاعة واحدة لا تستقبل حصتين
 *   2. الأستاذ  — أستاذ واحد لا يدرّس في مكانين
 *   3. الفوج    — فوج واحد لا يحضر مادتين
 *
 * والمقارنة **بالوقت لا برقم الفترة**. كان الفحص يقارن `lessonSlotId`
 * فيكفي حين تكون الفترات جدولاً موحَّداً للمؤسسة: تطابقُ الرقم تطابقُ
 * الوقت. ولمّا صارت الفترة مملوكةً لأستاذ — فلكلٍّ فترتُه 08:00–10:00 —
 * انفصل الأمران: قاعةٌ محجوزة في فترة أستاذٍ تبدو شاغرةً في فترة
 * زميله، ويجلس الفوج نفسه في درسين معاً وكلاهما يمرّ.
 *
 * فالتداخل يُحسب كما يُحسب في `lesson-slot.service`: بدايةُ أحدهما
 * قبل نهاية الآخر والعكس.
 *
 * الحصص المعطّلة (isActive = false) لا تُحتسب، والمقارنة محصورة بنفس
 * السنة الدراسية حتى لا تعيق جداولُ سنةٍ ماضية جدولَ السنة الحالية.
 */
const ensureNoConflicts = async (
  assignment: {
    id: string;
    teacherId: string;
    studyGroupId: string;
    academicYearId: string;
    teacher: { firstName: string; lastName: string };
    studyGroup: { name: string };
  },
  dayOfWeek: DayOfWeek,
  slot: { startTime: Date | string; endTime: Date | string },
  classroomId: string | null,
  excludeId?: string,
) => {
  const start = toMinutes(formatTime(slot.startTime));
  const end = toMinutes(formatTime(slot.endTime));

  /* المرشَّحون: كل ما يخصّ هذا الأستاذ أو هذا الفوج أو هذه القاعة في
     هذا اليوم — ثم يُصفّى منهم المتداخلُ زمنياً وحده. */
  const rivals = await prisma.schedule.findMany({
    where: {
      dayOfWeek,
      isActive: true,
      ...(excludeId && { NOT: { id: excludeId } }),
      teachingAssignment: { academicYearId: assignment.academicYearId },
      OR: [
        { teachingAssignment: { teacherId: assignment.teacherId } },
        { teachingAssignment: { studyGroupId: assignment.studyGroupId } },
        ...(classroomId ? [{ classroomId }] : []),
      ],
    },
    select: conflictSelect,
  });

  const overlapping = rivals.filter((rival) => {
    const otherStart = toMinutes(formatTime(rival.lessonSlot.startTime));
    const otherEnd = toMinutes(formatTime(rival.lessonSlot.endTime));

    return start < otherEnd && otherStart < end;
  });

  // 0. نفس الإسناد — مبرمَجٌ سلفاً في هذا الوقت
  if (overlapping.some((r) => r.teachingAssignment.id === assignment.id)) {
    throw new ConflictException(
      "هذا الإسناد مبرمَجٌ سلفاً في هذا اليوم وهذا الوقت",
      ErrorCodeEnum.SCHEDULE_CONFLICT,
    );
  }

  // 1. القاعة
  const roomClash =
    classroomId && overlapping.find((r) => r.classroomId === classroomId);

  if (roomClash) {
    throw new ConflictException(
      `القاعة مشغولة في هذا الوقت بـ${describe(roomClash)}`,
      ErrorCodeEnum.SCHEDULE_CONFLICT,
    );
  }

  // 2. الأستاذ
  const teacherClash = overlapping.find(
    (r) => r.teachingAssignment.teacherId === assignment.teacherId,
  );

  if (teacherClash) {
    throw new ConflictException(
      `الأستاذ ${assignment.teacher.lastName} ${assignment.teacher.firstName} ` +
        `يدرّس في هذا الوقت: ${describe(teacherClash)}`,
      ErrorCodeEnum.SCHEDULE_CONFLICT,
    );
  }

  // 3. الفوج
  const groupClash = overlapping.find(
    (r) => r.teachingAssignment.studyGroupId === assignment.studyGroupId,
  );

  if (groupClash) {
    throw new ConflictException(
      `الفوج «${assignment.studyGroup.name}» له درسٌ في هذا الوقت: ` +
        describe(groupClash),
      ErrorCodeEnum.SCHEDULE_CONFLICT,
    );
  }
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listSchedulesService = async (query: ScheduleQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const assignmentFilter: Prisma.TeachingAssignmentWhereInput = {
    ...(query.teacherId && { teacherId: query.teacherId }),
    ...(query.subjectId && { subjectId: query.subjectId }),
    ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
    ...(query.academicYearId && { academicYearId: query.academicYearId }),
  };

  const where: Prisma.ScheduleWhereInput = {
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.teachingAssignmentId && {
      teachingAssignmentId: query.teachingAssignmentId,
    }),
    ...(query.classroomId && { classroomId: query.classroomId }),
    ...(query.lessonSlotId && { lessonSlotId: query.lessonSlotId }),
    ...(query.dayOfWeek && { dayOfWeek: query.dayOfWeek }),
    ...(Object.keys(assignmentFilter).length > 0 && {
      teachingAssignment: assignmentFilter,
    }),
  };

  const [schedules, total] = await Promise.all([
    prisma.schedule.findMany({
      where,
      select: {
        ...scheduleSelect,
        _count: { select: { sessions: true } },
      },
      skip,
      take,
      // ترتيب enum اليوم يتبع تعريفه في الـ schema — يبدأ بالسبت.
      // ثم بالوقت لا بـ `order`: الترتيب صار رقماً داخل أوقات كل
      // أستاذٍ على حدة، فرقم 1 عند اثنين لا يعني وقتاً واحداً.
      orderBy: [{ dayOfWeek: "asc" }, { lessonSlot: { startTime: "asc" } }],
    }),
    prisma.schedule.count({ where }),
  ]);

  return {
    schedules: schedules.map(toResponse),
    pagination: buildPagination(total, page, limit),
  };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getScheduleService = async (id: string) => {
  await findOrThrow(id);

  const schedule = await prisma.schedule.findUnique({
    where: { id },
    select: {
      ...scheduleSelect,
      _count: { select: { sessions: true } },
    },
  });

  return schedule ? toResponse(schedule) : null;
};

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createScheduleService = async (body: CreateScheduleInput) => {
  const assignment = await getAssignmentOrThrow(body.teachingAssignmentId);

  const slot = await ensureSlotFitsAssignment(body.lessonSlotId, assignment);

  if (body.classroomId) {
    await ensureClassroomExists(body.classroomId);
  }

  // الحصة المعطّلة لا تُنشئ تعارضاً — نفحص فقط عند التفعيل
  if (body.isActive !== false) {
    await ensureNoConflicts(
      assignment,
      body.dayOfWeek,
      slot,
      body.classroomId ?? null,
    );
  }

  const schedule = await prisma.schedule.create({
    data: {
      teachingAssignmentId: body.teachingAssignmentId,
      lessonSlotId: body.lessonSlotId,
      dayOfWeek: body.dayOfWeek,
      classroomId: body.classroomId ?? null,
      isActive: body.isActive ?? true,
    },
    select: scheduleSelect,
  });

  return toResponse(schedule);
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateScheduleService = async (
  id: string,
  body: UpdateScheduleInput,
) => {
  const existing = await findOrThrow(id);

  if (body.classroomId) {
    await ensureClassroomExists(body.classroomId);
  }

  // القيم النهائية بعد التعديل
  const teachingAssignmentId =
    body.teachingAssignmentId ?? existing.teachingAssignmentId;
  const lessonSlotId = body.lessonSlotId ?? existing.lessonSlotId;
  const dayOfWeek = body.dayOfWeek ?? existing.dayOfWeek;
  const classroomId =
    body.classroomId !== undefined ? body.classroomId : existing.classroomId;

  const assignment = await getAssignmentOrThrow(teachingAssignmentId);

  // يُفحص بعد معرفة الإسناد النهائي: تغييرُ أيٍّ من الطرفين قد يوقع
  // الفترة والإسناد في سنتين مختلفتين، أو يضع حصّة أستاذٍ في فترة
  // زميله. ويُفحص دائماً لا عند التغيير وحده — فالفحص يُعيد أوقات
  // الفترة، وعليها يقوم فحصُ التعارض بعده.
  const slot = await ensureSlotFitsAssignment(lessonSlotId, assignment);

  // نُعيد الفحص إن تغيّر أي طرف مؤثّر أو عند إعادة التفعيل
  const affectsConflict =
    body.teachingAssignmentId !== undefined ||
    body.lessonSlotId !== undefined ||
    body.dayOfWeek !== undefined ||
    body.classroomId !== undefined ||
    body.isActive === true;

  if (affectsConflict && body.isActive !== false) {
    await ensureNoConflicts(
      assignment,
      dayOfWeek,
      slot,
      classroomId ?? null,
      id,
    );
  }

  const schedule = await prisma.schedule.update({
    where: { id },
    data: {
      ...(body.teachingAssignmentId !== undefined && {
        teachingAssignmentId: body.teachingAssignmentId,
      }),
      ...(body.lessonSlotId !== undefined && { lessonSlotId: body.lessonSlotId }),
      ...(body.dayOfWeek !== undefined && { dayOfWeek: body.dayOfWeek }),
      ...(body.classroomId !== undefined && { classroomId: body.classroomId }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    select: scheduleSelect,
  });

  return toResponse(schedule);
};

// --------------------------------------------------
// Delete — ممنوع إن كانت لها حصص فعلية
// --------------------------------------------------

export const deleteScheduleService = async (id: string) => {
  await findOrThrow(id);

  const sessions = await prisma.session.count({ where: { scheduleId: id } });

  if (sessions > 0) {
    throw new ConflictException(
      `Cannot delete: schedule has ${sessions} session(s). ` +
        `Deactivate it instead.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  await prisma.schedule.delete({ where: { id } });
};
