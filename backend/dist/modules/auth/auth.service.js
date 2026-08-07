"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMeService = exports.refreshTokenService = exports.loginService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_config_1 = require("../../core/config/app.config");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const client_1 = require("../../core/prisma/client");
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const generateAccessToken = (payload) => jsonwebtoken_1.default.sign(payload, app_config_1.config.JWT_ACCESS_SECRET, {
    expiresIn: app_config_1.config.JWT_ACCESS_EXPIRES_IN,
});
const generateRefreshToken = (payload) => jsonwebtoken_1.default.sign(payload, app_config_1.config.JWT_REFRESH_SECRET, {
    expiresIn: app_config_1.config.JWT_REFRESH_EXPIRES_IN,
});
// --------------------------------------------------
// User select — نفس الحقول في كل مكان
// --------------------------------------------------
const userSelect = {
    id: true,
    username: true,
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    avatar: true,
    isActive: true,
    lastLoginAt: true,
    role: {
        select: {
            id: true,
            name: true,
        },
    },
};
// --------------------------------------------------
// Login
// --------------------------------------------------
const loginService = async (body) => {
    const { username, password } = body;
    // 1. البحث عن المستخدم
    const user = await client_1.prisma.user.findUnique({
        where: { username },
        select: {
            ...userSelect,
            password: true, // نحتاجه للمقارنة فقط
        },
    });
    if (!user) {
        throw new app_errors_1.UnauthorizedException("Invalid username or password", error_code_enum_1.ErrorCodeEnum.AUTH_INVALID_CREDENTIALS);
    }
    // 2. التحقق من الحساب
    if (!user.isActive) {
        throw new app_errors_1.UnauthorizedException("Your account has been suspended", error_code_enum_1.ErrorCodeEnum.AUTH_ACCOUNT_SUSPENDED);
    }
    // 3. التحقق من كلمة المرور
    const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
    if (!isPasswordValid) {
        throw new app_errors_1.UnauthorizedException("Invalid username or password", error_code_enum_1.ErrorCodeEnum.AUTH_INVALID_CREDENTIALS);
    }
    // 4. توليد التوكنات
    const tokenPayload = {
        userId: user.id,
        roleId: user.role.id,
        roleName: user.role.name,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ userId: user.id });
    // 5. تحديث lastLoginAt
    await client_1.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });
    // 6. إرجاع البيانات بدون password
    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, accessToken, refreshToken };
};
exports.loginService = loginService;
// --------------------------------------------------
// Refresh Token
// --------------------------------------------------
const refreshTokenService = async (refreshToken) => {
    // 1. التحقق من الـ refresh token
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(refreshToken, app_config_1.config.JWT_REFRESH_SECRET);
    }
    catch {
        throw new app_errors_1.UnauthorizedException("Invalid or expired refresh token", error_code_enum_1.ErrorCodeEnum.AUTH_INVALID_TOKEN);
    }
    // 2. التحقق من المستخدم
    const user = await client_1.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: userSelect,
    });
    if (!user) {
        throw new app_errors_1.NotFoundException("User not found", error_code_enum_1.ErrorCodeEnum.AUTH_USER_NOT_FOUND);
    }
    if (!user.isActive) {
        throw new app_errors_1.UnauthorizedException("Your account has been suspended", error_code_enum_1.ErrorCodeEnum.AUTH_ACCOUNT_SUSPENDED);
    }
    // 3. توليد access token جديد
    const accessToken = generateAccessToken({
        userId: user.id,
        roleId: user.role.id,
        roleName: user.role.name,
    });
    return { accessToken };
};
exports.refreshTokenService = refreshTokenService;
// --------------------------------------------------
// Me
// --------------------------------------------------
const getMeService = async (userId) => {
    const user = await client_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            ...userSelect,
            role: {
                select: {
                    id: true,
                    name: true,
                    permissions: {
                        select: {
                            permission: {
                                select: {
                                    name: true,
                                    module: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!user) {
        throw new app_errors_1.NotFoundException("User not found", error_code_enum_1.ErrorCodeEnum.AUTH_USER_NOT_FOUND);
    }
    // نُسطّح الـ permissions لقائمة بسيطة
    const permissions = user.role.permissions.map((rp) => rp.permission.name);
    return { ...user, permissions };
};
exports.getMeService = getMeService;
//# sourceMappingURL=auth.service.js.map