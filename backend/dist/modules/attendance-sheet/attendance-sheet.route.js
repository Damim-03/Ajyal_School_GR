"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendance_sheet_controller_1 = require("./attendance-sheet.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const attendance_sheet_schema_1 = require("./attendance-sheet.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
/*
 * الكشف ورقةُ حضورٍ لا حصة — فصلاحياته صلاحيات الحضور.
 * إنشاء كشفٍ فارغ لا يُسجّل حضوراً، لكنه يُنشئ الوعاء الذي يُسجَّل فيه.
 */
router.get("/", (0, permission_middleware_1.requirePermission)("attendance.view"), (0, validate_middleware_1.validateQuery)(attendance_sheet_schema_1.sheetQuerySchema), (0, async_handler_middleware_1.asyncHandler)(attendance_sheet_controller_1.listSheetsController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("attendance.view"), (0, validate_middleware_1.validateParams)(attendance_sheet_schema_1.sheetIdSchema), (0, async_handler_middleware_1.asyncHandler)(attendance_sheet_controller_1.getSheetController));
router.post("/", (0, permission_middleware_1.requirePermission)("attendance.create"), (0, validate_middleware_1.validate)(attendance_sheet_schema_1.createSheetSchema), (0, async_handler_middleware_1.asyncHandler)(attendance_sheet_controller_1.createSheetController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("attendance.update"), (0, validate_middleware_1.validateParams)(attendance_sheet_schema_1.sheetIdSchema), (0, validate_middleware_1.validate)(attendance_sheet_schema_1.updateSheetSchema), (0, async_handler_middleware_1.asyncHandler)(attendance_sheet_controller_1.updateSheetController));
// الحصص تبقى — تُفكّ نسبتُها إلى الكشف فقط
router.delete("/:id", (0, permission_middleware_1.requirePermission)("attendance.delete"), (0, validate_middleware_1.validateParams)(attendance_sheet_schema_1.sheetIdSchema), (0, async_handler_middleware_1.asyncHandler)(attendance_sheet_controller_1.deleteSheetController));
exports.default = router;
//# sourceMappingURL=attendance-sheet.route.js.map