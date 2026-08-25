import { Router } from "express";
import {
  listTeachersController,
  getTeacherController,
  getTeacherStatementController,
  createTeacherController,
  updateTeacherController,
  deleteTeacherController,
  getTeacherDocumentsController,
  putTeacherDocumentController,
  deleteTeacherDocumentController,
} from "./teacher.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { ApiResponse } from "../../core/config/api-response";
import { TEACHER_DOCUMENT_TYPES } from "./document.types";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createTeacherSchema,
  updateTeacherSchema,
  teacherIdSchema,
  teacherQuerySchema,
  teacherStatementQuerySchema,
  teacherDocumentParamSchema,
  putTeacherDocumentSchema,
} from "./teacher.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("teacher.view"),
  validateQuery(teacherQuerySchema),
  asyncHandler(listTeachersController),
);

// --------------------------------------------------
// GET /api/teachers/:id/statement
//
// كشفُ حساب الأستاذ: كشوفُه في السنة بمستحقّها وما قُبض منه، ومعها
// متأخّراتُه. ويسبق `/:id` لأنّ المسار أطول — ولو تأخّر لالتقطه.
// --------------------------------------------------

router.get(
  "/:id/statement",
  requirePermission("teacher.view"),
  validateParams(teacherIdSchema),
  validateQuery(teacherStatementQuerySchema),
  asyncHandler(getTeacherStatementController),
);

/*
 * كتالوج أنواع وثائق الأستاذ — قبل /:id لأنّ "document-types" ليس معرّفاً.
 *
 * والمعروضُ في الواجهة هذا الكتالوجُ وما أضافته الإدارة معاً، فالخانات
 * الافتراضية تُقرأ من هنا ولا تُكرَّر في الواجهة.
 */
router.get(
  "/document-types",
  requirePermission("teacher.view"),
  asyncHandler(async (_req, res) => {
    return ApiResponse.success(
      res,
      { types: TEACHER_DOCUMENT_TYPES },
      "Document types retrieved",
    );
  }),
);

// --------------------------------------------------
// وثائق ملفّ الأستاذ — بصلاحيات الأستاذ نفسِها
//
// الوثائق جزءٌ من ملفّه لا مورد مستقلّ: من يعدّل بياناته يرفع وثائقه.
// وتسبق `/:id` لأنّ مسارها أطول وأدقّ.
// --------------------------------------------------

router.get(
  "/:id/documents",
  requirePermission("teacher.view"),
  validateParams(teacherIdSchema),
  asyncHandler(getTeacherDocumentsController),
);

router.put(
  "/:id/documents/:type",
  requirePermission("teacher.update"),
  validateParams(teacherDocumentParamSchema),
  validate(putTeacherDocumentSchema),
  asyncHandler(putTeacherDocumentController),
);

router.delete(
  "/:id/documents/:type",
  requirePermission("teacher.update"),
  validateParams(teacherDocumentParamSchema),
  asyncHandler(deleteTeacherDocumentController),
);

router.get(
  "/:id",
  requirePermission("teacher.view"),
  validateParams(teacherIdSchema),
  asyncHandler(getTeacherController),
);

router.post(
  "/",
  requirePermission("teacher.create"),
  validate(createTeacherSchema),
  asyncHandler(createTeacherController),
);

router.patch(
  "/:id",
  requirePermission("teacher.update"),
  validateParams(teacherIdSchema),
  validate(updateTeacherSchema),
  asyncHandler(updateTeacherController),
);

router.delete(
  "/:id",
  requirePermission("teacher.delete"),
  validateParams(teacherIdSchema),
  asyncHandler(deleteTeacherController),
);

export default router;
