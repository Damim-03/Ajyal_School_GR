"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const user_schema_1 = require("./user.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("user.view"), (0, validate_middleware_1.validateQuery)(user_schema_1.userQuerySchema), (0, async_handler_middleware_1.asyncHandler)(user_controller_1.listUsersController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("user.view"), (0, validate_middleware_1.validateParams)(user_schema_1.userIdSchema), (0, async_handler_middleware_1.asyncHandler)(user_controller_1.getUserController));
router.post("/", (0, permission_middleware_1.requirePermission)("user.create"), (0, validate_middleware_1.validate)(user_schema_1.createUserSchema), (0, async_handler_middleware_1.asyncHandler)(user_controller_1.createUserController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("user.update"), (0, validate_middleware_1.validateParams)(user_schema_1.userIdSchema), (0, validate_middleware_1.validate)(user_schema_1.updateUserSchema), (0, async_handler_middleware_1.asyncHandler)(user_controller_1.updateUserController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("user.delete"), (0, validate_middleware_1.validateParams)(user_schema_1.userIdSchema), (0, async_handler_middleware_1.asyncHandler)(user_controller_1.deleteUserController));
exports.default = router;
//# sourceMappingURL=user.route.js.map