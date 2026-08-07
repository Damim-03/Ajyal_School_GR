"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
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
// SECURITY
// ======================================================
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: {
        policy: "cross-origin",
    },
}));
// ======================================================
// RATE LIMITER
// ======================================================
app.use((0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "Too many requests from this IP, please try again later.",
}));
// ======================================================
// CORS — Tauri desktop + Mobile (same WiFi)
// ======================================================
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = [
            app_config_1.config.FRONTEND_ORIGIN, // tauri://localhost
            "http://localhost:5173", // Vite dev
            "http://localhost:3001",
        ];
        // Allow mobile apps / Postman (no origin)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("CORS not allowed"));
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
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} in ${app_config_1.config.NODE_ENV}`);
});
exports.default = app;
//# sourceMappingURL=app.js.map