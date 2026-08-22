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
}, {
    // اسم قاعدة البيانات المستعمل في الاستعلامات المولَّدة
    database: databaseName,
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