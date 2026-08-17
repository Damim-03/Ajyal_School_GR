import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import {
  CreateEducationStageInput,
  UpdateEducationStageInput,
  EducationStageQueryInput,
} from "./education-stage.schema";

const educationStageSelect = {
  id: true,
  name: true,
  type: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const stage = await prisma.educationStage.findUnique({
    where: { id },
    select: educationStageSelect,
  });

  if (!stage) {
    throw new NotFoundException(
      "Education stage not found",
      ErrorCodeEnum.EDUCATION_STAGE_NOT_FOUND,
    );
  }

  return stage;
};

const ensureUniqueName = async (name: string, excludeId?: string) => {
  const duplicate = await prisma.educationStage.findFirst({
    where: { name, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictException(
      "An education stage with this name already exists",
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }
};

/** آخر ترتيب + 1 — يُستعمل حين لا تُرسل sortOrder */
const nextSortOrder = async (): Promise<number> => {
  const last = await prisma.educationStage.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return (last?.sortOrder ?? -1) + 1;
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listEducationStagesService = async (
  query: EducationStageQueryInput,
) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const where: Prisma.EducationStageWhereInput = {
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.type && { type: query.type }),
    ...(query.search && { name: { contains: query.search } }),
  };

  const [educationStages, total] = await Promise.all([
    prisma.educationStage.findMany({
      where,
      select: {
        ...educationStageSelect,
        _count: { select: { levels: true } },
      },
      skip,
      take,
      orderBy: { sortOrder: "asc" },
    }),
    prisma.educationStage.count({ where }),
  ]);

  return { educationStages, pagination: buildPagination(total, page, limit) };
};

// --------------------------------------------------
// Get by id — مع المستويات التابعة
// --------------------------------------------------

export const getEducationStageService = async (id: string) => {
  await findOrThrow(id);

  return prisma.educationStage.findUnique({
    where: { id },
    select: {
      ...educationStageSelect,
      levels: {
        select: { id: true, name: true, sortOrder: true, isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { levels: true } },
    },
  });
};

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createEducationStageService = async (
  body: CreateEducationStageInput,
) => {
  await ensureUniqueName(body.name);

  return prisma.educationStage.create({
    data: {
      name: body.name,
      type: body.type,
      sortOrder: body.sortOrder ?? (await nextSortOrder()),
      isActive: body.isActive ?? true,
    },
    select: educationStageSelect,
  });
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateEducationStageService = async (
  id: string,
  body: UpdateEducationStageInput,
) => {
  await findOrThrow(id);

  if (body.name) {
    await ensureUniqueName(body.name, id);
  }

  return prisma.educationStage.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    select: educationStageSelect,
  });
};

// --------------------------------------------------
// Delete — ممنوع إن كانت تحتوي مستويات
// --------------------------------------------------

export const deleteEducationStageService = async (id: string) => {
  await findOrThrow(id);

  const levels = await prisma.level.count({ where: { educationStageId: id } });

  if (levels > 0) {
    throw new ConflictException(
      `Cannot delete: education stage contains ${levels} level(s). ` +
        `Delete them first or deactivate the stage instead.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  await prisma.educationStage.delete({ where: { id } });
};
