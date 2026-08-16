import bcrypt from "bcryptjs";
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
  CreateUserInput,
  UpdateUserInput,
  UserQueryInput,
} from "./user.schema";

// كلمة المرور لا تُختار أبداً — لا تخرج من هذه الطبقة
const userSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  avatar: true,
  gender: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roleId: true,
  role: { select: { id: true, name: true, description: true } },
} as const;

const BCRYPT_ROUNDS = 12;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, roleId: true, role: { select: { name: true } } },
  });

  if (!user) {
    throw new NotFoundException(
      "User not found",
      ErrorCodeEnum.AUTH_USER_NOT_FOUND,
    );
  }

  return user;
};

const ensureUnique = async (
  data: { username?: string; email?: string | null },
  excludeId?: string,
) => {
  const conditions: Prisma.UserWhereInput[] = [];

  if (data.username) conditions.push({ username: data.username });
  if (data.email) conditions.push({ email: data.email });

  if (conditions.length === 0) return;

  const duplicate = await prisma.user.findFirst({
    where: {
      OR: conditions,
      ...(excludeId && { NOT: { id: excludeId } }),
    },
    select: { username: true, email: true },
  });

  if (!duplicate) return;

  const field =
    data.username && duplicate.username === data.username
      ? "username"
      : "email";

  throw new ConflictException(
    `A user with this ${field} already exists`,
    ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
  );
};

const ensureRoleExists = async (roleId: string) => {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true },
  });

  if (!role) {
    throw new NotFoundException(
      "Role not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }
};

/**
 * يمنع فقدان آخر مدير نشط — وإلا أُقفل النظام
 * ولم يبقَ من يملك صلاحية إعادة الفتح.
 */
const ensureNotLastActiveAdmin = async (userId: string, action: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, role: { select: { name: true } } },
  });

  if (!user || user.role.name !== "ADMIN" || !user.isActive) return;

  const activeAdmins = await prisma.user.count({
    where: { isActive: true, role: { name: "ADMIN" } },
  });

  if (activeAdmins <= 1) {
    throw new ConflictException(
      `Cannot ${action}: this is the last active administrator`,
      ErrorCodeEnum.ACCESS_FORBIDDEN,
    );
  }
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listUsersService = async (query: UserQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const where: Prisma.UserWhereInput = {
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.roleId && { roleId: query.roleId }),
    ...(query.search && {
      OR: [
        { username: { contains: query.search } },
        { firstName: { contains: query.search } },
        { lastName: { contains: query.search } },
        { email: { contains: query.search } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      skip,
      take,
      orderBy: { username: "asc" },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, pagination: buildPagination(total, page, limit) };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getUserService = async (id: string) => {
  await findOrThrow(id);

  return prisma.user.findUnique({
    where: { id },
    select: {
      ...userSelect,
      _count: {
        select: { invoices: true, payments: true, receipts: true },
      },
    },
  });
};

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createUserService = async (body: CreateUserInput) => {
  await ensureUnique({ username: body.username, email: body.email });
  await ensureRoleExists(body.roleId);

  return prisma.user.create({
    data: {
      username: body.username,
      password: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email ?? null,
      phone: body.phone ?? null,
      avatar: body.avatar ?? null,
      gender: body.gender,
      roleId: body.roleId,
      isActive: body.isActive ?? true,
    },
    select: userSelect,
  });
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateUserService = async (
  id: string,
  body: UpdateUserInput,
  actingUserId: string,
) => {
  await findOrThrow(id);

  await ensureUnique({ username: body.username, email: body.email }, id);

  if (body.roleId) {
    await ensureRoleExists(body.roleId);
  }

  // تعطيل آخر مدير أو نزع دوره يُقفل النظام
  if (body.isActive === false) {
    await ensureNotLastActiveAdmin(id, "deactivate");
  }

  if (body.roleId) {
    const current = await prisma.user.findUnique({
      where: { id },
      select: { roleId: true },
    });

    if (current && current.roleId !== body.roleId) {
      await ensureNotLastActiveAdmin(id, "change the role of");
    }
  }

  // منع المستخدم من تعطيل نفسه بالخطأ
  if (id === actingUserId && body.isActive === false) {
    throw new BadRequestException(
      "You cannot deactivate your own account",
      ErrorCodeEnum.ACCESS_FORBIDDEN,
    );
  }

  return prisma.user.update({
    where: { id },
    data: {
      ...(body.username !== undefined && { username: body.username }),
      ...(body.password !== undefined && {
        password: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
      }),
      ...(body.firstName !== undefined && { firstName: body.firstName }),
      ...(body.lastName !== undefined && { lastName: body.lastName }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.avatar !== undefined && { avatar: body.avatar }),
      ...(body.gender !== undefined && { gender: body.gender }),
      ...(body.roleId !== undefined && { roleId: body.roleId }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    select: userSelect,
  });
};

// --------------------------------------------------
// Delete
//
// المستخدم مرتبط بفواتير ودفعات وإيصالات بلا onDelete،
// فالحذف مع وجود سجلات مالية يفشل على مستوى قاعدة
// البيانات — نمنعه مسبقاً ونقترح التعطيل.
// --------------------------------------------------

export const deleteUserService = async (id: string, actingUserId: string) => {
  await findOrThrow(id);

  if (id === actingUserId) {
    throw new BadRequestException(
      "You cannot delete your own account",
      ErrorCodeEnum.ACCESS_FORBIDDEN,
    );
  }

  await ensureNotLastActiveAdmin(id, "delete");

  const relations = await prisma.user.findUnique({
    where: { id },
    select: {
      _count: { select: { invoices: true, payments: true, receipts: true } },
    },
  });

  const invoices = relations?._count.invoices ?? 0;
  const payments = relations?._count.payments ?? 0;
  const receipts = relations?._count.receipts ?? 0;

  if (invoices > 0 || payments > 0 || receipts > 0) {
    throw new ConflictException(
      `Cannot delete: user is linked to ${invoices} invoice(s), ` +
        `${payments} payment(s) and ${receipts} receipt(s). ` +
        `Deactivate the account instead.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  await prisma.user.delete({ where: { id } });
};
