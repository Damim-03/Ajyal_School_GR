import { Router } from "express";
import {
  listTuitionFeesController,
  getTuitionFeeController,
  createTuitionFeeController,
  updateTuitionFeeController,
  deleteTuitionFeeController,
} from "./tuition-fee.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createTuitionFeeSchema,
  updateTuitionFeeSchema,
  tuitionFeeIdSchema,
  tuitionFeeQuerySchema,
} from "./tuition-fee.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("tuition-fee.view"),
  validateQuery(tuitionFeeQuerySchema),
  asyncHandler(listTuitionFeesController),
);

router.get(
  "/:id",
  requirePermission("tuition-fee.view"),
  validateParams(tuitionFeeIdSchema),
  asyncHandler(getTuitionFeeController),
);

router.post(
  "/",
  requirePermission("tuition-fee.create"),
  validate(createTuitionFeeSchema),
  asyncHandler(createTuitionFeeController),
);

router.patch(
  "/:id",
  requirePermission("tuition-fee.update"),
  validateParams(tuitionFeeIdSchema),
  validate(updateTuitionFeeSchema),
  asyncHandler(updateTuitionFeeController),
);

router.delete(
  "/:id",
  requirePermission("tuition-fee.delete"),
  validateParams(tuitionFeeIdSchema),
  asyncHandler(deleteTuitionFeeController),
);

export default router;
