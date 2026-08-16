"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const study_group_controller_1 = require("./study-group.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const study_group_schema_1 = require("./study-group.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("study-group.view"), (0, validate_middleware_1.validateQuery)(study_group_schema_1.studyGroupQuerySchema), (0, async_handler_middleware_1.asyncHandler)(study_group_controller_1.listStudyGroupsController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("study-group.view"), (0, validate_middleware_1.validateParams)(study_group_schema_1.studyGroupIdSchema), (0, async_handler_middleware_1.asyncHandler)(study_group_controller_1.getStudyGroupController));
router.post("/", (0, permission_middleware_1.requirePermission)("study-group.create"), (0, validate_middleware_1.validate)(study_group_schema_1.createStudyGroupSchema), (0, async_handler_middleware_1.asyncHandler)(study_group_controller_1.createStudyGroupController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("study-group.update"), (0, validate_middleware_1.validateParams)(study_group_schema_1.studyGroupIdSchema), (0, validate_middleware_1.validate)(study_group_schema_1.updateStudyGroupSchema), (0, async_handler_middleware_1.asyncHandler)(study_group_controller_1.updateStudyGroupController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("study-group.delete"), (0, validate_middleware_1.validateParams)(study_group_schema_1.studyGroupIdSchema), (0, async_handler_middleware_1.asyncHandler)(study_group_controller_1.deleteStudyGroupController));
exports.default = router;
//# sourceMappingURL=study-group.route.js.map