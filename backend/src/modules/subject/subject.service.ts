import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import {
  CreateSubjectInput,
  UpdateSubjectInput,
  SubjectQueryInput,
} from "./subject.schema";

// --------------------------------------------------
// Select موحّد — نفس الحقول في كل الردود
// --------------------------------------------------

const subjectSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  color: true,
  imagePath: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findSubjectOrThrow = async (id: string) => {
  const subject = await prisma.subject.findUnique({
    where: { id },
    select: subjectSelect,
  });

  if (!subject) {
    throw new NotFoundException(
      "Subject not found",
      ErrorCodeEnum.SUBJECT_NOT_FOUND,
    );
  }

  return subject;
};

/**
 * يتحقق من عدم تكرار الاسم أو الرمز.
 * excludeId يُستعمل عند التعديل لتجاهل السجل نفسه.
 */
const ensureUnique = async (
  data: { name?: string; code?: string | null },
  excludeId?: string,
) => {
  const conditions: Prisma.SubjectWhereInput[] = [];

  if (data.name) {
    conditions.push({ name: data.name });
  }

  if (data.code) {
    conditions.push({ code: data.code });
  }

  if (conditions.length === 0) return;

  const duplicate = await prisma.subject.findFirst({
    where: {
      OR: conditions,
      ...(excludeId && { NOT: { id: excludeId } }),
    },
    select: { name: true, code: true },
  });

  if (!duplicate) return;

  const field = data.name && duplicate.name === data.name ? "name" : "code";

  throw new ConflictException(
    `A subject with this ${field} already exists`,
    ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
  );
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listSubjectsService = async (query: SubjectQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  // ترتيب الأعمدة في MySQL غير حسّاس لحالة الأحرف (utf8mb4_unicode_ci)
  // لذلك لا حاجة لـ mode: "insensitive" — وهو غير مدعوم أصلاً على MySQL
  const where: Prisma.SubjectWhereInput = {
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.search && {
      OR: [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ],
    }),
  };

  const [subjects, total] = await Promise.all([
    prisma.subject.findMany({
      where,
      select: subjectSelect,
      skip,
      take,
      orderBy: { name: "asc" },
    }),
    prisma.subject.count({ where }),
  ]);

  return { subjects, pagination: buildPagination(total, page, limit) };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getSubjectService = async (id: string) => {
  await findSubjectOrThrow(id);

  const subject = await prisma.subject.findUnique({
    where: { id },
    select: {
      ...subjectSelect,
      _count: {
        select: {
          teachingAssignments: true,
          tuitionFees: true,
        },
      },
    },
  });

  return subject;
};

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createSubjectService = async (body: CreateSubjectInput) => {
  await ensureUnique({ name: body.name, code: body.code });

  return prisma.subject.create({
    data: {
      name: body.name,
      code: body.code ?? null,
      description: body.description ?? null,
      color: body.color ?? null,
      imagePath: body.imagePath ?? null,
      isActive: body.isActive ?? true,
    },
    select: subjectSelect,
  });
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateSubjectService = async (
  id: string,
  body: UpdateSubjectInput,
) => {
  await findSubjectOrThrow(id);
  await ensureUnique({ name: body.name, code: body.code }, id);

  // نمرّر الحقول المُرسلة فقط — undefined يعني "لا تغيّر"
  return prisma.subject.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.code !== undefined && { code: body.code }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.imagePath !== undefined && { imagePath: body.imagePath }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    select: subjectSelect,
  });
};

// --------------------------------------------------
// Delete
//
// المادة مرتبطة بـ TeachingAssignment و TuitionFee بدون onDelete،
// فالحذف مع وجود ارتباطات يفشل على مستوى قاعدة البيانات.
// نمنعه مسبقاً برسالة واضحة ونقترح التعطيل بدل الحذف.
// --------------------------------------------------

export const deleteSubjectService = async (id: string) => {
  await findSubjectOrThrow(id);

  const relations = await prisma.subject.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          teachingAssignments: true,
          tuitionFees: true,
        },
      },
    },
  });

  const assignments = relations?._count.teachingAssignments ?? 0;
  const fees = relations?._count.tuitionFees ?? 0;

  if (assignments > 0 || fees > 0) {
    throw new ConflictException(
      `Cannot delete: subject is linked to ${assignments} teaching assignment(s) ` +
        `and ${fees} tuition fee(s). Deactivate it instead.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  await prisma.subject.delete({ where: { id } });
};
