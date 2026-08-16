import { Router } from "express";
import {
  listStudyGroupsController,
  getStudyGroupController,
  createStudyGroupController,
  updateStudyGroupController,
  deleteStudyGroupController,
} from "./study-group.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createStudyGroupSchema,
  updateStudyGroupSchema,
  studyGroupIdSchema,
  studyGroupQuerySchema,
} from "./study-group.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("study-group.view"),
  validateQuery(studyGroupQuerySchema),
  asyncHandler(listStudyGroupsController),
);

router.get(
  "/:id",
  requirePermission("study-group.view"),
  validateParams(studyGroupIdSchema),
  asyncHandler(getStudyGroupController),
);

router.post(
  "/",
  requirePermission("study-group.create"),
  validate(createStudyGroupSchema),
  asyncHandler(createStudyGroupController),
);

router.patch(
  "/:id",
  requirePermission("study-group.update"),
  validateParams(studyGroupIdSchema),
  validate(updateStudyGroupSchema),
  asyncHandler(updateStudyGroupController),
);

router.delete(
  "/:id",
  requirePermission("study-group.delete"),
  validateParams(studyGroupIdSchema),
  asyncHandler(deleteStudyGroupController),
);

export default router;
