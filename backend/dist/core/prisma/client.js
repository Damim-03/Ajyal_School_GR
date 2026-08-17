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
const adapter = new adapter_mariadb_1.PrismaMariaDb(app_config_1.config.DATABASE_URL, {
    // اسم قاعدة البيانات المستعمل في الاستعلامات المولَّدة
    database: decodeURIComponent(databaseUrl.pathname.slice(1)),
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