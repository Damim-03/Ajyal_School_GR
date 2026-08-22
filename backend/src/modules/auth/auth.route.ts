import { Router } from "express";
import {
  loginController,
  refreshTokenController,
  logoutController,
  getMeController,
  listProfilesController,
} from "./auth.controller";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { validate } from "../../core/middleware/validate.middleware";
import { loginLimiter, profilesLimiter } from "../../core/middleware/rate-limit.middleware";
import { loginSchema } from "./auth.schema";

const router = Router();

// --------------------------------------------------
// POST /api/auth/login
// Public — 10 محاولات فاشلة لكل 15 دقيقة
// --------------------------------------------------

router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  asyncHandler(loginController),
);

// --------------------------------------------------
// POST /api/auth/refresh
// Public — refreshToken من Cookie
// --------------------------------------------------

router.post("/refresh", asyncHandler(refreshTokenController));

// --------------------------------------------------
// POST /api/auth/logout
// Protected
// --------------------------------------------------

router.post("/logout", authMiddleware, asyncHandler(logoutController));

// --------------------------------------------------
// GET /api/auth/me
// Protected
// --------------------------------------------------

router.get("/me", authMiddleware, asyncHandler(getMeController));

// --------------------------------------------------
// GET /api/auth/profiles
// Public — بطاقاتُ شاشة اختيار المستخدم
//
// عامٌّ بقرارٍ صريح: الشاشة تُعرض قبل أن يُصادَق أحد. ولذلك لا يُرجع
// اسمَ الدخول ولا بريداً ولا دوراً — معرّفٌ واسمُ عرضٍ وصورة فقط.
// وعليه محدِّدُ معدّلٍ خاصّ يعدّ الطلبَ الناجح — لأنّ هذا ينجح دائماً.
// --------------------------------------------------

router.get("/profiles", profilesLimiter, asyncHandler(listProfilesController));

export default router;
