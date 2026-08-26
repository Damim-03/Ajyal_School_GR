"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProfilesController = exports.getMeController = exports.logoutController = exports.refreshTokenController = exports.loginController = void 0;
const auth_service_1 = require("./auth.service");
const http_config_1 = require("../../core/config/http.config");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const auth_cookie_1 = require("./auth.cookie");
// --------------------------------------------------
// Login
// POST /api/auth/login
// --------------------------------------------------
const loginController = async (req, res) => {
    const body = req.body;
    const { user, accessToken, refreshToken } = await (0, auth_service_1.loginService)(body);
    // refreshToken في Cookie آمن
    res.cookie("refreshToken", refreshToken, (0, auth_cookie_1.refreshCookieOptions)(req));
    return res.status(http_config_1.HTTPSTATUS.OK).json({
        success: true,
        message: "Login successful",
        data: {
            user,
            accessToken,
        },
    });
};
exports.loginController = loginController;
// --------------------------------------------------
// Refresh Token
// POST /api/auth/refresh
// --------------------------------------------------
const refreshTokenController = async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        throw new app_errors_1.UnauthorizedException("Refresh token not found", error_code_enum_1.ErrorCodeEnum.AUTH_TOKEN_NOT_FOUND);
    }
    const { accessToken } = await (0, auth_service_1.refreshTokenService)(refreshToken);
    return res.status(http_config_1.HTTPSTATUS.OK).json({
        success: true,
        message: "Token refreshed",
        data: { accessToken },
    });
};
exports.refreshTokenController = refreshTokenController;
// --------------------------------------------------
// Logout
// POST /api/auth/logout
// --------------------------------------------------
const logoutController = async (req, res) => {
    /*
     * المسحُ يجب أن يحمل نفس السمات التي كُتب بها.
     *
     * المتصفّح يطابق الكوكي بـ(الاسم + المسار + النطاق)، ويرفض كتابةَ
     * كوكي `SameSite=None` بلا `Secure` — فمسحٌ بالمسار وحده كان
     * يُهمَل صامتاً في الإنتاج ويبقى refreshToken حيّاً بعد الخروج.
     */
    const { maxAge: _maxAge, ...clearOptions } = (0, auth_cookie_1.refreshCookieOptions)(req);
    res.clearCookie("refreshToken", clearOptions);
    return res.status(http_config_1.HTTPSTATUS.OK).json({
        success: true,
        message: "Logged out successfully",
    });
};
exports.logoutController = logoutController;
// --------------------------------------------------
// Me
// GET /api/auth/me
// --------------------------------------------------
const getMeController = async (req, res) => {
    const userId = req.user.userId;
    const user = await (0, auth_service_1.getMeService)(userId);
    return res.status(http_config_1.HTTPSTATUS.OK).json({
        success: true,
        message: "User retrieved",
        data: { user },
    });
};
exports.getMeController = getMeController;
/**
 * GET /api/auth/profiles — عامّ.
 *
 * لا `asyncHandler` حول منطقٍ إضافي: القراءةُ واحدة، والخطأ يبلغ
 * معالجَ الأخطاء العامّ كما في بقيّة المسارات.
 */
const listProfilesController = async (_req, res) => {
    const profiles = await (0, auth_service_1.listProfilesService)();
    res.status(http_config_1.HTTPSTATUS.OK).json({
        success: true,
        data: { profiles },
    });
};
exports.listProfilesController = listProfilesController;
//# sourceMappingURL=auth.controller.js.map