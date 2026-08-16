import { Router } from "express";
import {
  listRolesController,
  getRoleController,
  createRoleController,
  updateRoleController,
  setRolePermissionsController,
  deleteRoleController,
  listPermissionsController,
} from "./role.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createRoleSchema,
  updateRoleSchema,
  setRolePermissionsSchema,
  roleIdSchema,
  roleQuerySchema,
  permissionQuerySchema,
} from "./role.schema";

// --------------------------------------------------
// /api/roles
// --------------------------------------------------

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("role.view"),
  validateQuery(roleQuerySchema),
  asyncHandler(listRolesController),
);

router.get(
  "/:id",
  requirePermission("role.view"),
  validateParams(roleIdSchema),
  asyncHandler(getRoleController),
);

router.post(
  "/",
  requirePermission("role.create"),
  validate(createRoleSchema),
  asyncHandler(createRoleController),
);

router.patch(
  "/:id",
  requirePermission("role.update"),
  validateParams(roleIdSchema),
  validate(updateRoleSchema),
  asyncHandler(updateRoleController),
);

// استبدال كامل لمجموعة صلاحيات الدور
router.put(
  "/:id/permissions",
  requirePermission("role.update"),
  validateParams(roleIdSchema),
  validate(setRolePermissionsSchema),
  asyncHandler(setRolePermissionsController),
);

router.delete(
  "/:id",
  requirePermission("role.delete"),
  validateParams(roleIdSchema),
  asyncHandler(deleteRoleController),
);

export default router;

// --------------------------------------------------
// /api/permissions — قائمة الصلاحيات المتاحة
// للقراءة فقط: تُولَّد من الـ seeder لا من الـ API
// --------------------------------------------------

export const permissionRouter: Router = Router();

permissionRouter.use(authMiddleware);

permissionRouter.get(
  "/",
  requirePermission("role.view"),
  validateQuery(permissionQuerySchema),
  asyncHandler(listPermissionsController),
);
