import { Router } from "express";
import {
  dashboardReportController,
  financialReportController,
  outstandingReportController,
  attendanceReportController,
  dailyAttendanceReportController,
  monthlyFeesReportController,
  sessionClearanceReportController,
  expectedSessionsReportController,
} from "./report.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import { validateQuery } from "../../core/middleware/validate.middleware";
import {
  financialReportQuerySchema,
  outstandingReportQuerySchema,
  attendanceReportQuerySchema,
  dailyAttendanceReportQuerySchema,
  monthlyFeesReportQuerySchema,
  sessionClearanceReportQuerySchema,
  expectedSessionsReportQuerySchema,
} from "./report.schema";

const router = Router();

router.use(authMiddleware);

// --------------------------------------------------
// كلها للقراءة فقط — تجميعات على البيانات القائمة
//
// ملاحظة: صلاحية report.export موجودة بلا مسار،
// فتصدير PDF غير مُنفَّذ بعد (pdfkit مثبَّت وجاهز).
// --------------------------------------------------

router.get(
  "/dashboard",
  requirePermission("report.view"),
  asyncHandler(dashboardReportController),
);

router.get(
  "/financial",
  requirePermission("report.view"),
  validateQuery(financialReportQuerySchema),
  asyncHandler(financialReportController),
);

router.get(
  "/outstanding",
  requirePermission("report.view"),
  validateQuery(outstandingReportQuerySchema),
  asyncHandler(outstandingReportController),
);

router.get(
  "/attendance",
  requirePermission("report.view"),
  validateQuery(attendanceReportQuerySchema),
  asyncHandler(attendanceReportController),
);

// --------------------------------------------------
// الكشوف الورقية — كل واحد منها يقابل ورقةً تُطبع
// --------------------------------------------------

router.get(
  "/daily-attendance",
  requirePermission("report.view"),
  validateQuery(dailyAttendanceReportQuerySchema),
  asyncHandler(dailyAttendanceReportController),
);

router.get(
  "/monthly-fees",
  requirePermission("report.view"),
  validateQuery(monthlyFeesReportQuerySchema),
  asyncHandler(monthlyFeesReportController),
);

router.get(
  "/session-clearance",
  requirePermission("report.view"),
  validateQuery(sessionClearanceReportQuerySchema),
  asyncHandler(sessionClearanceReportController),
);

router.get(
  "/expected-sessions",
  requirePermission("report.view"),
  validateQuery(expectedSessionsReportQuerySchema),
  asyncHandler(expectedSessionsReportController),
);

export default router;
