"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
require("dotenv/config");
const adapter_mariadb_1 = require("@prisma/adapter-mariadb");
const prisma_1 = require("../../generated/prisma");
const adapter = new adapter_mariadb_1.PrismaMariaDb({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "ajyal_school",
    connectionLimit: 5,
});
exports.prisma = global.__prisma ??
    new prisma_1.PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development"
            ? ["query", "info", "warn", "error"]
            : ["error"],
    });
if (process.env.NODE_ENV !== "production") {
    global.__prisma = exports.prisma;
}
exports.default = exports.prisma;
//# sourceMappingURL=client.js.map