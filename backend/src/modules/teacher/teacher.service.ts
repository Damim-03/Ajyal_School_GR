import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import {
  CreateTeacherInput,
  UpdateTeacherInput,
  TeacherQueryInput,
} from "./teacher.schema";

// --------------------------------------------------
// Selects
//
// الراتب بيانات حسّاسة — نستثنيه من القائمة ونُظهره
// في التفصيل فقط. لتوسيع ذلك أضف صلاحية مستقلة.
// --------------------------------------------------

const teacherListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  gender: true,
  /* الصورة في القائمة أيضاً — الصفُّ يُعرف بوجهه قبل سطره */
  avatar: true,
  birthDate: true,
  hireDate: true,
  specialization: true,
  qualification: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const teacherDetailSelect = {
  ...teacherListSelect,
  address: true,
  salary: true,
} as const;

type RawTeacher = { salary?: Prisma.Decimal | null; [key: string]: unknown };

/** Decimal → number (أو null) قبل الإرسال */
const toResponse = <T extends RawTeacher>(teacher: T) => ({
  ...teacher,
  ...(teacher.salary !== undefined && {
    salary: teacher.salary === null ? null : Number(teacher.salary),
  }),
});

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!teacher) {
    throw new NotFoundException(
      "Teacher not found",
      ErrorCodeEnum.TEACHER_NOT_FOUND,
    );
  }

  return teacher;
};

const ensureUniqueEmail = async (email: string, excludeId?: string) => {
  const duplicate = await prisma.teacher.findFirst({
    where: { email, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictException(
      "A teacher with this email already exists",
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listTeachersService = async (query: TeacherQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const where: Prisma.TeacherWhereInput = {
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.gender && { gender: query.gender }),
    ...(query.specialization && {
      specialization: { contains: query.specialization },
    }),
    ...(query.search && {
      OR: [
        { firstName: { contains: query.search } },
        { lastName: { contains: query.search } },
        { email: { contains: query.search } },
        { phone: { contains: query.search } },
      ],
    }),
  };

  const [teachers, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      select: {
        ...teacherListSelect,
        _count: { select: { teachingAssignments: true } },
      },
      skip,
      take,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.teacher.count({ where }),
  ]);

  return { teachers, pagination: buildPagination(total, page, limit) };
};

// --------------------------------------------------
// Get by id — مع الإسنادات التدريسية
// --------------------------------------------------

export const getTeacherService = async (id: string) => {
  await findOrThrow(id);

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: {
      ...teacherDetailSelect,
      teachingAssignments: {
        select: {
          id: true,
          isActive: true,
          subject: { select: { id: true, name: true } },
          studyGroup: {
            select: {
              id: true,
              name: true,
              level: { select: { id: true, name: true } },
            },
          },
          academicYear: { select: { id: true, name: true, isCurrent: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { teachingAssignments: true } },
    },
  });

  return teacher ? toResponse(teacher) : null;
};

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createTeacherService = async (body: CreateTeacherInput) => {
  if (body.email) {
    await ensureUniqueEmail(body.email);
  }

  const teacher = await prisma.teacher.create({
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email ?? null,
      phone: body.phone ?? null,
      gender: body.gender,
      avatar: body.avatar ?? null,
      birthDate: body.birthDate ?? null,
      hireDate: body.hireDate,
      address: body.address ?? null,
      qualification: body.qualification ?? null,
      specialization: body.specialization ?? null,
      salary:
        body.salary === null || body.salary === undefined
          ? null
          : new Prisma.Decimal(body.salary),
      isActive: body.isActive ?? true,
    },
    select: teacherDetailSelect,
  });

  return toResponse(teacher);
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateTeacherService = async (
  id: string,
  body: UpdateTeacherInput,
) => {
  await findOrThrow(id);

  if (body.email) {
    await ensureUniqueEmail(body.email, id);
  }

  const teacher = await prisma.teacher.update({
    where: { id },
    data: {
      ...(body.firstName !== undefined && { firstName: body.firstName }),
      ...(body.lastName !== undefined && { lastName: body.lastName }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.gender !== undefined && { gender: body.gender }),
      ...(body.avatar !== undefined && { avatar: body.avatar }),
      ...(body.birthDate !== undefined && { birthDate: body.birthDate }),
      ...(body.hireDate !== undefined && { hireDate: body.hireDate }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.qualification !== undefined && {
        qualification: body.qualification,
      }),
      ...(body.specialization !== undefined && {
        specialization: body.specialization,
      }),
      ...(body.salary !== undefined && {
        salary: body.salary === null ? null : new Prisma.Decimal(body.salary),
      }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    select: teacherDetailSelect,
  });

  return toResponse(teacher);
};

// --------------------------------------------------
// Delete — ممنوع إن كان له إسنادات تدريسية
// --------------------------------------------------

export const deleteTeacherService = async (id: string) => {
  await findOrThrow(id);

  const assignments = await prisma.teachingAssignment.count({
    where: { teacherId: id },
  });

  if (assignments > 0) {
    throw new ConflictException(
      `Cannot delete: teacher has ${assignments} teaching assignment(s). ` +
        `Deactivate the teacher instead.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  /*
   * الوثائق تُحذف معه لا قبله بيدِ المستخدم.
   *
   * صفوفُها تشير إليه بمفتاحٍ أجنبي، فحذفُه دونها يفشل برسالةِ قاعدةِ
   * بيانات لا يفهمها من يقرؤها. ولا معنى لوثيقةِ توظيفٍ لأستاذٍ مُحيت
   * سطورُه — أمّا صورُها على القرص فتبقى، وتنظيفُها شأنُ الصيانة.
   */
  await prisma.$transaction([
    prisma.teacherDocument.deleteMany({ where: { teacherId: id } }),
    prisma.teacher.delete({ where: { id } }),
  ]);
};
