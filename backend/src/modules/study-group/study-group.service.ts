import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import {
  CreateStudyGroupInput,
  UpdateStudyGroupInput,
  StudyGroupQueryInput,
} from "./study-group.schema";

const studyGroupSelect = {
  id: true,
  levelId: true,
  name: true,
  type: true,
  maxStudents: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  level: {
    select: {
      id: true,
      name: true,
      educationStage: { select: { id: true, name: true, type: true } },
    },
  },
} as const;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const studyGroup = await prisma.studyGroup.findUnique({
    where: { id },
    select: studyGroupSelect,
  });

  if (!studyGroup) {
    throw new NotFoundException(
      "Study group not found",
      ErrorCodeEnum.STUDY_GROUP_NOT_FOUND,
    );
  }

  return studyGroup;
};

const ensureLevelExists = async (levelId: string) => {
  const level = await prisma.level.findUnique({
    where: { id: levelId },
    select: { id: true },
  });

  if (!level) {
    throw new NotFoundException(
      "Level not found",
      ErrorCodeEnum.LEVEL_NOT_FOUND,
    );
  }
};

/** الاسم فريد داخل المستوى — @@unique([levelId, name]) */
const ensureUniqueName = async (
  levelId: string,
  name: string,
  excludeId?: string,
) => {
  const duplicate = await prisma.studyGroup.findFirst({
    where: { levelId, name, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictException(
      "A study group with this name already exists in this level",
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listStudyGroupsService = async (query: StudyGroupQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const where: Prisma.StudyGroupWhereInput = {
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.levelId && { levelId: query.levelId }),
    ...(query.type && { type: query.type }),
    ...(query.search && { name: { contains: query.search } }),
  };

  const [studyGroups, total] = await Promise.all([
    prisma.studyGroup.findMany({
      where,
      select: {
        ...studyGroupSelect,
        _count: { select: { teachingAssignments: true, tuitionFees: true } },
      },
      skip,
      take,
      orderBy: [{ level: { sortOrder: "asc" } }, { name: "asc" }],
    }),
    prisma.studyGroup.count({ where }),
  ]);

  return { studyGroups, pagination: buildPagination(total, page, limit) };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getStudyGroupService = async (id: string) => {
  await findOrThrow(id);

  return prisma.studyGroup.findUnique({
    where: { id },
    select: {
      ...studyGroupSelect,
      _count: { select: { teachingAssignments: true, tuitionFees: true } },
    },
  });
};

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createStudyGroupService = async (body: CreateStudyGroupInput) => {
  await ensureLevelExists(body.levelId);
  await ensureUniqueName(body.levelId, body.name);

  return prisma.studyGroup.create({
    data: {
      levelId: body.levelId,
      name: body.name,
      type: body.type ?? "NORMAL",
      maxStudents: body.maxStudents ?? null,
      isActive: body.isActive ?? true,
    },
    select: studyGroupSelect,
  });
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateStudyGroupService = async (
  id: string,
  body: UpdateStudyGroupInput,
) => {
  const existing = await findOrThrow(id);

  if (body.levelId) {
    await ensureLevelExists(body.levelId);
  }

  const targetLevelId = body.levelId ?? existing.levelId;

  if (body.name || body.levelId) {
    await ensureUniqueName(targetLevelId, body.name ?? existing.name, id);
  }

  return prisma.studyGroup.update({
    where: { id },
    data: {
      ...(body.levelId !== undefined && { levelId: body.levelId }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.maxStudents !== undefined && { maxStudents: body.maxStudents }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    select: studyGroupSelect,
  });
};

// --------------------------------------------------
// Delete
// --------------------------------------------------

export const deleteStudyGroupService = async (id: string) => {
  await findOrThrow(id);

  const relations = await prisma.studyGroup.findUnique({
    where: { id },
    select: {
      _count: { select: { teachingAssignments: true, tuitionFees: true } },
    },
  });

  const assignments = relations?._count.teachingAssignments ?? 0;
  const fees = relations?._count.tuitionFees ?? 0;

  if (assignments > 0 || fees > 0) {
    throw new ConflictException(
      `Cannot delete: study group is linked to ${assignments} teaching assignment(s) ` +
        `and ${fees} tuition fee(s). Deactivate it instead.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  await prisma.studyGroup.delete({ where: { id } });
};
