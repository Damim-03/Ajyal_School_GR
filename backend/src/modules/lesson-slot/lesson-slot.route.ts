import { Router } from "express";
import {
  listLessonSlotsController,
  getLessonSlotController,
  createLessonSlotController,
  updateLessonSlotController,
  deleteLessonSlotController,
} from "./lesson-slot.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createLessonSlotSchema,
  updateLessonSlotSchema,
  lessonSlotIdSchema,
  lessonSlotQuerySchema,
} from "./lesson-slot.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("lesson-slot.view"),
  validateQuery(lessonSlotQuerySchema),
  asyncHandler(listLessonSlotsController),
);

router.get(
  "/:id",
  requirePermission("lesson-slot.view"),
  validateParams(lessonSlotIdSchema),
  asyncHandler(getLessonSlotController),
);

router.post(
  "/",
  requirePermission("lesson-slot.create"),
  validate(createLessonSlotSchema),
  asyncHandler(createLessonSlotController),
);

router.patch(
  "/:id",
  requirePermission("lesson-slot.update"),
  validateParams(lessonSlotIdSchema),
  validate(updateLessonSlotSchema),
  asyncHandler(updateLessonSlotController),
);

router.delete(
  "/:id",
  requirePermission("lesson-slot.delete"),
  validateParams(lessonSlotIdSchema),
  asyncHandler(deleteLessonSlotController),
);

export default router;
