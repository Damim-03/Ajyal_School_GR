import { Router } from "express";
import {
  listLevelsController,
  getLevelController,
  createLevelController,
  updateLevelController,
  deleteLevelController,
} from "./level.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createLevelSchema,
  updateLevelSchema,
  levelIdSchema,
  levelQuerySchema,
} from "./level.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("level.view"),
  validateQuery(levelQuerySchema),
  asyncHandler(listLevelsController),
);

router.get(
  "/:id",
  requirePermission("level.view"),
  validateParams(levelIdSchema),
  asyncHandler(getLevelController),
);

router.post(
  "/",
  requirePermission("level.create"),
  validate(createLevelSchema),
  asyncHandler(createLevelController),
);

router.patch(
  "/:id",
  requirePermission("level.update"),
  validateParams(levelIdSchema),
  validate(updateLevelSchema),
  asyncHandler(updateLevelController),
);

router.delete(
  "/:id",
  requirePermission("level.delete"),
  validateParams(levelIdSchema),
  asyncHandler(deleteLevelController),
);

export default router;
