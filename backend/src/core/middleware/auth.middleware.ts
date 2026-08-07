import { Request, Response, NextFunction } from "express";
import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { prisma } from "../prisma/client";
import { config } from "../config/app.config";
import { JwtPayload } from "../../types/auth.types";
import { HTTPSTATUS } from "../config/http.config";

// --------------------------------------------------
// Auth Middleware
// يتحقق من JWT ويربط بيانات المستخدم بالـ request
//
// يدعم:
//   - Desktop (Tauri) → Authorization: Bearer <token>
//   - Mobile / Web   → Cookie: accessToken=<token>
// --------------------------------------------------

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // --------------------------------------------------
  // 1. استخراج التوكن
  // --------------------------------------------------

  let token: string | undefined;

  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    // Desktop / Mobile → Authorization header
    token = authHeader.substring(7);
  } else {
    // Web → Cookie
    token = req.cookies?.accessToken;
  }

  if (!token) {
    return res.status(HTTPSTATUS.UNAUTHORIZED).json({
      message: "Unauthorized: no token provided",
    });
  }

  // --------------------------------------------------
  // 2. التحقق من التوكن
  // --------------------------------------------------

  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as JwtPayload;

    // --------------------------------------------------
    // 3. التحقق من المستخدم في قاعدة البيانات
    //    نجلب roleId و roleName من relation Role
    //    ونتحقق من isActive (مطابق لـ schema)
    // --------------------------------------------------

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        isActive: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(HTTPSTATUS.UNAUTHORIZED).json({
        message: "Unauthorized: user not found",
      });
    }

    // isActive بدل status — مطابق للـ schema
    if (!user.isActive) {
      return res.status(HTTPSTATUS.FORBIDDEN).json({
        message: "Your account has been suspended",
      });
    }

    // --------------------------------------------------
    // 4. تعليق بيانات المستخدم على الـ request
    // --------------------------------------------------

    req.user = {
      userId: user.id,
      roleId: user.role.id,
      roleName: user.role.name,
    };

    return next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return res.status(HTTPSTATUS.UNAUTHORIZED).json({
        message: "Token expired",
      });
    }

    if (error instanceof JsonWebTokenError) {
      return res.status(HTTPSTATUS.UNAUTHORIZED).json({
        message: "Invalid token",
      });
    }

    return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
      message: "Authentication failed",
    });
  }
};
