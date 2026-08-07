export const appConfig = {
  // Backend API — يعمل محلياً مع Tauri
  API_URL:     import.meta.env.VITE_API_URL     ?? "http://localhost:9000/api",
  APP_NAME:    import.meta.env.VITE_APP_NAME    ?? "مركز أجيال التعليمي",
  APP_VERSION: import.meta.env.VITE_APP_VERSION ?? "1.0.0",
} as const