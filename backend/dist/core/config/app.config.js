"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const get_env_1 = require("../utils/get-env");
const appConfig = () => ({
    NODE_ENV: (0, get_env_1.getEnv)("NODE_ENV", "development"),
    PORT: Number(process.env.PORT) || 3001,
    BASE_PATH: (0, get_env_1.getEnv)("BASE_PATH", "/api"),
    DATABASE_URL: process.env.DATABASE_URL,
    // --------------------------------------------------
    // JWT
    // Access token: قصير العمر (15 دقيقة)
    // Refresh token: طويل العمر (7 أيام)
    // --------------------------------------------------
    JWT_ACCESS_SECRET: (0, get_env_1.getEnv)("JWT_ACCESS_SECRET", "school_access_secret_change_in_prod"),
    JWT_REFRESH_SECRET: (0, get_env_1.getEnv)("JWT_REFRESH_SECRET", "school_refresh_secret_change_in_prod"),
    JWT_ACCESS_EXPIRES_IN: (0, get_env_1.getEnv)("JWT_ACCESS_EXPIRES_IN", "15m"),
    JWT_REFRESH_EXPIRES_IN: (0, get_env_1.getEnv)("JWT_REFRESH_EXPIRES_IN", "7d"),
    // --------------------------------------------------
    // CORS — Tauri desktop app
    // --------------------------------------------------
    FRONTEND_ORIGIN: (0, get_env_1.getEnv)("FRONTEND_ORIGIN", "tauri://localhost"),
});
exports.config = appConfig();
//# sourceMappingURL=app.config.js.map