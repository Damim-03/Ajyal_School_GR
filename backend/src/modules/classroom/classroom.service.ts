import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import {
  CreateClassroomInput,
  UpdateClassroomInput,
  ClassroomQueryInput,
} from "./classroom.schema";
import { containsOn, matchTextIds } from "../../core/search/text-match";

const classroomSelect = {
  id: true,
  name: true,
  code: true,
  capacity: true,
  floor: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const classroom = await prisma.classroom.findUnique({
    where: { id },
    select: classroomSelect,
  });

  if (!classroom) {
    throw new NotFoundException(
      "Classroom not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  return classroom;
};

/**
 * الاسم غير فريد في الـ schema، لكن code فريد.
 * نمنع تكرار الرمز برسالة واضحة بدل خطأ P2002.
 */
const ensureUniqueCode = async (code: string, excludeId?: string) => {
  const duplicate = await prisma.classroom.findFirst({
    where: { code, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictException(
      "A classroom with this code already exists",
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listClassroomsService = async (query: ClassroomQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  /* مطابقةٌ بترتيبٍ صريح — انظر `core/search/text-match` */
  const searchIds = query.search
    ? await matchTextIds("Classroom", [containsOn(["name", "code"], query.search)])
    : null;

  const where: Prisma.ClassroomWhereInput = {
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.floor !== undefined && { floor: query.floor }),
    ...(searchIds && { id: { in: searchIds } }),
  };

  const [classrooms, total] = await Promise.all([
    prisma.classroom.findMany({
      where,
      select: {
        ...classroomSelect,
        _count: { select: { schedules: true } },
      },
      skip,
      take,
      orderBy: [{ floor: "asc" }, { name: "asc" }],
    }),
    prisma.classroom.count({ where }),
  ]);

  return { classrooms, pagination: buildPagination(total, page, limit) };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getClassroomService = async (id: string) => {
  await findOrThrow(id);

  return prisma.classroom.findUnique({
    where: { id },
    select: {
      ...classroomSelect,
      _count: { select: { schedules: true } },
    },
  });
};

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createClassroomService = async (body: CreateClassroomInput) => {
  if (body.code) {
    await ensureUniqueCode(body.code);
  }

  return prisma.classroom.create({
    data: {
      name: body.name,
      code: body.code ?? null,
      capacity: body.capacity ?? null,
      floor: body.floor ?? null,
      description: body.description ?? null,
      isActive: body.isActive ?? true,
    },
    select: classroomSelect,
  });
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateClassroomService = async (
  id: string,
  body: UpdateClassroomInput,
) => {
  await findOrThrow(id);

  if (body.code) {
    await ensureUniqueCode(body.code, id);
  }

  return prisma.classroom.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.code !== undefined && { code: body.code }),
      ...(body.capacity !== undefined && { capacity: body.capacity }),
      ...(body.floor !== undefined && { floor: body.floor }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    select: classroomSelect,
  });
};

// --------------------------------------------------
// Delete — ممنوع إن كانت مستعملة في جدول الحصص
// --------------------------------------------------

export const deleteClassroomService = async (id: string) => {
  await findOrThrow(id);

  const schedules = await prisma.schedule.count({ where: { classroomId: id } });

  if (schedules > 0) {
    throw new ConflictException(
      `Cannot delete: classroom is used in ${schedules} schedule(s). ` +
        `Deactivate it instead.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  await prisma.classroom.delete({ where: { id } });
};
