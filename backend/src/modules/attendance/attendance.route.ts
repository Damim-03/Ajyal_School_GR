import { Router } from "express";
import {
  listAttendanceController,
  getAttendanceController,
  createAttendanceController,
  bulkAttendanceController,
  updateAttendanceController,
  clearSessionAttendanceController,
  deleteAttendanceController,
} from "./attendance.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createAttendanceSchema,
  bulkAttendanceSchema,
  updateAttendanceSchema,
  attendanceIdSchema,
  attendanceSessionIdSchema,
  attendanceQuerySchema,
} from "./attendance.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("attendance.view"),
  validateQuery(attendanceQuerySchema),
  asyncHandler(listAttendanceController),
);

// --------------------------------------------------
// POST /api/attendance/bulk
// يسبق /:id لأن "bulk" ليس معرّفاً
// --------------------------------------------------

router.post(
  "/bulk",
  requirePermission("attendance.create"),
  validate(bulkAttendanceSchema),
  asyncHandler(bulkAttendanceController),
);

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

router.delete(
  "/session/:sessionId",
  requirePermission("attendance.delete"),
  validateParams(attendanceSessionIdSchema),
  asyncHandler(clearSessionAttendanceController),
);

router.delete(
  "/:id",
  requirePermission("attendance.delete"),
  validateParams(attendanceIdSchema),
  asyncHandler(deleteAttendanceController),
);

router.get(
  "/:id",
  requirePermission("attendance.view"),
  validateParams(attendanceIdSchema),
  asyncHandler(getAttendanceController),
);

router.post(
  "/",
  requirePermission("attendance.create"),
  validate(createAttendanceSchema),
  asyncHandler(createAttendanceController),
);

router.patch(
  "/:id",
  requirePermission("attendance.update"),
  validateParams(attendanceIdSchema),
  validate(updateAttendanceSchema),
  asyncHandler(updateAttendanceController),
);

export default router;
