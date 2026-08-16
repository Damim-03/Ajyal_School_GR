"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionRouter = void 0;
const express_1 = require("express");
const role_controller_1 = require("./role.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const role_schema_1 = require("./role.schema");
// --------------------------------------------------
// /api/roles
// --------------------------------------------------
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("role.view"), (0, validate_middleware_1.validateQuery)(role_schema_1.roleQuerySchema), (0, async_handler_middleware_1.asyncHandler)(role_controller_1.listRolesController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("role.view"), (0, validate_middleware_1.validateParams)(role_schema_1.roleIdSchema), (0, async_handler_middleware_1.asyncHandler)(role_controller_1.getRoleController));
router.post("/", (0, permission_middleware_1.requirePermission)("role.create"), (0, validate_middleware_1.validate)(role_schema_1.createRoleSchema), (0, async_handler_middleware_1.asyncHandler)(role_controller_1.createRoleController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("role.update"), (0, validate_middleware_1.validateParams)(role_schema_1.roleIdSchema), (0, validate_middleware_1.validate)(role_schema_1.updateRoleSchema), (0, async_handler_middleware_1.asyncHandler)(role_controller_1.updateRoleController));
// استبدال كامل لمجموعة صلاحيات الدور
router.put("/:id/permissions", (0, permission_middleware_1.requirePermission)("role.update"), (0, validate_middleware_1.validateParams)(role_schema_1.roleIdSchema), (0, validate_middleware_1.validate)(role_schema_1.setRolePermissionsSchema), (0, async_handler_middleware_1.asyncHandler)(role_controller_1.setRolePermissionsController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("role.delete"), (0, validate_middleware_1.validateParams)(role_schema_1.roleIdSchema), (0, async_handler_middleware_1.asyncHandler)(role_controller_1.deleteRoleController));
exports.default = router;
// --------------------------------------------------
// /api/permissions — قائمة الصلاحيات المتاحة
// للقراءة فقط: تُولَّد من الـ seeder لا من الـ API
// --------------------------------------------------
exports.permissionRouter = (0, express_1.Router)();
exports.permissionRouter.use(auth_middleware_1.authMiddleware);
exports.permissionRouter.get("/", (0, permission_middleware_1.requirePermission)("role.view"), (0, validate_middleware_1.validateQuery)(role_schema_1.permissionQuerySchema), (0, async_handler_middleware_1.asyncHandler)(role_controller_1.listPermissionsController));
//# sourceMappingURL=role.route.js.map