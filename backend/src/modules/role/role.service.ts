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
  CreateRoleInput,
  UpdateRoleInput,
  SetRolePermissionsInput,
  RoleQueryInput,
  PermissionQueryInput,
} from "./role.schema";

const roleSelect = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
} as const;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const role = await prisma.role.findUnique({
    where: { id },
    select: { id: true, name: true, isSystem: true },
  });

  if (!role) {
    throw new NotFoundException(
      "Role not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  return role;
};

const ensureUniqueName = async (name: string, excludeId?: string) => {
  const duplicate = await prisma.role.findFirst({
    where: { name, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConflictException(
      "A role with this name already exists",
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }
};

const ensurePermissionsExist = async (permissionIds: string[]) => {
  if (permissionIds.length === 0) return;

  const found = await prisma.permission.findMany({
    where: { id: { in: permissionIds } },
    select: { id: true },
  });

  if (found.length !== permissionIds.length) {
    const ids = new Set(found.map((p) => p.id));
    const missing = permissionIds.filter((id) => !ids.has(id));

    throw new NotFoundException(
      `Permission(s) not found: ${missing.join(", ")}`,
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }
};

// --------------------------------------------------
// Permissions catalogue
// تحتاجه الواجهة لبناء شاشة تعيين الصلاحيات
// --------------------------------------------------

export const listPermissionsService = async (query: PermissionQueryInput) => {
  const permissions = await prisma.permission.findMany({
    where: {
      ...(query.module && { module: query.module }),
      ...(query.search && { name: { contains: query.search } }),
    },
    select: { id: true, name: true, module: true, description: true },
    orderBy: [{ module: "asc" }, { name: "asc" }],
  });

  // مجمَّعة حسب الموديول لتسهيل العرض
  const byModule = permissions.reduce<Record<string, typeof permissions>>(
    (groups, permission) => {
      (groups[permission.module] ??= []).push(permission);
      return groups;
    },
    {},
  );

  return { permissions, byModule, total: permissions.length };
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listRolesService = async (query: RoleQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const where: Prisma.RoleWhereInput = {
    ...(query.search && { name: { contains: query.search } }),
  };

  const [roles, total] = await Promise.all([
    prisma.role.findMany({
      where,
      select: {
        ...roleSelect,
        _count: { select: { users: true, permissions: true } },
      },
      skip,
      take,
      orderBy: { name: "asc" },
    }),
    prisma.role.count({ where }),
  ]);

  return { roles, pagination: buildPagination(total, page, limit) };
};

// --------------------------------------------------
// Get by id — مع الصلاحيات مسطَّحة
// --------------------------------------------------

export const getRoleService = async (id: string) => {
  await findOrThrow(id);

  const role = await prisma.role.findUnique({
    where: { id },
    select: {
      ...roleSelect,
      permissions: {
        select: {
          permission: {
            select: { id: true, name: true, module: true, description: true },
          },
        },
      },
      _count: { select: { users: true } },
    },
  });

  if (!role) return null;

  const { permissions, ...rest } = role;

  return {
    ...rest,
    permissions: permissions
      .map((rp) => rp.permission)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
};

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createRoleService = async (body: CreateRoleInput) => {
  await ensureUniqueName(body.name);

  const permissionIds = [...new Set(body.permissionIds ?? [])];

  await ensurePermissionsExist(permissionIds);

  const role = await prisma.$transaction(async (tx) => {
    const created = await tx.role.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        // الأدوار المُنشأة عبر الـ API ليست أدوار نظام
        isSystem: false,
      },
      select: roleSelect,
    });

    if (permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: created.id,
          permissionId,
        })),
      });
    }

    return created;
  });

  return getRoleService(role.id);
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateRoleService = async (
  id: string,
  body: UpdateRoleInput,
) => {
  const existing = await findOrThrow(id);

  // إعادة تسمية دور نظام تكسر الـ seeder والفحوص المعتمدة على الاسم
  if (existing.isSystem && body.name && body.name !== existing.name) {
    throw new ConflictException(
      `Cannot rename the system role '${existing.name}'`,
      ErrorCodeEnum.ACCESS_FORBIDDEN,
    );
  }

  if (body.name) {
    await ensureUniqueName(body.name, id);
  }

  await prisma.role.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
    },
  });

  return getRoleService(id);
};

// --------------------------------------------------
// Set permissions — استبدال المجموعة كاملة
// --------------------------------------------------

export const setRolePermissionsService = async (
  id: string,
  body: SetRolePermissionsInput,
) => {
  const role = await findOrThrow(id);

  await ensurePermissionsExist(body.permissionIds);

  // ADMIN بلا صلاحيات يعني نظاماً بلا مدير
  if (role.name === "ADMIN" && body.permissionIds.length === 0) {
    throw new BadRequestException(
      "The ADMIN role cannot be left without permissions",
      ErrorCodeEnum.ACCESS_FORBIDDEN,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({
      where: { roleId: id, permissionId: { notIn: body.permissionIds } },
    });

    if (body.permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: body.permissionIds.map((permissionId) => ({
          roleId: id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }
  });

  return getRoleService(id);
};

// --------------------------------------------------
// Delete
// --------------------------------------------------

export const deleteRoleService = async (id: string) => {
  const role = await findOrThrow(id);

  if (role.isSystem) {
    throw new ConflictException(
      `Cannot delete the system role '${role.name}'`,
      ErrorCodeEnum.ACCESS_FORBIDDEN,
    );
  }

  const users = await prisma.user.count({ where: { roleId: id } });

  if (users > 0) {
    throw new ConflictException(
      `Cannot delete: ${users} user(s) are assigned to this role. ` +
        `Move them to another role first.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    await tx.role.delete({ where: { id } });
  });
};
