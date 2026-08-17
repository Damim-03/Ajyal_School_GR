import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import {
  CreateLevelInput,
  UpdateLevelInput,
  LevelQueryInput,
} from "./level.schema";

const levelSelect = {
  id: true,
  educationStageId: true,
  name: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  educationStage: {
    select: { id: true, name: true, type: true },
  },
} as const;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const level = await prisma.level.findUnique({
    where: { id },
    select: levelSelect,
  });

  if (!level) {
    throw new NotFoundException("Level not found", ErrorCodeEnum.LEVEL_NOT_FOUND);
  }

  return level;
};

const ensureStageExists = async (educationStageId: string) => {
  const stage = await prisma.educationStage.findUnique({
    where: { id: educationStageId },
    select: { id: true },
  });

  if (!stage) {
    throw new NotFoundException(
      "Education stage not found",
      ErrorCodeEnum.EDUCATION_STAGE_NOT_FOUND,
    );
  }
};

/** الاسم فريد داخل الطور الواحد — @@unique([educationStageId, name]) */
const ensureUniqueName = async (
  educationStageId: string,
  name: string,
  excludeId?: string,
) => {
  const duplicate = await prisma.level.findFirst({
    where: {
      educationStageId,
      name,
      ...(excludeId && { NOT: { id: excludeId } }),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictException(
      "A level with this name already exists in this education stage",
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }
};

const nextSortOrder = async (educationStageId: string): Promise<number> => {
  const last = await prisma.level.findFirst({
    where: { educationStageId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return (last?.sortOrder ?? -1) + 1;
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listLevelsService = async (query: LevelQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const where: Prisma.LevelWhereInput = {
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.educationStageId && {
      educationStageId: query.educationStageId,
    }),
    ...(query.search && { name: { contains: query.search } }),
  };

  const [levels, total] = await Promise.all([
    prisma.level.findMany({
      where,
      select: {
        ...levelSelect,
        _count: { select: { studyGroups: true } },
      },
      skip,
      take,
      orderBy: [
        { educationStage: { sortOrder: "asc" } },
        { sortOrder: "asc" },
      ],
    }),
    prisma.level.count({ where }),
  ]);

  return { levels, pagination: buildPagination(total, page, limit) };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getLevelService = async (id: string) => {
  await findOrThrow(id);

  return prisma.level.findUnique({
    where: { id },
    select: {
      ...levelSelect,
      studyGroups: {
        select: { id: true, name: true, type: true, isActive: true },
        orderBy: { name: "asc" },
      },
      _count: { select: { studyGroups: true } },
    },
  });
};

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createLevelService = async (body: CreateLevelInput) => {
  await ensureStageExists(body.educationStageId);
  await ensureUniqueName(body.educationStageId, body.name);

  return prisma.level.create({
    data: {
      educationStageId: body.educationStageId,
      name: body.name,
      sortOrder: body.sortOrder ?? (await nextSortOrder(body.educationStageId)),
      isActive: body.isActive ?? true,
    },
    select: levelSelect,
  });
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateLevelService = async (
  id: string,
  body: UpdateLevelInput,
) => {
  const existing = await findOrThrow(id);

  if (body.educationStageId) {
    await ensureStageExists(body.educationStageId);
  }

  // الطور المستهدف بعد التعديل — لفحص تفرّد الاسم داخله
  const targetStageId = body.educationStageId ?? existing.educationStageId;

  if (body.name || body.educationStageId) {
    await ensureUniqueName(targetStageId, body.name ?? existing.name, id);
  }

  return prisma.level.update({
    where: { id },
    data: {
      ...(body.educationStageId !== undefined && {
        educationStageId: body.educationStageId,
      }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    select: levelSelect,
  });
};

// --------------------------------------------------
// Delete — ممنوع إن كان يحتوي أفواجاً
// --------------------------------------------------

export const deleteLevelService = async (id: string) => {
  await findOrThrow(id);

  const studyGroups = await prisma.studyGroup.count({ where: { levelId: id } });

  if (studyGroups > 0) {
    throw new ConflictException(
      `Cannot delete: level contains ${studyGroups} study group(s). ` +
        `Delete them first or deactivate the level instead.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  await prisma.level.delete({ where: { id } });
};
