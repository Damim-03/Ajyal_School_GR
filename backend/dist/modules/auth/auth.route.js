"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const async_handler_middleware_1 = require("../../core/middleware/async-handler.middleware");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const validate_middleware_1 = require("../../core/middleware/validate.middleware");
const rate_limit_middleware_1 = require("../../core/middleware/rate-limit.middleware");
const auth_schema_1 = require("./auth.schema");
const router = (0, express_1.Router)();
// --------------------------------------------------
// POST /api/auth/login
// Public — 10 محاولات فاشلة لكل 15 دقيقة
// --------------------------------------------------
router.post("/login", rate_limit_middleware_1.loginLimiter, (0, validate_middleware_1.validate)(auth_schema_1.loginSchema), (0, async_handler_middleware_1.asyncHandler)(auth_controller_1.loginController));
// --------------------------------------------------
// POST /api/auth/refresh
// Public — refreshToken من Cookie
// --------------------------------------------------
router.post("/refresh", (0, async_handler_middleware_1.asyncHandler)(auth_controller_1.refreshTokenController));
// --------------------------------------------------
// POST /api/auth/logout
// Protected
// --------------------------------------------------
router.post("/logout", auth_middleware_1.authMiddleware, (0, async_handler_middleware_1.asyncHandler)(auth_controller_1.logoutController));
// --------------------------------------------------
// GET /api/auth/me
// Protected
// --------------------------------------------------
router.get("/me", auth_middleware_1.authMiddleware, (0, async_handler_middleware_1.asyncHandler)(auth_controller_1.getMeController));
// --------------------------------------------------
// GET /api/auth/profiles
// Public — بطاقاتُ شاشة اختيار المستخدم
//
// عامٌّ بقرارٍ صريح: الشاشة تُعرض قبل أن يُصادَق أحد. ولذلك لا يُرجع
// اسمَ الدخول ولا بريداً ولا دوراً — معرّفٌ واسمُ عرضٍ وصورة فقط.
// وعليه محدِّدُ معدّلٍ خاصّ يعدّ الطلبَ الناجح — لأنّ هذا ينجح دائماً.
// --------------------------------------------------
router.get("/profiles", rate_limit_middleware_1.profilesLimiter, (0, async_handler_middleware_1.asyncHandler)(auth_controller_1.listProfilesController));
exports.default = router;
//# sourceMappingURL=auth.route.js.map