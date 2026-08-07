"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importStar(require("jsonwebtoken"));
const client_1 = require("../prisma/client");
const app_config_1 = require("../config/app.config");
const http_config_1 = require("../config/http.config");
// --------------------------------------------------
// Auth Middleware
// يتحقق من JWT ويربط بيانات المستخدم بالـ request
//
// يدعم:
//   - Desktop (Tauri) → Authorization: Bearer <token>
//   - Mobile / Web   → Cookie: accessToken=<token>
// --------------------------------------------------
const authMiddleware = async (req, res, next) => {
    // --------------------------------------------------
    // 1. استخراج التوكن
    // --------------------------------------------------
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        // Desktop / Mobile → Authorization header
        token = authHeader.substring(7);
    }
    else {
        // Web → Cookie
        token = req.cookies?.accessToken;
    }
    if (!token) {
        return res.status(http_config_1.HTTPSTATUS.UNAUTHORIZED).json({
            message: "Unauthorized: no token provided",
        });
    }
    // --------------------------------------------------
    // 2. التحقق من التوكن
    // --------------------------------------------------
    try {
        const decoded = jsonwebtoken_1.default.verify(token, app_config_1.config.JWT_ACCESS_SECRET);
        // --------------------------------------------------
        // 3. التحقق من المستخدم في قاعدة البيانات
        //    نجلب roleId و roleName من relation Role
        //    ونتحقق من isActive (مطابق لـ schema)
        // --------------------------------------------------
        const user = await client_1.prisma.user.findUnique({
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
            return res.status(http_config_1.HTTPSTATUS.UNAUTHORIZED).json({
                message: "Unauthorized: user not found",
            });
        }
        // isActive بدل status — مطابق للـ schema
        if (!user.isActive) {
            return res.status(http_config_1.HTTPSTATUS.FORBIDDEN).json({
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
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.TokenExpiredError) {
            return res.status(http_config_1.HTTPSTATUS.UNAUTHORIZED).json({
                message: "Token expired",
            });
        }
        if (error instanceof jsonwebtoken_1.JsonWebTokenError) {
            return res.status(http_config_1.HTTPSTATUS.UNAUTHORIZED).json({
                message: "Invalid token",
            });
        }
        return res.status(http_config_1.HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
            message: "Authentication failed",
        });
    }
};
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=auth.middleware.js.map