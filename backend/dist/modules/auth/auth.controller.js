"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProfilesController = exports.getMeController = exports.logoutController = exports.refreshTokenController = exports.loginController = void 0;
const auth_service_1 = require("./auth.service");
const http_config_1 = require("../../core/config/http.config");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
// --------------------------------------------------
// Cookie options — refreshToken
// --------------------------------------------------
/*
 * SameSite في الإنتاج `none` لا `strict`.
 *
 * في التطوير يكون الخادم والواجهة على localhost فالسياق موقعٌ واحد
 * و`strict` أمتنُ ما يمكن. أمّا في الإنتاج فأصل النافذة
 * `tauri://localhost` (أو `http://tauri.localhost` على ويندوز)
 * والخادمُ على نطاقٍ آخر — سياقٌ عابر للمواقع، و`strict` يعني أنّ
 * المتصفّح لا يخزّن الكوكي أصلاً ولا يرسله.
 *
 * والعرَض مضلِّل: الدخول ينجح لأنّ accessToken يعود في جسم
 * الاستجابة، ثمّ بعد انقضائه تفشل /auth/refresh فيَطرد المعترضُ
 * المستخدمَ — خروجٌ مفاجئ بعد ربع ساعةٍ من عملٍ سليم ظاهرياً.
 *
 * و`none` يوجب `Secure` أي HTTPS، وهو مضمونٌ في الإنتاج وحده،
 * فالشرطان مقترنان بنفس الرايةِ عمداً.
 */
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true, // لا يمكن الوصول إليه من JavaScript
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? "none" : "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 أيام بالـ ms
    path: "/api/auth/refresh", // Cookie متاح فقط لهذا المسار
};
// --------------------------------------------------
// Login
// POST /api/auth/login
// --------------------------------------------------
const loginController = async (req, res) => {
    const body = req.body;
    const { user, accessToken, refreshToken } = await (0, auth_service_1.loginService)(body);
    // refreshToken في Cookie آمن
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
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
const logoutController = async (_req, res) => {
    /*
     * المسحُ يجب أن يحمل نفس السمات التي كُتب بها.
     *
     * المتصفّح يطابق الكوكي بـ(الاسم + المسار + النطاق)، ويرفض كتابةَ
     * كوكي `SameSite=None` بلا `Secure` — فمسحٌ بالمسار وحده كان
     * يُهمَل صامتاً في الإنتاج ويبقى refreshToken حيّاً بعد الخروج.
     */
    const { maxAge: _maxAge, ...clearOptions } = REFRESH_COOKIE_OPTIONS;
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