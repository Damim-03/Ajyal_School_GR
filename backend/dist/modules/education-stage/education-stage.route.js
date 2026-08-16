"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const education_stage_controller_1 = require("./education-stage.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const education_stage_schema_1 = require("./education-stage.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("education-stage.view"), (0, validate_middleware_1.validateQuery)(education_stage_schema_1.educationStageQuerySchema), (0, async_handler_middleware_1.asyncHandler)(education_stage_controller_1.listEducationStagesController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("education-stage.view"), (0, validate_middleware_1.validateParams)(education_stage_schema_1.educationStageIdSchema), (0, async_handler_middleware_1.asyncHandler)(education_stage_controller_1.getEducationStageController));
router.post("/", (0, permission_middleware_1.requirePermission)("education-stage.create"), (0, validate_middleware_1.validate)(education_stage_schema_1.createEducationStageSchema), (0, async_handler_middleware_1.asyncHandler)(education_stage_controller_1.createEducationStageController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("education-stage.update"), (0, validate_middleware_1.validateParams)(education_stage_schema_1.educationStageIdSchema), (0, validate_middleware_1.validate)(education_stage_schema_1.updateEducationStageSchema), (0, async_handler_middleware_1.asyncHandler)(education_stage_controller_1.updateEducationStageController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("education-stage.delete"), (0, validate_middleware_1.validateParams)(education_stage_schema_1.educationStageIdSchema), (0, async_handler_middleware_1.asyncHandler)(education_stage_controller_1.deleteEducationStageController));
exports.default = router;
//# sourceMappingURL=education-stage.route.js.map