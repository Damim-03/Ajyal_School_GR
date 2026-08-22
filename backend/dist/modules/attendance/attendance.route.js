"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendance_controller_1 = require("./attendance.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const attendance_schema_1 = require("./attendance.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("attendance.view"), (0, validate_middleware_1.validateQuery)(attendance_schema_1.attendanceQuerySchema), (0, async_handler_middleware_1.asyncHandler)(attendance_controller_1.listAttendanceController));
// --------------------------------------------------
// POST /api/attendance/bulk
// يسبق /:id لأن "bulk" ليس معرّفاً
// --------------------------------------------------
router.post("/bulk", (0, permission_middleware_1.requirePermission)("attendance.create"), (0, validate_middleware_1.validate)(attendance_schema_1.bulkAttendanceSchema), (0, async_handler_middleware_1.asyncHandler)(attendance_controller_1.bulkAttendanceController));
// --------------------------------------------------
// المحو — ورقةً كاملة أو خليةً واحدة
//
// وسببُهما واحد: ما مُلئ بالخطأ لا يُصحَّح بالتعديل. الصواب أن تعود
// الخانة فارغة («لم يُسجَّل بعد») لا أن تصير غياباً («سُجّل أنه غاب»)
// — وبينهما فرقٌ ماليٌّ في التخليص ومعنويٌّ في سجلّ الطالب.
//
// و`/session/:sessionId` قبل `/:id` لأنّه أخصّ — ولا يتعارضان أصلاً
// لاختلاف عدد المقاطع، لكنّ الترتيب يُبقي القراءة على وجهٍ واحد.
// --------------------------------------------------
router.delete("/session/:sessionId", (0, permission_middleware_1.requirePermission)("attendance.delete"), (0, validate_middleware_1.validateParams)(attendance_schema_1.attendanceSessionIdSchema), (0, async_handler_middleware_1.asyncHandler)(attendance_controller_1.clearSessionAttendanceController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("attendance.delete"), (0, validate_middleware_1.validateParams)(attendance_schema_1.attendanceIdSchema), (0, async_handler_middleware_1.asyncHandler)(attendance_controller_1.deleteAttendanceController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("attendance.view"), (0, validate_middleware_1.validateParams)(attendance_schema_1.attendanceIdSchema), (0, async_handler_middleware_1.asyncHandler)(attendance_controller_1.getAttendanceController));
router.post("/", (0, permission_middleware_1.requirePermission)("attendance.create"), (0, validate_middleware_1.validate)(attendance_schema_1.createAttendanceSchema), (0, async_handler_middleware_1.asyncHandler)(attendance_controller_1.createAttendanceController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("attendance.update"), (0, validate_middleware_1.validateParams)(attendance_schema_1.attendanceIdSchema), (0, validate_middleware_1.validate)(attendance_schema_1.updateAttendanceSchema), (0, async_handler_middleware_1.asyncHandler)(attendance_controller_1.updateAttendanceController));
exports.default = router;
//# sourceMappingURL=attendance.route.js.map