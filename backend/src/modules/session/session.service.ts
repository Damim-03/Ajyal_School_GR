import { Prisma } from "../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import {
  formatTime,
  startOfUtcDay,
  addUtcDays,
  formatDate,
  DAY_OF_WEEK_INDEX,
} from "../../core/utils/time";
import {
  CreateSessionInput,
  GenerateSessionsInput,
  UpdateSessionInput,
  SessionQueryInput,
} from "./session.schema";

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
} as const;

type RawSession = {
  schedule: {
    lessonSlot: { startTime: Date | string; endTime: Date | string; [k: string]: unknown };
    [k: string]: unknown;
  };
  [key: string]: unknown;
};

const toResponse = <T extends RawSession>(session: T) => ({
  ...session,
  schedule: {
    ...session.schedule,
    lessonSlot: {
      ...session.schedule.lessonSlot,
      startTime: formatTime(session.schedule.lessonSlot.startTime),
      endTime: formatTime(session.schedule.lessonSlot.endTime),
    },
  },
});

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const session = await prisma.session.findUnique({
    where: { id },
    select: {
      id: true,
      scheduleId: true,
      lessonNumber: true,
      sessionDate: true,
    },
  });

  if (!session) {
    throw new NotFoundException(
      "Session not found",
      ErrorCodeEnum.SESSION_NOT_FOUND,
    );
  }

  return session;
};

const getScheduleOrThrow = async (scheduleId: string) => {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, dayOfWeek: true, isActive: true },
  });

  if (!schedule) {
    throw new NotFoundException(
      "Schedule not found",
      ErrorCodeEnum.SCHEDULE_NOT_FOUND,
    );
  }

  return schedule;
};

/** آخر رقم حصة في هذا الجدول + 1 */
const nextLessonNumber = async (scheduleId: string): Promise<number> => {
  const last = await prisma.session.findFirst({
    where: { scheduleId },
    orderBy: { lessonNumber: "desc" },
    select: { lessonNumber: true },
  });

  return (last?.lessonNumber ?? 0) + 1;
};

const ensureUniqueLessonNumber = async (
  scheduleId: string,
  lessonNumber: number,
  excludeId?: string,
) => {
  const duplicate = await prisma.session.findFirst({
    where: {
      scheduleId,
      lessonNumber,
      ...(excludeId && { NOT: { id: excludeId } }),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictException(
      `Lesson number ${lessonNumber} already exists for this schedule`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }
};

/** حصتان لنفس الجدول في نفس اليوم خطأ بيانات */
const ensureUniqueDate = async (
  scheduleId: string,
  sessionDate: Date,
  excludeId?: string,
) => {
  const day = startOfUtcDay(sessionDate);

  const duplicate = await prisma.session.findFirst({
    where: {
      scheduleId,
      sessionDate: { gte: day, lt: addUtcDays(day, 1) },
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
    throw new ConflictException(
      duplicate.sheetId
        ? `يوجد عمودٌ بتاريخ ${formatDate(day)} في هذا الكشف بالفعل`
        : `توجد حصةٌ بتاريخ ${formatDate(day)} غير منسوبة إلى أيّ كشف — ` +
            `ضُمَّها إلى هذا الكشف بدل إنشاء حصةٍ ثانية بنفس التاريخ.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listSessionsService = async (query: SessionQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const assignmentFilter: Prisma.TeachingAssignmentWhereInput = {
    ...(query.teacherId && { teacherId: query.teacherId }),
    ...(query.subjectId && { subjectId: query.subjectId }),
    ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
    ...(query.academicYearId && { academicYearId: query.academicYearId }),
  };

  const where: Prisma.SessionWhereInput = {
    ...(query.scheduleId && { scheduleId: query.scheduleId }),
    ...(query.teachingAssignmentId && {
      schedule: { teachingAssignmentId: query.teachingAssignmentId },
    }),
    ...(query.status && { status: query.status }),
    ...((query.dateFrom || query.dateTo) && {
      sessionDate: {
        ...(query.dateFrom && { gte: startOfUtcDay(query.dateFrom) }),
        // شامل ليوم النهاية
        ...(query.dateTo && { lt: addUtcDays(startOfUtcDay(query.dateTo), 1) }),
      },
    }),
    ...(Object.keys(assignmentFilter).length > 0 && {
      schedule: { teachingAssignment: assignmentFilter },
    }),
  };

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where,
      select: { ...sessionSelect, _count: { select: { attendances: true } } },
      skip,
      take,
      orderBy: [{ sessionDate: "asc" }, { lessonNumber: "asc" }],
    }),
    prisma.session.count({ where }),
  ]);

  return {
    sessions: sessions.map(toResponse),
    pagination: buildPagination(total, page, limit),
  };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getSessionService = async (id: string) => {
  await findOrThrow(id);

  const session = await prisma.session.findUnique({
    where: { id },
    select: { ...sessionSelect, _count: { select: { attendances: true } } },
  });

  return session ? toResponse(session) : null;
};

// --------------------------------------------------
// Create — يدوي
// --------------------------------------------------

export const createSessionService = async (body: CreateSessionInput) => {
  const schedule = await getScheduleOrThrow(body.scheduleId);

  const sessionDate = startOfUtcDay(body.sessionDate);

  await ensureUniqueDate(schedule.id, sessionDate);

  const lessonNumber =
    body.lessonNumber ?? (await nextLessonNumber(schedule.id));

  if (body.lessonNumber !== undefined) {
    await ensureUniqueLessonNumber(schedule.id, body.lessonNumber);
  }

  const session = await prisma.session.create({
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

// --------------------------------------------------
// Generate — توليد من الجدول الأسبوعي
//
// لكل جدول نمشي على أيام المدى ونلتقط ما يوافق يومه.
// التواريخ الموجودة سلفاً تُتخطّى بدل أن تُفشل العملية،
// فإعادة التشغيل على نفس المدى آمنة.
// --------------------------------------------------

export const generateSessionsService = async (
  body: GenerateSessionsInput,
) => {
  const schedules = await prisma.schedule.findMany({
    where: { id: { in: body.scheduleIds } },
    select: { id: true, dayOfWeek: true, isActive: true },
  });

  if (schedules.length !== body.scheduleIds.length) {
    const found = new Set(schedules.map((s) => s.id));
    const missing = body.scheduleIds.filter((id) => !found.has(id));

    throw new NotFoundException(
      `Schedule(s) not found: ${missing.join(", ")}`,
      ErrorCodeEnum.SCHEDULE_NOT_FOUND,
    );
  }

  const inactive = schedules.filter((s) => !s.isActive);

  if (inactive.length > 0) {
    throw new ConflictException(
      `Cannot generate sessions for inactive schedule(s): ${inactive
        .map((s) => s.id)
        .join(", ")}`,
      ErrorCodeEnum.SCHEDULE_CONFLICT,
    );
  }

  const start = startOfUtcDay(body.startDate);
  const end = startOfUtcDay(body.endDate);

  const skip = new Set(
    (body.skipDates ?? []).map((date) => formatDate(startOfUtcDay(date))),
  );

  let createdCount = 0;
  let skippedExisting = 0;
  let skippedHoliday = 0;

  const created: string[] = [];

  for (const schedule of schedules) {
    const weekday = DAY_OF_WEEK_INDEX[schedule.dayOfWeek];

    // التواريخ المسجَّلة سلفاً لهذا الجدول ضمن المدى
    const existing = await prisma.session.findMany({
      where: {
        scheduleId: schedule.id,
        sessionDate: { gte: start, lt: addUtcDays(end, 1) },
      },
      select: { sessionDate: true },
    });

    const taken = new Set(existing.map((s) => formatDate(s.sessionDate)));

    let lessonNumber = await nextLessonNumber(schedule.id);

    const rows: { sessionDate: Date; lessonNumber: number }[] = [];

    for (
      let date = new Date(start);
      date <= end;
      date = addUtcDays(date, 1)
    ) {
      if (date.getUTCDay() !== weekday) continue;

      const key = formatDate(date);

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

    if (rows.length === 0) continue;

    const inserted = await prisma.$transaction(
      rows.map((row) =>
        prisma.session.create({
          data: {
            scheduleId: schedule.id,
            sessionDate: row.sessionDate,
            lessonNumber: row.lessonNumber,
          },
          select: { id: true },
        }),
      ),
    );

    created.push(...inserted.map((s) => s.id));
    createdCount += inserted.length;
  }

  const sessions = await prisma.session.findMany({
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

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateSessionService = async (
  id: string,
  body: UpdateSessionInput,
) => {
  const existing = await findOrThrow(id);

  if (body.sessionDate !== undefined) {
    await ensureUniqueDate(
      existing.scheduleId,
      startOfUtcDay(body.sessionDate),
      id,
    );
  }

  if (body.lessonNumber !== undefined) {
    await ensureUniqueLessonNumber(
      existing.scheduleId,
      body.lessonNumber,
      id,
    );
  }

  /*
   * الضمّ لا يعبر الإسنادات.
   *
   * كشفٌ يخصّ إسناداً تدريسياً بعينه، وضمُّ حصةِ فوجٍ آخر إليه يخلط
   * حضور فوجين في ورقة واحدة. فيُتحقَّق أنّ الكشف والحصة يتبعان
   * الإسناد نفسه قبل الربط.
   */
  if (body.sheetId) {
    const sheet = await prisma.attendanceSheet.findUnique({
      where: { id: body.sheetId },
      select: { id: true, teachingAssignmentId: true },
    });

    if (!sheet) {
      throw new NotFoundException(
        "كشف الحضور غير موجود",
        ErrorCodeEnum.RESOURCE_NOT_FOUND,
      );
    }

    const owner = await prisma.session.findUnique({
      where: { id },
      select: { schedule: { select: { teachingAssignmentId: true } } },
    });

    if (owner?.schedule.teachingAssignmentId !== sheet.teachingAssignmentId) {
      throw new BadRequestException(
        "لا تُضمّ الحصة إلى كشفٍ يخصّ إسناداً تدريسياً آخر",
        ErrorCodeEnum.VALIDATION_ERROR,
      );
    }
  }

  const session = await prisma.session.update({
    where: { id },
    data: {
      ...(body.sessionDate !== undefined && {
        sessionDate: startOfUtcDay(body.sessionDate),
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

// --------------------------------------------------
// Delete — ممنوع إن كان لها حضور مسجَّل
// --------------------------------------------------

export const deleteSessionService = async (id: string) => {
  await findOrThrow(id);

  const attendances = await prisma.attendance.count({
    where: { sessionId: id },
  });

  if (attendances > 0) {
    throw new ConflictException(
      `Cannot delete: session has ${attendances} attendance record(s). ` +
        `Cancel the session instead (status = CANCELLED).`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  await prisma.session.delete({ where: { id } });
};
