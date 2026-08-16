import { Router } from "express";
import {
  listSchedulesController,
  getScheduleController,
  createScheduleController,
  updateScheduleController,
  deleteScheduleController,
} from "./schedule.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createScheduleSchema,
  updateScheduleSchema,
  scheduleIdSchema,
  scheduleQuerySchema,
} from "./schedule.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("schedule.view"),
  validateQuery(scheduleQuerySchema),
  asyncHandler(listSchedulesController),
);

router.get(
  "/:id",
  requirePermission("schedule.view"),
  validateParams(scheduleIdSchema),
  asyncHandler(getScheduleController),
);

router.post(
  "/",
  requirePermission("schedule.create"),
  validate(createScheduleSchema),
  asyncHandler(createScheduleController),
);

router.patch(
  "/:id",
  requirePermission("schedule.update"),
  validateParams(scheduleIdSchema),
  validate(updateScheduleSchema),
  asyncHandler(updateScheduleController),
);

router.delete(
  "/:id",
  requirePermission("schedule.delete"),
  validateParams(scheduleIdSchema),
  asyncHandler(deleteScheduleController),
);

export default router;
