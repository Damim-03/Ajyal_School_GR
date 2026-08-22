"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_path_1 = __importDefault(require("node:path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const rate_limit_middleware_1 = require("./core/middleware/rate-limit.middleware");
const app_config_1 = require("./core/config/app.config");
const error_handler_middleware_1 = require("./core/middleware/error-handler.middleware");
const async_handler_middleware_1 = require("./core/middleware/async-handler.middleware");
const http_config_1 = require("./core/config/http.config");
const mainroute_1 = __importDefault(require("./routes/mainroute"));
// ======================================================
// APP
// ======================================================
const app = (0, express_1.default)();
// ======================================================
// PROXY
//
// الاستضافة تضع التطبيق خلف وسيطٍ عكسي، فعنوانُ كلّ طلبٍ يصل
// `127.0.0.1` والعنوانُ الحقيقي في ترويسة `X-Forwarded-For`.
// وExpress يتجاهلها ما لم يُؤذن له صراحةً.
//
// وأثرُ إغفالها لم يكن تجميلياً: express-rate-limit يرى الترويسة
// مضبوطةً والإعدادَ مطفأً، فيرمي ValidationError داخل دالةٍ
// غيرِ متزامنة — رفضٌ غير معالَج يُنهي العمليةَ في Node. فتُعاد
// وتُقتل مع كلّ طلب، وكلُّ إقلاعٍ يفتح تجمّعَ اتصالاتٍ جديداً حتى
// تستنفد الحصّةَ الساعية للقاعدة.
//
// و`1` لا `true`: نثق بالوسيط الأقرب وحده. و`true` تثق بالسلسلة
// كلّها، فيصير بوسع أيّ عميلٍ انتحالُ عنوانه بترويسةٍ مزوّرة
// ويسقط محدِّدُ المحاولات على /auth/login من أساسه.
// ======================================================
app.set("trust proxy", 1);
// ======================================================
// SECURITY
// ======================================================
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: {
        policy: "cross-origin",
    },
}));
// ======================================================
// RATE LIMITER
//
// حدّ عام واسع هنا، وحدّ صارم على /auth/login
// معرَّف في auth.route.ts
// ======================================================
app.use(rate_limit_middleware_1.generalLimiter);
// ======================================================
// CORS — Tauri desktop + Mobile (same WiFi)
// ======================================================
/**
 * الجهاز المحلّي بأسمائه الثلاثة.
 *
 * `localhost` و `127.0.0.1` و `[::1]` هي **نفس الجهاز**، لكنّها أصولٌ
 * مختلفة عند المتصفّح. وقد كان المسموح اسماً واحداً بمنفذ واحد
 * (`http://localhost:5173`)، فكان يكفي أن يربط Vite نفسه على IPv6 —
 * وهو ما يفعله تلقائياً حين يكون المنفذ مشغولاً على IPv4 — ليصير أصل
 * الواجهة `http://[::1]:5173`، فيُرفض كل طلب وتظهر نافذة بيضاء بلا
 * رسالة خطأ واحدة.
 *
 * والرفض كان يمرّ عبر `new Error` فيصير **500 على طلب preflight**:
 * خطأ خادم يخفي أنّ السبب في القائمة لا في الخادم.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const isLocalOrigin = (origin) => {
    try {
        const { protocol, hostname } = new URL(origin);
        return ((protocol === "http:" || protocol === "https:") &&
            LOCAL_HOSTS.has(hostname));
    }
    catch {
        return false;
    }
};
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        /*
         * أصل نافذة Tauri يختلف بحسب المنصّة:
         *   ماك/لينكس → tauri://localhost   (بروتوكول مخصّص)
         *   ويندوز/أندرويد → http://tauri.localhost
         *
         * لأنّ WebView2 لا يسمح بتسجيل بروتوكولٍ مخصّص فيُخدَم
         * التطبيق عبر HTTP على مضيفٍ وهمي. وإغفال الثاني كان يجعل
         * كلَّ طلبٍ من نسخة ويندوز يسقط عند preflight بلا رسالةٍ
         * مفهومة — والاسم `tauri.localhost` ليس ضمن LOCAL_HOSTS
         * فلا تلتقطه isLocalOrigin.
         */
        const allowedOrigins = [
            app_config_1.config.FRONTEND_ORIGIN, // tauri://localhost — ماك/لينكس
            "http://tauri.localhost", // ويندوز/أندرويد
            "http://localhost:5173", // Vite dev
            "http://localhost:3001",
        ];
        // Allow mobile apps / Postman (no origin)
        if (!origin || allowedOrigins.includes(origin) || isLocalOrigin(origin)) {
            callback(null, true);
        }
        else {
            /*
             * `false` لا `Error`: يردّ CORS بلا ترويسة السماح فيرفض
             * المتصفّح الطلب برسالته الواضحة، بدل 500 يُقرأ كعطبٍ في
             * الخادم.
             */
            callback(null, false);
        }
    },
    credentials: true,
}));
// ======================================================
// BODY PARSER
// ======================================================
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({
    extended: true,
}));
// ======================================================
// COOKIES
// ======================================================
app.use((0, cookie_parser_1.default)());
// ======================================================
// COMPRESSION
// ======================================================
app.use((0, compression_1.default)());
// ======================================================
// LOGGER
// ======================================================
app.use((0, morgan_1.default)("dev"));
// ======================================================
// STATIC — الملفات المرفوعة
//
// خارج /api عمداً: هذه ملفّات لا نقاط نهاية، و`crossOriginResourcePolicy`
// في helmet مضبوط على cross-origin فوقها ليتمكّن تطبيق Tauri من عرضها.
// ======================================================
app.use("/uploads", express_1.default.static(node_path_1.default.join(__dirname, "..", "uploads")));
// ======================================================
// HEALTH CHECK
// ======================================================
app.get("/api/health", (0, async_handler_middleware_1.asyncHandler)(async (_, res) => {
    return res.status(http_config_1.HTTPSTATUS.OK).json({
        success: true,
        message: "Server is running 🚀",
    });
}));
// ======================================================
// API ROUTES
// ======================================================
app.use("/api", mainroute_1.default);
// ======================================================
// ERROR HANDLER
// ======================================================
app.use(error_handler_middleware_1.errorHandler);
// ======================================================
// START SERVER
// ======================================================
const PORT = app_config_1.config.PORT;
/*
 * شبكةُ أمان — لا بديلٌ عن إصلاح السبب.
 *
 * رفضٌ واحدٌ غير معالَج يُنهي العمليةَ في Node، وعلى استضافةٍ تُعيد
 * التشغيل تلقائياً يصير ذلك حلقةً: تُقتل وتُبعث مع كلّ طلب، وكلُّ
 * بعثٍ يفتح تجمّعَ اتصالاتٍ جديداً حتى تُستنفد الحصّةُ الساعية
 * فتسقط القاعدةُ عن التطبيق كلِّه — وقد حدث هذا فعلاً.
 *
 * فالتسجيلُ والاستمرار أقلُّ ضرراً من الموت: خدمةٌ تخدم بقيةَ
 * المسارات وتترك أثراً يُقرأ، بدل انهيارٍ صامتٍ متكرّر.
 *
 * و`uncaughtException` متروكٌ عمداً على سلوكه الافتراضي — الاستثناءُ
 * المتزامن قد يترك العمليةَ في حالٍ فاسد، والاستمرارُ فيه مقامرة.
 */
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
});
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} in ${app_config_1.config.NODE_ENV}`);
});
exports.default = app;
//# sourceMappingURL=app.js.map