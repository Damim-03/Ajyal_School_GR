export const appConfig = {
  // Backend API — المنفذ الافتراضي للخادم في backend/src/core/config/app.config.ts
  API_URL:     import.meta.env.VITE_API_URL     ?? "http://localhost:3001/api",
  APP_NAME:    import.meta.env.VITE_APP_NAME    ?? "مركز أجيال التعليمي",
  APP_VERSION: import.meta.env.VITE_APP_VERSION ?? "1.0.0",
} as const