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
// --------------------------------------------------
// حارسُ الإقلاع — أسرارُ JWT في الإنتاج
//
// القيمُ الاحتياطية أعلاه مكتوبةٌ في المستودع، أي أنّها معروفةٌ لكلّ
// من يقرأ الشيفرة. ونسيانُ ضبط المتغيّر في الاستضافة كان يمرّ صامتاً:
// الخادمُ يُقلع سليماً ويوقّع التوكنات بسرٍّ عمومي، فيستطيع أيُّ أحدٍ
// تزويرَ توكن مديرٍ كامل الصلاحيات.
//
// فالسقوطُ عند الإقلاع أرحمُ من عملٍ ظاهرِ السلامة: رسالةٌ في سجلّ
// النشر تُقرأ فوراً، بدل ثغرةٍ لا يكشفها شيء.
// --------------------------------------------------
const assertProductionSecrets = (c) => {
    if (c.NODE_ENV !== "production")
        return;
    const weak = (value) => value.trim().length < 32 || value.includes("change");
    const offenders = [
        ["JWT_ACCESS_SECRET", c.JWT_ACCESS_SECRET],
        ["JWT_REFRESH_SECRET", c.JWT_REFRESH_SECRET],
    ]
        .filter(([, value]) => weak(value))
        .map(([key]) => key);
    if (offenders.length > 0) {
        throw new Error(`Insecure JWT secret(s) in production: ${offenders.join(", ")}.\n` +
            `اضبط قيمةً عشوائيةً لكلٍّ منها (32 محرفاً فأكثر):\n` +
            `  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`);
    }
    if (c.JWT_ACCESS_SECRET === c.JWT_REFRESH_SECRET) {
        throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ: " +
            "تساويهما يجعل توكن التجديد صالحاً للوصول مباشرةً.");
    }
};
exports.config = appConfig();
assertProductionSecrets(exports.config);
//# sourceMappingURL=app.config.js.map