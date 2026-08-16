import { Router } from "express";
import {
  listTeachingAssignmentsController,
  getTeachingAssignmentController,
  createTeachingAssignmentController,
  updateTeachingAssignmentController,
  deleteTeachingAssignmentController,
} from "./teaching-assignment.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createTeachingAssignmentSchema,
  updateTeachingAssignmentSchema,
  teachingAssignmentIdSchema,
  teachingAssignmentQuerySchema,
} from "./teaching-assignment.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("teaching-assignment.view"),
  validateQuery(teachingAssignmentQuerySchema),
  asyncHandler(listTeachingAssignmentsController),
);

router.get(
  "/:id",
  requirePermission("teaching-assignment.view"),
  validateParams(teachingAssignmentIdSchema),
  asyncHandler(getTeachingAssignmentController),
);

router.post(
  "/",
  requirePermission("teaching-assignment.create"),
  validate(createTeachingAssignmentSchema),
  asyncHandler(createTeachingAssignmentController),
);

router.patch(
  "/:id",
  requirePermission("teaching-assignment.update"),
  validateParams(teachingAssignmentIdSchema),
  validate(updateTeachingAssignmentSchema),
  asyncHandler(updateTeachingAssignmentController),
);

router.delete(
  "/:id",
  requirePermission("teaching-assignment.delete"),
  validateParams(teachingAssignmentIdSchema),
  asyncHandler(deleteTeachingAssignmentController),
);

export default router;
