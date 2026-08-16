import { Router } from "express";
import {
  listAcademicYearsController,
  getAcademicYearController,
  createAcademicYearController,
  updateAcademicYearController,
  deleteAcademicYearController,
} from "./academic-year.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createAcademicYearSchema,
  updateAcademicYearSchema,
  academicYearIdSchema,
  academicYearQuerySchema,
} from "./academic-year.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("academic-year.view"),
  validateQuery(academicYearQuerySchema),
  asyncHandler(listAcademicYearsController),
);

router.get(
  "/:id",
  requirePermission("academic-year.view"),
  validateParams(academicYearIdSchema),
  asyncHandler(getAcademicYearController),
);

router.post(
  "/",
  requirePermission("academic-year.create"),
  validate(createAcademicYearSchema),
  asyncHandler(createAcademicYearController),
);

router.patch(
  "/:id",
  requirePermission("academic-year.update"),
  validateParams(academicYearIdSchema),
  validate(updateAcademicYearSchema),
  asyncHandler(updateAcademicYearController),
);

router.delete(
  "/:id",
  requirePermission("academic-year.delete"),
  validateParams(academicYearIdSchema),
  asyncHandler(deleteAcademicYearController),
);

export default router;
