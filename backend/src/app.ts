import "dotenv/config";
import fs from "node:fs";
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
        config.FRONTEND_ORIGIN, // tauri://localhost — ماك/لينكس
        "http://tauri.localhost", // ويندوز/أندرويد
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

/**
 * ونسخةُ الخادم تُعلَن هنا.
 *
 * تقرؤها شاشةُ التحديث في التهيئة الأولى لتُصالح بين النافذة والخادم
 * (§36): أكثرُ ما يُعطب تركيبةً نصفُها مكتبٌ ونصفُها خادم أن يُحدَّث
 * أحدُهما ويبقى الآخر — فتُنادى مساراتٌ لا توجد. والفحصُ حقيقيٌّ نافع،
 * بخلاف مُحدِّثٍ لا وجود له يُخترع لأجل شريط تقدّم.
 *
 * وتُقرأ من `package.json` مرّةً لا في كل طلب. والمسارُ يصحّ في
 * الحالين: `dist/app.js` و`src/app.ts` كلاهما على بُعد مجلَّدٍ واحد
 * من جذر الحزمة.
 */
const serverVersion = (() => {
  try {
    const manifest = fs.readFileSync(
      path.join(__dirname, "..", "package.json"),
      "utf8",
    );

    return (JSON.parse(manifest) as { version?: string }).version ?? "";
  } catch {
    return "";
  }
})();

app.get(
  "/api/health",
  asyncHandler(async (_: Request, res: Response) => {
    return res.status(HTTPSTATUS.OK).json({
      success: true,
      message: "Server is running 🚀",
      version: serverVersion,
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
  console.log(`🚀 Server running on port ${PORT} in ${config.NODE_ENV}`);
});

export default app;
