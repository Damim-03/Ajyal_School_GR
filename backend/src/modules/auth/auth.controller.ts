import { Request, Response } from "express";
import {
  loginService,
  refreshTokenService,
  getMeService,
  listProfilesService,
} from "./auth.service";
import { HTTPSTATUS } from "../../core/config/http.config";
import { UnauthorizedException } from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { LoginInput } from "./auth.schema";
import { refreshCookieOptions } from "./auth.cookie";

// --------------------------------------------------
// Login
// POST /api/auth/login
// --------------------------------------------------

export const loginController = async (req: Request, res: Response) => {
  const body = req.body as LoginInput;

  const { user, accessToken, refreshToken } = await loginService(body);

  // refreshToken في Cookie آمن
  res.cookie("refreshToken", refreshToken, refreshCookieOptions(req));

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

export const logoutController = async (req: Request, res: Response) => {
  /*
   * المسحُ يجب أن يحمل نفس السمات التي كُتب بها.
   *
   * المتصفّح يطابق الكوكي بـ(الاسم + المسار + النطاق)، ويرفض كتابةَ
   * كوكي `SameSite=None` بلا `Secure` — فمسحٌ بالمسار وحده كان
   * يُهمَل صامتاً في الإنتاج ويبقى refreshToken حيّاً بعد الخروج.
   */
  const { maxAge: _maxAge, ...clearOptions } = refreshCookieOptions(req);

  res.clearCookie("refreshToken", clearOptions);

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

/**
 * GET /api/auth/profiles — عامّ.
 *
 * لا `asyncHandler` حول منطقٍ إضافي: القراءةُ واحدة، والخطأ يبلغ
 * معالجَ الأخطاء العامّ كما في بقيّة المسارات.
 */
export const listProfilesController = async (_req: Request, res: Response) => {
  const profiles = await listProfilesService();

  res.status(HTTPSTATUS.OK).json({
    success: true,
    data: { profiles },
  });
};
