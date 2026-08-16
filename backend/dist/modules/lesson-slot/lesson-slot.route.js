"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const lesson_slot_controller_1 = require("./lesson-slot.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const lesson_slot_schema_1 = require("./lesson-slot.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("lesson-slot.view"), (0, validate_middleware_1.validateQuery)(lesson_slot_schema_1.lessonSlotQuerySchema), (0, async_handler_middleware_1.asyncHandler)(lesson_slot_controller_1.listLessonSlotsController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("lesson-slot.view"), (0, validate_middleware_1.validateParams)(lesson_slot_schema_1.lessonSlotIdSchema), (0, async_handler_middleware_1.asyncHandler)(lesson_slot_controller_1.getLessonSlotController));
router.post("/", (0, permission_middleware_1.requirePermission)("lesson-slot.create"), (0, validate_middleware_1.validate)(lesson_slot_schema_1.createLessonSlotSchema), (0, async_handler_middleware_1.asyncHandler)(lesson_slot_controller_1.createLessonSlotController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("lesson-slot.update"), (0, validate_middleware_1.validateParams)(lesson_slot_schema_1.lessonSlotIdSchema), (0, validate_middleware_1.validate)(lesson_slot_schema_1.updateLessonSlotSchema), (0, async_handler_middleware_1.asyncHandler)(lesson_slot_controller_1.updateLessonSlotController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("lesson-slot.delete"), (0, validate_middleware_1.validateParams)(lesson_slot_schema_1.lessonSlotIdSchema), (0, async_handler_middleware_1.asyncHandler)(lesson_slot_controller_1.deleteLessonSlotController));
exports.default = router;
//# sourceMappingURL=lesson-slot.route.js.map