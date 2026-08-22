import { Router } from "express";
import {
  listTeachersController,
  getTeacherController,
  getTeacherStatementController,
  createTeacherController,
  updateTeacherController,
  deleteTeacherController,
} from "./teacher.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createTeacherSchema,
  updateTeacherSchema,
  teacherIdSchema,
  teacherQuerySchema,
  teacherStatementQuerySchema,
} from "./teacher.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("teacher.view"),
  validateQuery(teacherQuerySchema),
  asyncHandler(listTeachersController),
);

// --------------------------------------------------
// GET /api/teachers/:id/statement
//
// كشفُ حساب الأستاذ: كشوفُه في السنة بمستحقّها وما قُبض منه، ومعها
// متأخّراتُه. ويسبق `/:id` لأنّ المسار أطول — ولو تأخّر لالتقطه.
// --------------------------------------------------

router.get(
  "/:id/statement",
  requirePermission("teacher.view"),
  validateParams(teacherIdSchema),
  validateQuery(teacherStatementQuerySchema),
  asyncHandler(getTeacherStatementController),
);

router.get(
  "/:id",
  requirePermission("teacher.view"),
  validateParams(teacherIdSchema),
  asyncHandler(getTeacherController),
);

router.post(
  "/",
  requirePermission("teacher.create"),
  validate(createTeacherSchema),
  asyncHandler(createTeacherController),
);

router.patch(
  "/:id",
  requirePermission("teacher.update"),
  validateParams(teacherIdSchema),
  validate(updateTeacherSchema),
  asyncHandler(updateTeacherController),
);

router.delete(
  "/:id",
  requirePermission("teacher.delete"),
  validateParams(teacherIdSchema),
  asyncHandler(deleteTeacherController),
);

export default router;
