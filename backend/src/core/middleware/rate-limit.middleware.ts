import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { ErrorCodeEnum, ErrorCodeEnumType } from "../enums/error-code.enum";

// --------------------------------------------------
// Rate limiting
//
// الرد يُرسل JSON بنفس شكل باقي الأخطاء
// ({ message, errorCode })، وإلا فشل الفرونت في
// تحليله وأظهر خطأً غامضاً بدل رسالة مفهومة.
// --------------------------------------------------

const jsonHandler =
  (message: string, errorCode: ErrorCodeEnumType) =>
  (_req: Request, res: Response) =>
    res.status(HTTPSTATUS.TOO_MANY_REQUESTS).json({ message, errorCode });

// --------------------------------------------------
// الحدّ العام
//
// تطبيق سطح المكتب يُصدر عشرات الطلبات لكل شاشة،
// وكل أجهزة الشبكة المحلية تتشارك IP واحداً خلف NAT،
// فالحدّ المنخفض يحجب مستخدمين شرعيين.
// --------------------------------------------------

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler(
    "Too many requests, please try again later",
    ErrorCodeEnum.ACCESS_FORBIDDEN,
  ),
});

// --------------------------------------------------
// حدّ تسجيل الدخول
//
// هذا هو الغرض الحقيقي من التحديد: إبطاء تخمين
// كلمات المرور. المحاولات الناجحة لا تُحتسب، فمن
// يدخل بشكل سليم لا يُحجب أبداً.
// --------------------------------------------------

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler(
    "Too many login attempts, please try again in 15 minutes",
    ErrorCodeEnum.AUTH_TOO_MANY_ATTEMPTS,
  ),
});
