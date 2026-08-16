import { Router } from "express";
import {
  listUsersController,
  getUserController,
  createUserController,
  updateUserController,
  deleteUserController,
} from "./user.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createUserSchema,
  updateUserSchema,
  userIdSchema,
  userQuerySchema,
} from "./user.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("user.view"),
  validateQuery(userQuerySchema),
  asyncHandler(listUsersController),
);

router.get(
  "/:id",
  requirePermission("user.view"),
  validateParams(userIdSchema),
  asyncHandler(getUserController),
);

router.post(
  "/",
  requirePermission("user.create"),
  validate(createUserSchema),
  asyncHandler(createUserController),
);

router.patch(
  "/:id",
  requirePermission("user.update"),
  validateParams(userIdSchema),
  validate(updateUserSchema),
  asyncHandler(updateUserController),
);

router.delete(
  "/:id",
  requirePermission("user.delete"),
  validateParams(userIdSchema),
  asyncHandler(deleteUserController),
);

export default router;
