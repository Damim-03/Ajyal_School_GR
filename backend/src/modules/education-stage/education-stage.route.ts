import { Router } from "express";
import {
  listEducationStagesController,
  getEducationStageController,
  createEducationStageController,
  updateEducationStageController,
  deleteEducationStageController,
} from "./education-stage.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createEducationStageSchema,
  updateEducationStageSchema,
  educationStageIdSchema,
  educationStageQuerySchema,
} from "./education-stage.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("education-stage.view"),
  validateQuery(educationStageQuerySchema),
  asyncHandler(listEducationStagesController),
);

router.get(
  "/:id",
  requirePermission("education-stage.view"),
  validateParams(educationStageIdSchema),
  asyncHandler(getEducationStageController),
);

router.post(
  "/",
  requirePermission("education-stage.create"),
  validate(createEducationStageSchema),
  asyncHandler(createEducationStageController),
);

router.patch(
  "/:id",
  requirePermission("education-stage.update"),
  validateParams(educationStageIdSchema),
  validate(updateEducationStageSchema),
  asyncHandler(updateEducationStageController),
);

router.delete(
  "/:id",
  requirePermission("education-stage.delete"),
  validateParams(educationStageIdSchema),
  asyncHandler(deleteEducationStageController),
);

export default router;
