import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma";
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

const adapter = new PrismaMariaDb(config.DATABASE_URL, {
  // اسم قاعدة البيانات المستعمل في الاستعلامات المولَّدة
  database: decodeURIComponent(databaseUrl.pathname.slice(1)),
});

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
