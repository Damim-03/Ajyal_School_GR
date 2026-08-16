import { Router } from "express";
import {
  listSubjectsController,
  getSubjectController,
  createSubjectController,
  updateSubjectController,
  deleteSubjectController,
} from "./subject.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createSubjectSchema,
  updateSubjectSchema,
  subjectIdSchema,
  subjectQuerySchema,
} from "./subject.schema";

const router = Router();

// كل المسارات محمية
router.use(authMiddleware);

// --------------------------------------------------
// GET /api/settings/subjects
// subject.view
// --------------------------------------------------

router.get(
  "/",
  requirePermission("subject.view"),
  validateQuery(subjectQuerySchema),
  asyncHandler(listSubjectsController),
);

// --------------------------------------------------
// GET /api/settings/subjects/:id
// subject.view
// --------------------------------------------------

router.get(
  "/:id",
  requirePermission("subject.view"),
  validateParams(subjectIdSchema),
  asyncHandler(getSubjectController),
);

// --------------------------------------------------
// POST /api/settings/subjects
// subject.create
// --------------------------------------------------

router.post(
  "/",
  requirePermission("subject.create"),
  validate(createSubjectSchema),
  asyncHandler(createSubjectController),
);

// --------------------------------------------------
// PATCH /api/settings/subjects/:id
// subject.update
// --------------------------------------------------

router.patch(
  "/:id",
  requirePermission("subject.update"),
  validateParams(subjectIdSchema),
  validate(updateSubjectSchema),
  asyncHandler(updateSubjectController),
);

// --------------------------------------------------
// DELETE /api/settings/subjects/:id
// subject.delete
// --------------------------------------------------

router.delete(
  "/:id",
  requirePermission("subject.delete"),
  validateParams(subjectIdSchema),
  asyncHandler(deleteSubjectController),
);

export default router;
