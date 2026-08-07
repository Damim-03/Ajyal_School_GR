import { getEnv } from "../utils/get-env";

const appConfig = () => ({
  NODE_ENV: getEnv("NODE_ENV", "development"),

  PORT: Number(process.env.PORT) || 3001,

  BASE_PATH: getEnv("BASE_PATH", "/api"),

  DATABASE_URL: process.env.DATABASE_URL,

  // --------------------------------------------------
  // JWT
  // Access token: قصير العمر (15 دقيقة)
  // Refresh token: طويل العمر (7 أيام)
  // --------------------------------------------------
  JWT_ACCESS_SECRET: getEnv(
    "JWT_ACCESS_SECRET",
    "school_access_secret_change_in_prod",
  ),
  JWT_REFRESH_SECRET: getEnv(
    "JWT_REFRESH_SECRET",
    "school_refresh_secret_change_in_prod",
  ),
  JWT_ACCESS_EXPIRES_IN: getEnv("JWT_ACCESS_EXPIRES_IN", "15m"),
  JWT_REFRESH_EXPIRES_IN: getEnv("JWT_REFRESH_EXPIRES_IN", "7d"),

  // --------------------------------------------------
  // CORS — Tauri desktop app
  // --------------------------------------------------
  FRONTEND_ORIGIN: getEnv("FRONTEND_ORIGIN", "tauri://localhost"),
});

export const config = appConfig();
