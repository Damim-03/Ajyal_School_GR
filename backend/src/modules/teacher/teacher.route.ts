import { Router } from "express";
import {
  listTeachersController,
  getTeacherController,
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
} from "./teacher.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("teacher.view"),
  validateQuery(teacherQuerySchema),
  asyncHandler(listTeachersController),
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
