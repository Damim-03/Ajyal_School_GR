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
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
  AcademicYearQueryInput,
} from "./academic-year.schema";

const academicYearSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  isCurrent: true,
  isActive: true,
  sessionsPerMonth: true,
  createdAt: true,
  updatedAt: true,
} as const;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const academicYear = await prisma.academicYear.findUnique({
    where: { id },
    select: academicYearSelect,
  });

  if (!academicYear) {
    throw new NotFoundException(
      "Academic year not found",
      ErrorCodeEnum.ACADEMIC_YEAR_NOT_FOUND,
    );
  }

  return academicYear;
};

const ensureUniqueName = async (name: string, excludeId?: string) => {
  const duplicate = await prisma.academicYear.findFirst({
    where: {
      name,
      ...(excludeId && { NOT: { id: excludeId } }),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictException(
      "An academic year with this name already exists",
      ErrorCodeEnum.ACADEMIC_YEAR_ALREADY_EXISTS,
    );
  }
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listAcademicYearsService = async (
  query: AcademicYearQueryInput,
) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const where: Prisma.AcademicYearWhereInput = {
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.isCurrent !== undefined && { isCurrent: query.isCurrent }),
    ...(query.search && { name: { contains: query.search } }),
  };

  const [academicYears, total] = await Promise.all([
    prisma.academicYear.findMany({
      where,
      select: academicYearSelect,
      skip,
      take,
      orderBy: { startDate: "desc" },
    }),
    prisma.academicYear.count({ where }),
  ]);

  return { academicYears, pagination: buildPagination(total, page, limit) };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getAcademicYearService = async (id: string) => {
  await findOrThrow(id);

  return prisma.academicYear.findUnique({
    where: { id },
    select: {
      ...academicYearSelect,
      _count: {
        select: {
          teachingAssignments: true,
          invoices: true,
        },
      },
    },
  });
};

// --------------------------------------------------
// Create
//
// isCurrent = true → ننزع العلم عن الباقي داخل transaction
// --------------------------------------------------

export const createAcademicYearService = async (
  body: CreateAcademicYearInput,
) => {
  await ensureUniqueName(body.name);

  return prisma.$transaction(async (tx) => {
    if (body.isCurrent) {
      await tx.academicYear.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return tx.academicYear.create({
      data: {
        name: body.name,
        startDate: body.startDate,
        endDate: body.endDate,
        isCurrent: body.isCurrent ?? false,
        isActive: body.isActive ?? true,
        ...(body.sessionsPerMonth !== undefined && {
          sessionsPerMonth: body.sessionsPerMonth,
        }),
      },
      select: academicYearSelect,
    });
  });
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateAcademicYearService = async (
  id: string,
  body: UpdateAcademicYearInput,
) => {
  const existing = await findOrThrow(id);

  if (body.name) {
    await ensureUniqueName(body.name, id);
  }

  // نقارن التاريخ المُرسل بالمخزَّن عند إرسال أحدهما فقط
  const startDate = body.startDate ?? existing.startDate;
  const endDate = body.endDate ?? existing.endDate;

  if (endDate <= startDate) {
    throw new BadRequestException(
      "End date must be after start date",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  return prisma.$transaction(async (tx) => {
    if (body.isCurrent === true) {
      await tx.academicYear.updateMany({
        where: { isCurrent: true, NOT: { id } },
        data: { isCurrent: false },
      });
    }

    return tx.academicYear.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.startDate !== undefined && { startDate: body.startDate }),
        ...(body.endDate !== undefined && { endDate: body.endDate }),
        ...(body.isCurrent !== undefined && { isCurrent: body.isCurrent }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.sessionsPerMonth !== undefined && {
          sessionsPerMonth: body.sessionsPerMonth,
        }),
      },
      select: academicYearSelect,
    });
  });
};

// --------------------------------------------------
// Delete
// --------------------------------------------------

export const deleteAcademicYearService = async (id: string) => {
  await findOrThrow(id);

  const relations = await prisma.academicYear.findUnique({
    where: { id },
    select: {
      _count: {
        select: { teachingAssignments: true, invoices: true },
      },
    },
  });

  const assignments = relations?._count.teachingAssignments ?? 0;
  const invoices = relations?._count.invoices ?? 0;

  if (assignments > 0 || invoices > 0) {
    throw new ConflictException(
      `Cannot delete: academic year is linked to ${assignments} teaching assignment(s) ` +
        `and ${invoices} invoice(s). Deactivate it instead.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  await prisma.academicYear.delete({ where: { id } });
};
