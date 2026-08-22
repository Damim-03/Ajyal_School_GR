import { Router } from "express";
import {
  listStudentsController,
  getStudentController,
  getStudentEnrollmentsController,
  getStudentStatementController,
  createStudentController,
  updateStudentController,
  deleteStudentController,
  getDocumentsController,
  putDocumentController,
  deleteDocumentController,
} from "./student.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { ApiResponse } from "../../core/config/api-response";
import { DOCUMENT_TYPES, REQUIRED_KEYS } from "./document.types";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import {
  createStudentSchema,
  updateStudentSchema,
  studentIdSchema,
  studentQuerySchema,
  studentEnrollmentQuerySchema,
  studentStatementQuerySchema,
  documentTypeParamSchema,
  putDocumentSchema,
} from "./student.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("student.view"),
  validateQuery(studentQuerySchema),
  asyncHandler(listStudentsController),
);

// --------------------------------------------------
// GET /api/students/:id/enrollments
// يسبق /:id في التعريف ليس ضرورياً (المسار أطول وأدق)،
// لكن الصلاحية مختلفة: بيانات تسجيل لا بيانات طالب.
// --------------------------------------------------

router.get(
  "/:id/enrollments",
  requirePermission("enrollment.view"),
  validateParams(studentIdSchema),
  validateQuery(studentEnrollmentQuerySchema),
  asyncHandler(getStudentEnrollmentsController),
);

// --------------------------------------------------
// GET /api/students/:id/statement
//
// كشفُ حساب الطالب: سطرٌ لكلّ (مادة × كشف شهر) بحضوره وحقّه وإيصاله.
// الصلاحية `student.view` — الورقة تُقرأ في شبّاك الاستقبال حيث يسأل
// الوليّ، لا في المالية وحدها.
// --------------------------------------------------

router.get(
  "/:id/statement",
  requirePermission("student.view"),
  validateParams(studentIdSchema),
  validateQuery(studentStatementQuerySchema),
  asyncHandler(getStudentStatementController),
);

/*
 * كتالوج أنواع الوثائق — قبل /:id لأنّ "document-types" ليس معرّفاً.
 *
 * تقرؤه الواجهة لتبني خانات الرفع وشارات الاكتمال، فلا تُكرَّر قائمة
 * الأنواع في مكانين يفترقان عند أوّل تعديل.
 */
router.get(
  "/document-types",
  requirePermission("student.view"),
  asyncHandler(async (_req, res) => {
    return ApiResponse.success(
      res,
      { types: DOCUMENT_TYPES, requiredKeys: REQUIRED_KEYS },
      "Document types retrieved",
    );
  }),
);

// --------------------------------------------------
// وثائق ملف الطالب — تسبق /:id لأنّ مسارها أطول وأدقّ
//
// بصلاحيات الطالب نفسها: الوثائق جزء من ملفّه لا مورد مستقلّ،
// ومَن يعدّل بياناته يرفع وثائقه.
// --------------------------------------------------

router.get(
  "/:id/documents",
  requirePermission("student.view"),
  validateParams(studentIdSchema),
  asyncHandler(getDocumentsController),
);

router.put(
  "/:id/documents/:type",
  requirePermission("student.update"),
  validateParams(documentTypeParamSchema),
  validate(putDocumentSchema),
  asyncHandler(putDocumentController),
);

router.delete(
  "/:id/documents/:type",
  requirePermission("student.update"),
  validateParams(documentTypeParamSchema),
  asyncHandler(deleteDocumentController),
);

router.get(
  "/:id",
  requirePermission("student.view"),
  validateParams(studentIdSchema),
  asyncHandler(getStudentController),
);

router.post(
  "/",
  requirePermission("student.create"),
  validate(createStudentSchema),
  asyncHandler(createStudentController),
);

router.patch(
  "/:id",
  requirePermission("student.update"),
  validateParams(studentIdSchema),
  validate(updateStudentSchema),
  asyncHandler(updateStudentController),
);

router.delete(
  "/:id",
  requirePermission("student.delete"),
  validateParams(studentIdSchema),
  asyncHandler(deleteStudentController),
);

export default router;
