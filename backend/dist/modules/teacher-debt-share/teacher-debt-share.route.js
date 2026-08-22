"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const teacher_debt_share_controller_1 = require("./teacher-debt-share.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const teacher_debt_share_schema_1 = require("./teacher-debt-share.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
/*
 * الحصة تُنشئها واقعةُ التحصيل نفسها — لا مسارَ لإنشائها يدوياً:
 * مالٌ يُقبض من طالبٍ هو ما يُنشئها، فلا تُختلق بلا قبض.
 */
router.get("/", (0, permission_middleware_1.requirePermission)("teacher-payment.view"), (0, validate_middleware_1.validateQuery)(teacher_debt_share_schema_1.debtShareQuerySchema), (0, async_handler_middleware_1.asyncHandler)(teacher_debt_share_controller_1.listDebtSharesController));
router.patch("/:id/cancel", (0, permission_middleware_1.requirePermission)("teacher-payment.cancel"), (0, validate_middleware_1.validateParams)(teacher_debt_share_schema_1.debtShareIdSchema), (0, validate_middleware_1.validate)(teacher_debt_share_schema_1.cancelDebtShareSchema), (0, async_handler_middleware_1.asyncHandler)(teacher_debt_share_controller_1.cancelDebtShareController));
exports.default = router;
//# sourceMappingURL=teacher-debt-share.route.js.map