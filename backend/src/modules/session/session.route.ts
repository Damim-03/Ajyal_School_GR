import { Router } from "express";
import {
  listSessionsController,
  getSessionController,
  createSessionController,
  generateSessionsController,
  updateSessionController,
  deleteSessionController,
} from "./session.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createSessionSchema,
  generateSessionsSchema,
  updateSessionSchema,
  sessionIdSchema,
  sessionQuerySchema,
} from "./session.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("session.view"),
  validateQuery(sessionQuerySchema),
  asyncHandler(listSessionsController),
);

// --------------------------------------------------
// POST /api/sessions/generate
// يسبق /:id لأن "generate" ليس معرّفاً
// --------------------------------------------------

router.post(
  "/generate",
  requirePermission("session.create"),
  validate(generateSessionsSchema),
  asyncHandler(generateSessionsController),
);

router.get(
  "/:id",
  requirePermission("session.view"),
  validateParams(sessionIdSchema),
  asyncHandler(getSessionController),
);

router.post(
  "/",
  requirePermission("session.create"),
  validate(createSessionSchema),
  asyncHandler(createSessionController),
);

router.patch(
  "/:id",
  requirePermission("session.update"),
  validateParams(sessionIdSchema),
  validate(updateSessionSchema),
  asyncHandler(updateSessionController),
);

router.delete(
  "/:id",
  requirePermission("session.delete"),
  validateParams(sessionIdSchema),
  asyncHandler(deleteSessionController),
);

export default router;
