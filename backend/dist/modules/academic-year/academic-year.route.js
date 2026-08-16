"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const academic_year_controller_1 = require("./academic-year.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const academic_year_schema_1 = require("./academic-year.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, permission_middleware_1.requirePermission)("academic-year.view"), (0, validate_middleware_1.validateQuery)(academic_year_schema_1.academicYearQuerySchema), (0, async_handler_middleware_1.asyncHandler)(academic_year_controller_1.listAcademicYearsController));
router.get("/:id", (0, permission_middleware_1.requirePermission)("academic-year.view"), (0, validate_middleware_1.validateParams)(academic_year_schema_1.academicYearIdSchema), (0, async_handler_middleware_1.asyncHandler)(academic_year_controller_1.getAcademicYearController));
router.post("/", (0, permission_middleware_1.requirePermission)("academic-year.create"), (0, validate_middleware_1.validate)(academic_year_schema_1.createAcademicYearSchema), (0, async_handler_middleware_1.asyncHandler)(academic_year_controller_1.createAcademicYearController));
router.patch("/:id", (0, permission_middleware_1.requirePermission)("academic-year.update"), (0, validate_middleware_1.validateParams)(academic_year_schema_1.academicYearIdSchema), (0, validate_middleware_1.validate)(academic_year_schema_1.updateAcademicYearSchema), (0, async_handler_middleware_1.asyncHandler)(academic_year_controller_1.updateAcademicYearController));
router.delete("/:id", (0, permission_middleware_1.requirePermission)("academic-year.delete"), (0, validate_middleware_1.validateParams)(academic_year_schema_1.academicYearIdSchema), (0, async_handler_middleware_1.asyncHandler)(academic_year_controller_1.deleteAcademicYearController));
exports.default = router;
//# sourceMappingURL=academic-year.route.js.map