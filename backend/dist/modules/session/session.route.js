"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const session_controller_1 = require("./session.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const session_schema_1 = require("./session.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("session.view"), (0, validate_middleware_1.validateQuery)(session_schema_1.sessionQuerySchema), (0, async_handler_middleware_1.asyncHandler)(session_controller_1.listSessionsController));
// --------------------------------------------------
// POST /api/sessions/generate
// يسبق /:id لأن "generate" ليس معرّفاً
// --------------------------------------------------
router.post("/generate", (0, permission_middleware_1.requirePermission)("session.create"), (0, validate_middleware_1.validate)(session_schema_1.generateSessionsSchema), (0, async_handler_middleware_1.asyncHandler)(session_controller_1.generateSessionsController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("session.view"), (0, validate_middleware_1.validateParams)(session_schema_1.sessionIdSchema), (0, async_handler_middleware_1.asyncHandler)(session_controller_1.getSessionController));
router.post("/", (0, permission_middleware_1.requirePermission)("session.create"), (0, validate_middleware_1.validate)(session_schema_1.createSessionSchema), (0, async_handler_middleware_1.asyncHandler)(session_controller_1.createSessionController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("session.update"), (0, validate_middleware_1.validateParams)(session_schema_1.sessionIdSchema), (0, validate_middleware_1.validate)(session_schema_1.updateSessionSchema), (0, async_handler_middleware_1.asyncHandler)(session_controller_1.updateSessionController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("session.delete"), (0, validate_middleware_1.validateParams)(session_schema_1.sessionIdSchema), (0, async_handler_middleware_1.asyncHandler)(session_controller_1.deleteSessionController));
exports.default = router;
//# sourceMappingURL=session.route.js.map