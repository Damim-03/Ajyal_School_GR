import { Router } from "express";
import {
  listClassroomsController,
  getClassroomController,
  createClassroomController,
  updateClassroomController,
  deleteClassroomController,
} from "./classroom.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createClassroomSchema,
  updateClassroomSchema,
  classroomIdSchema,
  classroomQuerySchema,
} from "./classroom.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("classroom.view"),
  validateQuery(classroomQuerySchema),
  asyncHandler(listClassroomsController),
);

router.get(
  "/:id",
  requirePermission("classroom.view"),
  validateParams(classroomIdSchema),
  asyncHandler(getClassroomController),
);

router.post(
  "/",
  requirePermission("classroom.create"),
  validate(createClassroomSchema),
  asyncHandler(createClassroomController),
);

router.patch(
  "/:id",
  requirePermission("classroom.update"),
  validateParams(classroomIdSchema),
  validate(updateClassroomSchema),
  asyncHandler(updateClassroomController),
);

router.delete(
  "/:id",
  requirePermission("classroom.delete"),
  validateParams(classroomIdSchema),
  asyncHandler(deleteClassroomController),
);

export default router;
