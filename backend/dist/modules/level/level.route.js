"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const level_controller_1 = require("./level.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const level_schema_1 = require("./level.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("level.view"), (0, validate_middleware_1.validateQuery)(level_schema_1.levelQuerySchema), (0, async_handler_middleware_1.asyncHandler)(level_controller_1.listLevelsController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("level.view"), (0, validate_middleware_1.validateParams)(level_schema_1.levelIdSchema), (0, async_handler_middleware_1.asyncHandler)(level_controller_1.getLevelController));
router.post("/", (0, permission_middleware_1.requirePermission)("level.create"), (0, validate_middleware_1.validate)(level_schema_1.createLevelSchema), (0, async_handler_middleware_1.asyncHandler)(level_controller_1.createLevelController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("level.update"), (0, validate_middleware_1.validateParams)(level_schema_1.levelIdSchema), (0, validate_middleware_1.validate)(level_schema_1.updateLevelSchema), (0, async_handler_middleware_1.asyncHandler)(level_controller_1.updateLevelController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("level.delete"), (0, validate_middleware_1.validateParams)(level_schema_1.levelIdSchema), (0, async_handler_middleware_1.asyncHandler)(level_controller_1.deleteLevelController));
exports.default = router;
//# sourceMappingURL=level.route.js.map