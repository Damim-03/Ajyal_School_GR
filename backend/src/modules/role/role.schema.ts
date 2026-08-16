import { z } from "zod";
import { PermissionModule } from "../../generated/prisma";

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createRoleSchema = z.object({
  name: z
    .string({ error: "Role name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must not exceed 50 characters")
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      "Role name must be uppercase letters, digits and underscore (e.g. LIBRARIAN)",
    ),

  description: z.string().trim().max(200).nullish(),

  // الصلاحيات الابتدائية — اختيارية
  permissionIds: z.array(z.string().trim().min(1)).max(200).optional(),
});

// --------------------------------------------------
// Update
// isSystem لا يُعدَّل عبر الـ API
// --------------------------------------------------

export const updateRoleSchema = z
  .object({
    name: createRoleSchema.shape.name,
    description: z.string().trim().max(200).nullish(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Set permissions — استبدال كامل للمجموعة
// --------------------------------------------------

export const setRolePermissionsSchema = z.object({
  permissionIds: z
    .array(z.string().trim().min(1), { error: "Permissions are required" })
    .max(200, "Too many permissions")
    .transform((ids) => [...new Set(ids)]),
});

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const roleIdSchema = z.object({
  id: z.string().trim().min(1, "Role id is required"),
});

export const roleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().min(1).optional(),
});

export const permissionQuerySchema = z.object({
  module: z.enum(PermissionModule).optional(),
  search: z.string().trim().min(1).optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type SetRolePermissionsInput = z.infer<typeof setRolePermissionsSchema>;
export type RoleQueryInput = z.infer<typeof roleQuerySchema>;
export type PermissionQueryInput = z.infer<typeof permissionQuerySchema>;
