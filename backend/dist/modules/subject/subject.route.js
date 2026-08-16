"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const subject_controller_1 = require("./subject.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const subject_schema_1 = require("./subject.schema");
const router = (0, express_1.Router)();
// كل المسارات محمية
router.use(auth_middleware_1.authMiddleware);
// --------------------------------------------------
// GET /api/settings/subjects
// subject.view
// --------------------------------------------------
router.get("/", (0, permission_middleware_1.requirePermission)("subject.view"), (0, validate_middleware_1.validateQuery)(subject_schema_1.subjectQuerySchema), (0, async_handler_middleware_1.asyncHandler)(subject_controller_1.listSubjectsController));
// --------------------------------------------------
// GET /api/settings/subjects/:id
// subject.view
// --------------------------------------------------
router.get("/:id", (0, permission_middleware_1.requirePermission)("subject.view"), (0, validate_middleware_1.validateParams)(subject_schema_1.subjectIdSchema), (0, async_handler_middleware_1.asyncHandler)(subject_controller_1.getSubjectController));
// --------------------------------------------------
// POST /api/settings/subjects
// subject.create
// --------------------------------------------------
router.post("/", (0, permission_middleware_1.requirePermission)("subject.create"), (0, validate_middleware_1.validate)(subject_schema_1.createSubjectSchema), (0, async_handler_middleware_1.asyncHandler)(subject_controller_1.createSubjectController));
// --------------------------------------------------
// PATCH /api/settings/subjects/:id
// subject.update
// --------------------------------------------------
router.patch("/:id", (0, permission_middleware_1.requirePermission)("subject.update"), (0, validate_middleware_1.validateParams)(subject_schema_1.subjectIdSchema), (0, validate_middleware_1.validate)(subject_schema_1.updateSubjectSchema), (0, async_handler_middleware_1.asyncHandler)(subject_controller_1.updateSubjectController));
// --------------------------------------------------
// DELETE /api/settings/subjects/:id
// subject.delete
// --------------------------------------------------
router.delete("/:id", (0, permission_middleware_1.requirePermission)("subject.delete"), (0, validate_middleware_1.validateParams)(subject_schema_1.subjectIdSchema), (0, async_handler_middleware_1.asyncHandler)(subject_controller_1.deleteSubjectController));
exports.default = router;
//# sourceMappingURL=subject.route.js.map