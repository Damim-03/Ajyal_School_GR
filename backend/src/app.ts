import "dotenv/config";
import path from "node:path";
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { generalLimiter } from "./core/middleware/rate-limit.middleware";
import { config } from "./core/config/app.config";
import { errorHandler } from "./core/middleware/error-handler.middleware";
import { asyncHandler } from "./core/middleware/async-handler.middleware";
import { HTTPSTATUS } from "./core/config/http.config";
import mainRoute from "./routes/mainroute";

// ======================================================
// APP
// ======================================================

const app = express();

// ======================================================
// SECURITY
// ======================================================

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);

// ======================================================
// RATE LIMITER
//
// حدّ عام واسع هنا، وحدّ صارم على /auth/login
// معرَّف في auth.route.ts
// ======================================================

app.use(generalLimiter);

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

const isLocalOrigin = (origin: string) => {
  try {
    const { protocol, hostname } = new URL(origin);

    return (
      (protocol === "http:" || protocol === "https:") &&
      LOCAL_HOSTS.has(hostname)
    );
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        config.FRONTEND_ORIGIN, // tauri://localhost
        "http://localhost:5173", // Vite dev
        "http://localhost:3001",
      ];

      // Allow mobile apps / Postman (no origin)
      if (!origin || allowedOrigins.includes(origin) || isLocalOrigin(origin)) {
        callback(null, true);
      } else {
        /*
         * `false` لا `Error`: يردّ CORS بلا ترويسة السماح فيرفض
         * المتصفّح الطلب برسالته الواضحة، بدل 500 يُقرأ كعطبٍ في
         * الخادم.
         */
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

// ======================================================
// BODY PARSER
// ======================================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  }),
);

// ======================================================
// COOKIES
// ======================================================

app.use(cookieParser());

// ======================================================
// COMPRESSION
// ======================================================

app.use(compression());

// ======================================================
// LOGGER
// ======================================================

app.use(morgan("dev"));

// ======================================================
// STATIC — الملفات المرفوعة
//
// خارج /api عمداً: هذه ملفّات لا نقاط نهاية، و`crossOriginResourcePolicy`
// في helmet مضبوط على cross-origin فوقها ليتمكّن تطبيق Tauri من عرضها.
// ======================================================

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
  "/api/health",
  asyncHandler(async (_: Request, res: Response) => {
    return res.status(HTTPSTATUS.OK).json({
      success: true,
      message: "Server is running 🚀",
    });
  }),
);

// ======================================================
// API ROUTES
// ======================================================

app.use("/api", mainRoute);
    
// ======================================================
// ERROR HANDLER
// ======================================================

app.use(errorHandler);

// ======================================================
// START SERVER
// ======================================================

const PORT = config.PORT;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${config.NODE_ENV}`);
});

export default app;
