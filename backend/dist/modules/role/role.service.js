"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRoleService = exports.setRolePermissionsService = exports.updateRoleService = exports.createRoleService = exports.getRoleService = exports.listRolesService = exports.listPermissionsService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const text_match_1 = require("../../core/search/text-match");
const roleSelect = {
    id: true,
    name: true,
    description: true,
    isSystem: true,
    createdAt: true,
    updatedAt: true,
};
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const role = await client_1.prisma.role.findUnique({
        where: { id },
        select: { id: true, name: true, isSystem: true },
    });
    if (!role) {
        throw new app_errors_1.NotFoundException("Role not found", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    return role;
};
const ensureUniqueName = async (name, excludeId) => {
    const duplicate = await client_1.prisma.role.findFirst({
        where: { name, ...(excludeId && { NOT: { id: excludeId } }) },
        select: { id: true },
    });
    if (duplicate) {
        throw new app_errors_1.ConflictException("A role with this name already exists", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
};
const ensurePermissionsExist = async (permissionIds) => {
    if (permissionIds.length === 0)
        return;
    const found = await client_1.prisma.permission.findMany({
        where: { id: { in: permissionIds } },
        select: { id: true },
    });
    if (found.length !== permissionIds.length) {
        const ids = new Set(found.map((p) => p.id));
        const missing = permissionIds.filter((id) => !ids.has(id));
        throw new app_errors_1.NotFoundException(`Permission(s) not found: ${missing.join(", ")}`, error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
};
// --------------------------------------------------
// Permissions catalogue
// تحتاجه الواجهة لبناء شاشة تعيين الصلاحيات
// --------------------------------------------------
const listPermissionsService = async (query) => {
    /* مطابقةٌ بترتيبٍ صريح — انظر `core/search/text-match` */
    const searchIds = query.search
        ? await (0, text_match_1.matchTextIds)("Permission", [(0, text_match_1.containsOn)(["name"], query.search)])
        : null;
    const permissions = await client_1.prisma.permission.findMany({
        where: {
            ...(query.module && { module: query.module }),
            ...(searchIds && { id: { in: searchIds } }),
        },
        select: { id: true, name: true, module: true, description: true },
        orderBy: [{ module: "asc" }, { name: "asc" }],
    });
    // مجمَّعة حسب الموديول لتسهيل العرض
    const byModule = permissions.reduce((groups, permission) => {
        var _a;
        (groups[_a = permission.module] ?? (groups[_a] = [])).push(permission);
        return groups;
    }, {});
    return { permissions, byModule, total: permissions.length };
};
exports.listPermissionsService = listPermissionsService;
// --------------------------------------------------
// List
// --------------------------------------------------
const listRolesService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const roleIds = query.search
        ? await (0, text_match_1.matchTextIds)("Role", [(0, text_match_1.containsOn)(["name"], query.search)])
        : null;
    const where = {
        ...(roleIds && { id: { in: roleIds } }),
    };
    const [roles, total] = await Promise.all([
        client_1.prisma.role.findMany({
            where,
            select: {
                ...roleSelect,
                _count: { select: { users: true, permissions: true } },
            },
            skip,
            take,
            orderBy: { name: "asc" },
        }),
        client_1.prisma.role.count({ where }),
    ]);
    return { roles, pagination: (0, api_response_1.buildPagination)(total, page, limit) };
};
exports.listRolesService = listRolesService;
// --------------------------------------------------
// Get by id — مع الصلاحيات مسطَّحة
// --------------------------------------------------
const getRoleService = async (id) => {
    await findOrThrow(id);
    const role = await client_1.prisma.role.findUnique({
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
    if (!role)
        return null;
    const { permissions, ...rest } = role;
    return {
        ...rest,
        permissions: permissions
            .map((rp) => rp.permission)
            .sort((a, b) => a.name.localeCompare(b.name)),
    };
};
exports.getRoleService = getRoleService;
// --------------------------------------------------
// Create
// --------------------------------------------------
const createRoleService = async (body) => {
    await ensureUniqueName(body.name);
    const permissionIds = [...new Set(body.permissionIds ?? [])];
    await ensurePermissionsExist(permissionIds);
    const role = await client_1.prisma.$transaction(async (tx) => {
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
    return (0, exports.getRoleService)(role.id);
};
exports.createRoleService = createRoleService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateRoleService = async (id, body) => {
    const existing = await findOrThrow(id);
    // إعادة تسمية دور نظام تكسر الـ seeder والفحوص المعتمدة على الاسم
    if (existing.isSystem && body.name && body.name !== existing.name) {
        throw new app_errors_1.ConflictException(`Cannot rename the system role '${existing.name}'`, error_code_enum_1.ErrorCodeEnum.ACCESS_FORBIDDEN);
    }
    if (body.name) {
        await ensureUniqueName(body.name, id);
    }
    await client_1.prisma.role.update({
        where: { id },
        data: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.description !== undefined && { description: body.description }),
        },
    });
    return (0, exports.getRoleService)(id);
};
exports.updateRoleService = updateRoleService;
// --------------------------------------------------
// Set permissions — استبدال المجموعة كاملة
// --------------------------------------------------
const setRolePermissionsService = async (id, body) => {
    const role = await findOrThrow(id);
    await ensurePermissionsExist(body.permissionIds);
    // ADMIN بلا صلاحيات يعني نظاماً بلا مدير
    if (role.name === "ADMIN" && body.permissionIds.length === 0) {
        throw new app_errors_1.BadRequestException("The ADMIN role cannot be left without permissions", error_code_enum_1.ErrorCodeEnum.ACCESS_FORBIDDEN);
    }
    await client_1.prisma.$transaction(async (tx) => {
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
    return (0, exports.getRoleService)(id);
};
exports.setRolePermissionsService = setRolePermissionsService;
// --------------------------------------------------
// Delete
// --------------------------------------------------
const deleteRoleService = async (id) => {
    const role = await findOrThrow(id);
    if (role.isSystem) {
        throw new app_errors_1.ConflictException(`Cannot delete the system role '${role.name}'`, error_code_enum_1.ErrorCodeEnum.ACCESS_FORBIDDEN);
    }
    const users = await client_1.prisma.user.count({ where: { roleId: id } });
    if (users > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: ${users} user(s) are assigned to this role. ` +
            `Move them to another role first.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.$transaction(async (tx) => {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.role.delete({ where: { id } });
    });
};
exports.deleteRoleService = deleteRoleService;
//# sourceMappingURL=role.service.js.map