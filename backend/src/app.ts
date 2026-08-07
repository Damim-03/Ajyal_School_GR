import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
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
// ======================================================

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "Too many requests from this IP, please try again later.",
  }),
);

// ======================================================
// CORS — Tauri desktop + Mobile (same WiFi)
// ======================================================

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        config.FRONTEND_ORIGIN, // tauri://localhost
        "http://localhost:5173", // Vite dev
        "http://localhost:3001",
      ];

      // Allow mobile apps / Postman (no origin)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
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
