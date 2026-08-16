"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schedule_controller_1 = require("./schedule.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const schedule_schema_1 = require("./schedule.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("schedule.view"), (0, validate_middleware_1.validateQuery)(schedule_schema_1.scheduleQuerySchema), (0, async_handler_middleware_1.asyncHandler)(schedule_controller_1.listSchedulesController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("schedule.view"), (0, validate_middleware_1.validateParams)(schedule_schema_1.scheduleIdSchema), (0, async_handler_middleware_1.asyncHandler)(schedule_controller_1.getScheduleController));
router.post("/", (0, permission_middleware_1.requirePermission)("schedule.create"), (0, validate_middleware_1.validate)(schedule_schema_1.createScheduleSchema), (0, async_handler_middleware_1.asyncHandler)(schedule_controller_1.createScheduleController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("schedule.update"), (0, validate_middleware_1.validateParams)(schedule_schema_1.scheduleIdSchema), (0, validate_middleware_1.validate)(schedule_schema_1.updateScheduleSchema), (0, async_handler_middleware_1.asyncHandler)(schedule_controller_1.updateScheduleController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("schedule.delete"), (0, validate_middleware_1.validateParams)(schedule_schema_1.scheduleIdSchema), (0, async_handler_middleware_1.asyncHandler)(schedule_controller_1.deleteScheduleController));
exports.default = router;
//# sourceMappingURL=schedule.route.js.map