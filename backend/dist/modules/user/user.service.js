"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserService = exports.updateUserService = exports.createUserService = exports.getUserService = exports.listUsersService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const text_match_1 = require("../../core/search/text-match");
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
};
const BCRYPT_ROUNDS = 12;
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const user = await client_1.prisma.user.findUnique({
        where: { id },
        select: { id: true, roleId: true, role: { select: { name: true } } },
    });
    if (!user) {
        throw new app_errors_1.NotFoundException("User not found", error_code_enum_1.ErrorCodeEnum.AUTH_USER_NOT_FOUND);
    }
    return user;
};
const ensureUnique = async (data, excludeId) => {
    const conditions = [];
    if (data.username)
        conditions.push({ username: data.username });
    if (data.email)
        conditions.push({ email: data.email });
    if (conditions.length === 0)
        return;
    const duplicate = await client_1.prisma.user.findFirst({
        where: {
            OR: conditions,
            ...(excludeId && { NOT: { id: excludeId } }),
        },
        select: { username: true, email: true },
    });
    if (!duplicate)
        return;
    const field = data.username && duplicate.username === data.username
        ? "username"
        : "email";
    throw new app_errors_1.ConflictException(`A user with this ${field} already exists`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
};
const ensureRoleExists = async (roleId) => {
    const role = await client_1.prisma.role.findUnique({
        where: { id: roleId },
        select: { id: true },
    });
    if (!role) {
        throw new app_errors_1.NotFoundException("Role not found", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
};
/**
 * يمنع فقدان آخر مدير نشط — وإلا أُقفل النظام
 * ولم يبقَ من يملك صلاحية إعادة الفتح.
 */
const ensureNotLastActiveAdmin = async (userId, action) => {
    const user = await client_1.prisma.user.findUnique({
        where: { id: userId },
        select: { isActive: true, role: { select: { name: true } } },
    });
    if (!user || user.role.name !== "ADMIN" || !user.isActive)
        return;
    const activeAdmins = await client_1.prisma.user.count({
        where: { isActive: true, role: { name: "ADMIN" } },
    });
    if (activeAdmins <= 1) {
        throw new app_errors_1.ConflictException(`Cannot ${action}: this is the last active administrator`, error_code_enum_1.ErrorCodeEnum.ACCESS_FORBIDDEN);
    }
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listUsersService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    /* مطابقةٌ بترتيبٍ صريح — انظر `core/search/text-match` — والاسمُ في حقلين فيُقسَّم كلماتٍ */
    const searchIds = query.search
        ? await (0, text_match_1.matchTextIds)("User", (0, text_match_1.words)(query.search).length > 1
            ? (0, text_match_1.words)(query.search).map((token) => (0, text_match_1.containsOn)(["firstName", "lastName"], token))
            : [
                (0, text_match_1.containsOn)(["username", "firstName", "lastName", "email"], query.search),
            ])
        : null;
    const where = {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.roleId && { roleId: query.roleId }),
        ...(searchIds && { id: { in: searchIds } }),
    };
    const [users, total] = await Promise.all([
        client_1.prisma.user.findMany({
            where,
            select: userSelect,
            skip,
            take,
            orderBy: { username: "asc" },
        }),
        client_1.prisma.user.count({ where }),
    ]);
    return { users, pagination: (0, api_response_1.buildPagination)(total, page, limit) };
};
exports.listUsersService = listUsersService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getUserService = async (id) => {
    await findOrThrow(id);
    return client_1.prisma.user.findUnique({
        where: { id },
        select: {
            ...userSelect,
            _count: {
                select: { invoices: true, payments: true, receipts: true },
            },
        },
    });
};
exports.getUserService = getUserService;
// --------------------------------------------------
// Create
// --------------------------------------------------
const createUserService = async (body) => {
    await ensureUnique({ username: body.username, email: body.email });
    await ensureRoleExists(body.roleId);
    return client_1.prisma.user.create({
        data: {
            username: body.username,
            password: await bcryptjs_1.default.hash(body.password, BCRYPT_ROUNDS),
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
exports.createUserService = createUserService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateUserService = async (id, body, actingUserId) => {
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
        const current = await client_1.prisma.user.findUnique({
            where: { id },
            select: { roleId: true },
        });
        if (current && current.roleId !== body.roleId) {
            await ensureNotLastActiveAdmin(id, "change the role of");
        }
    }
    // منع المستخدم من تعطيل نفسه بالخطأ
    if (id === actingUserId && body.isActive === false) {
        throw new app_errors_1.BadRequestException("You cannot deactivate your own account", error_code_enum_1.ErrorCodeEnum.ACCESS_FORBIDDEN);
    }
    return client_1.prisma.user.update({
        where: { id },
        data: {
            ...(body.username !== undefined && { username: body.username }),
            ...(body.password !== undefined && {
                password: await bcryptjs_1.default.hash(body.password, BCRYPT_ROUNDS),
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
exports.updateUserService = updateUserService;
// --------------------------------------------------
// Delete
//
// المستخدم مرتبط بفواتير ودفعات وإيصالات بلا onDelete،
// فالحذف مع وجود سجلات مالية يفشل على مستوى قاعدة
// البيانات — نمنعه مسبقاً ونقترح التعطيل.
// --------------------------------------------------
const deleteUserService = async (id, actingUserId) => {
    await findOrThrow(id);
    if (id === actingUserId) {
        throw new app_errors_1.BadRequestException("You cannot delete your own account", error_code_enum_1.ErrorCodeEnum.ACCESS_FORBIDDEN);
    }
    await ensureNotLastActiveAdmin(id, "delete");
    const relations = await client_1.prisma.user.findUnique({
        where: { id },
        select: {
            _count: { select: { invoices: true, payments: true, receipts: true } },
        },
    });
    const invoices = relations?._count.invoices ?? 0;
    const payments = relations?._count.payments ?? 0;
    const receipts = relations?._count.receipts ?? 0;
    if (invoices > 0 || payments > 0 || receipts > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: user is linked to ${invoices} invoice(s), ` +
            `${payments} payment(s) and ${receipts} receipt(s). ` +
            `Deactivate the account instead.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.user.delete({ where: { id } });
};
exports.deleteUserService = deleteUserService;
//# sourceMappingURL=user.service.js.map