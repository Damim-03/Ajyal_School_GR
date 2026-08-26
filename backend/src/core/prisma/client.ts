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

    /*
     * ترتيبُ الاتصال يُثبَّت ولا يُترك للتفاوض.
     *
     * كلُّ جداول المخطّط `utf8mb4_unicode_ci` صراحةً، أمّا ترتيبُ
     * الاتصال فكان يُشتقّ ممّا يُعلنه الخادم. وهو يختلف باختلاف
     * النسخة والاستضافة: محلّياً MariaDB 10.4 وقاعدةٌ افتراضُها
     * `utf8mb4_general_ci`، وعلى الاستضافة MariaDB 11.8 وقاعدةٌ
     * افتراضُها `utf8mb3_general1400_as_ci`.
     *
     * وثمرةُ الاختلاف أنّ طرفَي المقارنة في `LIKE` قد يجيئان
     * بترتيبين لا يغلب أحدُهما الآخر، فيرفض الخادم:
     *   Illegal mix of collations
     *   (utf8mb4_unicode_ci,IMPLICIT) and (utf8mb4_bin,NONE)
     * وهو خطأٌ لا يظهر على جهاز التطوير أصلاً — لأنّ نسخته أقدم.
     *
     * فتثبيتُه هنا يجعل سلوكَ الاستعلام واحداً على أيّ خادم.
     *
     * و`collation` وحدها بلا `charset`: تمريرُ الاثنين يجعل السائق
     * يأخذ الترتيبَ الافتراضيَّ للمحرف فيُسقط ما طُلب صراحةً — مقيسٌ،
     * فمع `charset` خرج الاتصالُ `utf8mb4_general_ci` لا المطلوب.
     */
    collation: "utf8mb4_unicode_ci",
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
