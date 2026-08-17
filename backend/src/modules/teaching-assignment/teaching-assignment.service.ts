import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import {
  CreateTeachingAssignmentInput,
  UpdateTeachingAssignmentInput,
  TeachingAssignmentQueryInput,
} from "./teaching-assignment.schema";

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
} as const;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const assignment = await prisma.teachingAssignment.findUnique({
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
    throw new NotFoundException(
      "Teaching assignment not found",
      ErrorCodeEnum.TEACHING_ASSIGNMENT_NOT_FOUND,
    );
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
const ensureRelationsExist = async (parts: {
  teacherId?: string;
  subjectId?: string;
  studyGroupId?: string;
  academicYearId?: string;
}) => {
  if (parts.teacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: parts.teacherId },
      select: { id: true, isActive: true, firstName: true, lastName: true },
    });

    if (!teacher) {
      throw new NotFoundException(
        "Teacher not found",
        ErrorCodeEnum.TEACHER_NOT_FOUND,
      );
    }

    if (!teacher.isActive) {
      throw new BadRequestException(
        `Cannot assign an inactive teacher (${teacher.lastName} ${teacher.firstName})`,
        ErrorCodeEnum.VALIDATION_ERROR,
      );
    }
  }

  if (parts.subjectId) {
    const subject = await prisma.subject.findUnique({
      where: { id: parts.subjectId },
      select: { id: true, isActive: true, name: true },
    });

    if (!subject) {
      throw new NotFoundException(
        "Subject not found",
        ErrorCodeEnum.SUBJECT_NOT_FOUND,
      );
    }

    if (!subject.isActive) {
      throw new BadRequestException(
        `Cannot assign an inactive subject (${subject.name})`,
        ErrorCodeEnum.VALIDATION_ERROR,
      );
    }
  }

  if (parts.studyGroupId) {
    const studyGroup = await prisma.studyGroup.findUnique({
      where: { id: parts.studyGroupId },
      select: { id: true, isActive: true, name: true },
    });

    if (!studyGroup) {
      throw new NotFoundException(
        "Study group not found",
        ErrorCodeEnum.STUDY_GROUP_NOT_FOUND,
      );
    }

    if (!studyGroup.isActive) {
      throw new BadRequestException(
        `Cannot assign to an inactive study group (${studyGroup.name})`,
        ErrorCodeEnum.VALIDATION_ERROR,
      );
    }
  }

  if (parts.academicYearId) {
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: parts.academicYearId },
      select: { id: true },
    });

    if (!academicYear) {
      throw new NotFoundException(
        "Academic year not found",
        ErrorCodeEnum.ACADEMIC_YEAR_NOT_FOUND,
      );
    }
  }
};

/** @@unique([teacherId, subjectId, studyGroupId, academicYearId]) */
const ensureUniqueCombination = async (
  parts: {
    teacherId: string;
    subjectId: string;
    studyGroupId: string;
    academicYearId: string;
  },
  excludeId?: string,
) => {
  const duplicate = await prisma.teachingAssignment.findFirst({
    where: { ...parts, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictException(
      "This teacher is already assigned to this subject for this study group and academic year",
      ErrorCodeEnum.TEACHING_ASSIGNMENT_EXISTS,
    );
  }
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listTeachingAssignmentsService = async (
  query: TeachingAssignmentQueryInput,
) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const where: Prisma.TeachingAssignmentWhereInput = {
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.teacherId && { teacherId: query.teacherId }),
    ...(query.subjectId && { subjectId: query.subjectId }),
    ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
    ...(query.academicYearId && { academicYearId: query.academicYearId }),
  };

  const [assignments, total] = await Promise.all([
    prisma.teachingAssignment.findMany({
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
    prisma.teachingAssignment.count({ where }),
  ]);

  return { teachingAssignments: assignments, pagination: buildPagination(total, page, limit) };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getTeachingAssignmentService = async (id: string) => {
  await findOrThrow(id);

  return prisma.teachingAssignment.findUnique({
    where: { id },
    select: {
      ...assignmentSelect,
      _count: { select: { enrollments: true, schedules: true } },
    },
  });
};

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createTeachingAssignmentService = async (
  body: CreateTeachingAssignmentInput,
) => {
  await ensureRelationsExist(body);

  await ensureUniqueCombination({
    teacherId: body.teacherId,
    subjectId: body.subjectId,
    studyGroupId: body.studyGroupId,
    academicYearId: body.academicYearId,
  });

  return prisma.teachingAssignment.create({
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

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateTeachingAssignmentService = async (
  id: string,
  body: UpdateTeachingAssignmentInput,
) => {
  const existing = await findOrThrow(id);

  await ensureRelationsExist(body);

  const changesKey =
    body.teacherId !== undefined ||
    body.subjectId !== undefined ||
    body.studyGroupId !== undefined ||
    body.academicYearId !== undefined;

  if (changesKey) {
    await ensureUniqueCombination(
      {
        teacherId: body.teacherId ?? existing.teacherId,
        subjectId: body.subjectId ?? existing.subjectId,
        studyGroupId: body.studyGroupId ?? existing.studyGroupId,
        academicYearId: body.academicYearId ?? existing.academicYearId,
      },
      id,
    );
  }

  return prisma.teachingAssignment.update({
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

// --------------------------------------------------
// Delete — ممنوع إن كان له تسجيلات أو حصص
// --------------------------------------------------

export const deleteTeachingAssignmentService = async (id: string) => {
  await findOrThrow(id);

  const relations = await prisma.teachingAssignment.findUnique({
    where: { id },
    select: { _count: { select: { enrollments: true, schedules: true } } },
  });

  const enrollments = relations?._count.enrollments ?? 0;
  const schedules = relations?._count.schedules ?? 0;

  if (enrollments > 0 || schedules > 0) {
    throw new ConflictException(
      `Cannot delete: assignment has ${enrollments} enrollment(s) and ` +
        `${schedules} schedule(s). Deactivate it instead.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  await prisma.teachingAssignment.delete({ where: { id } });
};
