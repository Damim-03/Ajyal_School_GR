"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const school_controller_1 = require("./school.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const permission_middleware_1 = require("../../core/middleware/permission.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const school_schema_1 = require("./school.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
/*
 * القراءة بالمصادقة وحدها — بلا صلاحية.
 *
 * هويّة المدرسة ليست بياناتٍ حسّاسة بل **علامة التطبيق نفسه**: تصبغ
 * الترويسة وشاشة الإقلاع وتُطبع على كل إيصال. واشتراط `settings.view`
 * يعني أنّ الأمانة — ولا تملكها — تفتح تطبيقاً بلا اسم ولا لون.
 * كشفه الفحص: القراءة كانت تُردّ بـ 403 لدور SECRETARY.
 *
 * الكتابة وحدها هي ما يحتاج صلاحية.
 */
router.get("/", (0, async_handler_middleware_1.asyncHandler)(school_controller_1.getSchoolController));
router.patch("/", (0, permission_middleware_1.requirePermission)("settings.update"), (0, validate_middleware_1.validate)(school_schema_1.updateSchoolSchema), (0, async_handler_middleware_1.asyncHandler)(school_controller_1.updateSchoolController));
router.post("/reset", (0, permission_middleware_1.requirePermission)("settings.update"), (0, validate_middleware_1.validate)(school_schema_1.resetSchoolSchema), (0, async_handler_middleware_1.asyncHandler)(school_controller_1.resetSchoolController));
exports.default = router;
//# sourceMappingURL=school.route.js.map