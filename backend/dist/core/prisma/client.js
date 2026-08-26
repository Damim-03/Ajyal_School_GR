"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
require("dotenv/config");
const adapter_mariadb_1 = require("@prisma/adapter-mariadb");
const prisma_1 = require("../../../generated/prisma");
const app_config_1 = require("../config/app.config");
// --------------------------------------------------
// مصدر واحد للاتصال: DATABASE_URL
// نفس القيمة يستعملها prisma.config.ts (migrate / generate)
// --------------------------------------------------
if (!app_config_1.config.DATABASE_URL) {
    throw new Error("Missing env variable: DATABASE_URL");
}
const databaseUrl = new URL(app_config_1.config.DATABASE_URL);
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
const adapter = new adapter_mariadb_1.PrismaMariaDb({
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
}, {
    // اسم قاعدة البيانات المستعمل في الاستعلامات المولَّدة
    database: databaseName,
    /*
     * البروتوكول النصّي لا الثنائيّ — وهذا هو ما يُطفئ خطأ الترتيب.
     *
     * المحوّل يرسل المعاملات افتراضياً بالبروتوكول الثنائيّ
     * (`connection.execute`)، فيصل المعامل إلى الخادم **نصّاً
     * ثنائياً**. وPrisma تترجم `startsWith` إلى:
     *
     *     WHERE `studentNumber` LIKE CONCAT(?, '%')
     *
     * فيُدمج نصٌّ ثنائيٌّ مع نصٍّ محرفيّ، ونتيجةُ الدمج في MariaDB
     * ترتيبُها `utf8mb4_bin` ودرجتُها `NONE` — فتصطدم بترتيب
     * العمود `utf8mb4_unicode_ci`:
     *
     *     Illegal mix of collations
     *     (utf8mb4_unicode_ci,IMPLICIT) and (utf8mb4_bin,NONE)
     *
     * وهو يسقط كلَّ بحثٍ في التطبيق وكلَّ تسجيلِ طالب (توليدُ رقمه
     * يقرأ آخر رقمٍ بـ`startsWith`). ولا يظهر على MariaDB 10.4
     * ويظهر على 11.8 — فجهاز التطوير لا يكشفه.
     *
     * وبالبروتوكول النصّي (`connection.query`) يُدرج السائقُ
     * المعاملَ نصّاً مهرَّباً في العبارة، فيأخذ ترتيبَ الاتصال
     * المثبَّت أعلاه — فيصير طرفا `CONCAT` بترتيبٍ واحد ويستحيل
     * التضارب.
     *
     * والكلفة معدومة عملياً: المحوّل يضبط `prepareCacheLength: 0`
     * أصلاً، فلا عبارات مُهيَّأة محفوظة تُفقد.
     */
    useTextProtocol: true,
});
exports.prisma = global.__prisma ??
    new prisma_1.PrismaClient({
        adapter,
        log: app_config_1.config.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
if (app_config_1.config.NODE_ENV !== "production") {
    global.__prisma = exports.prisma;
}
exports.default = exports.prisma;
//# sourceMappingURL=client.js.map