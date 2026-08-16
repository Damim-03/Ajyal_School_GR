"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const teaching_assignment_controller_1 = require("./teaching-assignment.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const teaching_assignment_schema_1 = require("./teaching-assignment.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("teaching-assignment.view"), (0, validate_middleware_1.validateQuery)(teaching_assignment_schema_1.teachingAssignmentQuerySchema), (0, async_handler_middleware_1.asyncHandler)(teaching_assignment_controller_1.listTeachingAssignmentsController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("teaching-assignment.view"), (0, validate_middleware_1.validateParams)(teaching_assignment_schema_1.teachingAssignmentIdSchema), (0, async_handler_middleware_1.asyncHandler)(teaching_assignment_controller_1.getTeachingAssignmentController));
router.post("/", (0, permission_middleware_1.requirePermission)("teaching-assignment.create"), (0, validate_middleware_1.validate)(teaching_assignment_schema_1.createTeachingAssignmentSchema), (0, async_handler_middleware_1.asyncHandler)(teaching_assignment_controller_1.createTeachingAssignmentController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("teaching-assignment.update"), (0, validate_middleware_1.validateParams)(teaching_assignment_schema_1.teachingAssignmentIdSchema), (0, validate_middleware_1.validate)(teaching_assignment_schema_1.updateTeachingAssignmentSchema), (0, async_handler_middleware_1.asyncHandler)(teaching_assignment_controller_1.updateTeachingAssignmentController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("teaching-assignment.delete"), (0, validate_middleware_1.validateParams)(teaching_assignment_schema_1.teachingAssignmentIdSchema), (0, async_handler_middleware_1.asyncHandler)(teaching_assignment_controller_1.deleteTeachingAssignmentController));
exports.default = router;
//# sourceMappingURL=teaching-assignment.route.js.map