import { Request, Response } from "express";
import {
  loginService,
  refreshTokenService,
  getMeService,
} from "./auth.service";
import { HTTPSTATUS } from "../../core/config/http.config";
import { UnauthorizedException } from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { LoginInput } from "./auth.schema";

// --------------------------------------------------
// Cookie options — refreshToken
// --------------------------------------------------

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true, // لا يمكن الوصول إليه من JavaScript
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 أيام بالـ ms
  path: "/api/auth/refresh", // Cookie متاح فقط لهذا المسار
};

// --------------------------------------------------
// Login
// POST /api/auth/login
// --------------------------------------------------

export const loginController = async (req: Request, res: Response) => {
  const body = req.body as LoginInput;

  const { user, accessToken, refreshToken } = await loginService(body);

  // refreshToken في Cookie آمن
  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

  return res.status(HTTPSTATUS.OK).json({
    success: true,
    message: "Login successful",
    data: {
      user,
      accessToken,
    },
  });
};

// --------------------------------------------------
// Refresh Token
// POST /api/auth/refresh
// --------------------------------------------------

export const refreshTokenController = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  if (!refreshToken) {
    throw new UnauthorizedException(
      "Refresh token not found",
      ErrorCodeEnum.AUTH_TOKEN_NOT_FOUND,
    );
  }

  const { accessToken } = await refreshTokenService(refreshToken);

  return res.status(HTTPSTATUS.OK).json({
    success: true,
    message: "Token refreshed",
    data: { accessToken },
  });
};

// --------------------------------------------------
// Logout
// POST /api/auth/logout
// --------------------------------------------------

export const logoutController = async (_req: Request, res: Response) => {
  // نمسح الـ Cookie
  res.clearCookie("refreshToken", {
    path: "/api/auth/refresh",
  });

  return res.status(HTTPSTATUS.OK).json({
    success: true,
    message: "Logged out successfully",
  });
};

// --------------------------------------------------
// Me
// GET /api/auth/me
// --------------------------------------------------

export const getMeController = async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const user = await getMeService(userId);

  return res.status(HTTPSTATUS.OK).json({
    success: true,
    message: "User retrieved",
    data: { user },
  });
};
