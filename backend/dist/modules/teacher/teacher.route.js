"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const teacher_controller_1 = require("./teacher.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const teacher_schema_1 = require("./teacher.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("teacher.view"), (0, validate_middleware_1.validateQuery)(teacher_schema_1.teacherQuerySchema), (0, async_handler_middleware_1.asyncHandler)(teacher_controller_1.listTeachersController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("teacher.view"), (0, validate_middleware_1.validateParams)(teacher_schema_1.teacherIdSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_controller_1.getTeacherController));
router.post("/", (0, permission_middleware_1.requirePermission)("teacher.create"), (0, validate_middleware_1.validate)(teacher_schema_1.createTeacherSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_controller_1.createTeacherController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("teacher.update"), (0, validate_middleware_1.validateParams)(teacher_schema_1.teacherIdSchema), (0, validate_middleware_1.validate)(teacher_schema_1.updateTeacherSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_controller_1.updateTeacherController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("teacher.delete"), (0, validate_middleware_1.validateParams)(teacher_schema_1.teacherIdSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_controller_1.deleteTeacherController));
exports.default = router;
//# sourceMappingURL=teacher.route.js.map