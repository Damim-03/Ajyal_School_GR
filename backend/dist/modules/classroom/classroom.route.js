"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const classroom_controller_1 = require("./classroom.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const classroom_schema_1 = require("./classroom.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("classroom.view"), (0, validate_middleware_1.validateQuery)(classroom_schema_1.classroomQuerySchema), (0, async_handler_middleware_1.asyncHandler)(classroom_controller_1.listClassroomsController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("classroom.view"), (0, validate_middleware_1.validateParams)(classroom_schema_1.classroomIdSchema), (0, async_handler_middleware_1.asyncHandler)(classroom_controller_1.getClassroomController));
router.post("/", (0, permission_middleware_1.requirePermission)("classroom.create"), (0, validate_middleware_1.validate)(classroom_schema_1.createClassroomSchema), (0, async_handler_middleware_1.asyncHandler)(classroom_controller_1.createClassroomController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("classroom.update"), (0, validate_middleware_1.validateParams)(classroom_schema_1.classroomIdSchema), (0, validate_middleware_1.validate)(classroom_schema_1.updateClassroomSchema), (0, async_handler_middleware_1.asyncHandler)(classroom_controller_1.updateClassroomController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("classroom.delete"), (0, validate_middleware_1.validateParams)(classroom_schema_1.classroomIdSchema), (0, async_handler_middleware_1.asyncHandler)(classroom_controller_1.deleteClassroomController));
exports.default = router;
//# sourceMappingURL=classroom.route.js.map