import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../../generated/prisma";
import { config } from "../config/app.config";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// --------------------------------------------------
// مصدر واحد للاتصال: DATABASE_URL
// نفس القيمة يستعملها prisma.config.ts (migrate / generate)
// --------------------------------------------------

if (!config.DATABASE_URL) {
  throw new Error("Missing env variable: DATABASE_URL");
}

const databaseUrl = new URL(config.DATABASE_URL);

const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));

/*
 * تجمّعٌ صغيرٌ معمّر — لا الافتراضيّ الواسع المتجدّد.
 *
 * الاستضافة المشتركة تحدّ المستخدمَ بـ`max_connections_per_hour`
 * (500 هنا)، وهو عدّادُ اتصالاتٍ **جديدة** لا اتصالاتٍ متزامنة.
 * والافتراضيّ يفتح عشرة ويُسرّح الخاملَ بعد ثلاثين دقيقة ثمّ يعيد
 * فتحه — دورانٌ يستهلك الحصّة بلا عملٍ يُنجَز.
 *
 * فخمسةٌ تكفي حملَ مدرسةٍ واحدة، و`idleTimeout: 0` يُبقيها حيّةً
 * ما دامت العملية حيّة، فيصير مجموعُ ما تفتحه العمليةُ خمسةً لا
 * خمسةً كلَّ نصف ساعة.
 *
 * وإن قطع الخادمُ اتصالاً خاملاً من طرفه (wait_timeout)، فالتجمّع
 * يتحقّق قبل الإعارة ويستبدله — فالمقايضة استبدالٌ عند الحاجة بدل
 * تسريحٍ دوريٍّ مضمون.
 */
const adapter = new PrismaMariaDb(
  {
    host: databaseUrl.hostname,
    port: databaseUrl.port ? Number(databaseUrl.port) : 3306,
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: databaseName,

    connectionLimit: 5,
    idleTimeout: 0,
  },
  {
    // اسم قاعدة البيانات المستعمل في الاستعلامات المولَّدة
    database: databaseName,
  },
);

export const prisma =
  global.__prisma ??
  new PrismaClient({
    adapter,
    log: config.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (config.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export default prisma;
