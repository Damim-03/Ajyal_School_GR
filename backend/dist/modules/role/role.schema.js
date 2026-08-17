"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionQuerySchema = exports.roleQuerySchema = exports.roleIdSchema = exports.setRolePermissionsSchema = exports.updateRoleSchema = exports.createRoleSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../../../generated/prisma");
// --------------------------------------------------
// Create
// --------------------------------------------------
exports.createRoleSchema = zod_1.z.object({
    name: zod_1.z
        .string({ error: "Role name is required" })
        .trim()
        .min(2, "Name must be at least 2 characters")
        .max(50, "Name must not exceed 50 characters")
        .regex(/^[A-Z][A-Z0-9_]*$/, "Role name must be uppercase letters, digits and underscore (e.g. LIBRARIAN)"),
    description: zod_1.z.string().trim().max(200).nullish(),
    // الصلاحيات الابتدائية — اختيارية
    permissionIds: zod_1.z.array(zod_1.z.string().trim().min(1)).max(200).optional(),
});
// --------------------------------------------------
// Update
// isSystem لا يُعدَّل عبر الـ API
// --------------------------------------------------
exports.updateRoleSchema = zod_1.z
    .object({
    name: exports.createRoleSchema.shape.name,
    description: zod_1.z.string().trim().max(200).nullish(),
})
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Set permissions — استبدال كامل للمجموعة
// --------------------------------------------------
exports.setRolePermissionsSchema = zod_1.z.object({
    permissionIds: zod_1.z
        .array(zod_1.z.string().trim().min(1), { error: "Permissions are required" })
        .max(200, "Too many permissions")
        .transform((ids) => [...new Set(ids)]),
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.roleIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Role id is required"),
});
exports.roleQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    search: zod_1.z.string().trim().min(1).optional(),
});
exports.permissionQuerySchema = zod_1.z.object({
    module: zod_1.z.enum(prisma_1.PermissionModule).optional(),
    search: zod_1.z.string().trim().min(1).optional(),
});
//# sourceMappingURL=role.schema.js.map