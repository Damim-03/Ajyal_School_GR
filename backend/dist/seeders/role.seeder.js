"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const client_1 = require("../core/prisma/client");
const provision_1 = require("../core/rbac/provision");
// ======================================================
// Seeder — Permissions + Roles + Admin User
//
// idempotent: يمكن تشغيله أكثر من مرة بدون تكرار البيانات
//
//   npm run seed
//
// وتعريفُ الصلاحيات والأدوار انتقل إلى `core/rbac/provision.ts`:
// التهيئةُ الأولى داخل التطبيق تحتاجها أيضاً، ونسخُها هنا كان
// سيُنتج مؤسّستين بصلاحياتٍ مختلفة بحسب طريق التركيب.
//
// وما بقي هنا هو ما لا يصحّ أن يكون إلّا سكربتاً: حسابُ مديرٍ
// أوّليٌّ بكلمةِ مرورٍ من متغيّرات البيئة — طريقُ المطوّر، بإزاء
// طريقِ المؤسسة الذي تفتحه شاشةُ «المدير» في التهيئة.
// ======================================================
// متغيّر بيئة فارغ = غير مضبوط (‎.env قد يحتوي KEY= بلا قيمة)
const env = (key) => {
    const value = process.env[key]?.trim();
    return value ? value : undefined;
};
const seedAdminUser = async (adminRoleId) => {
    const username = env("SEED_ADMIN_USERNAME") ?? "admin";
    const configuredPassword = env("SEED_ADMIN_PASSWORD");
    const existing = await client_1.prisma.user.findUnique({
        where: { username },
        select: { id: true },
    });
    // --------------------------------------------------
    // المستخدم موجود مسبقاً
    // لا نلمس كلمة مروره إلا إذا ضُبطت SEED_ADMIN_PASSWORD صراحةً
    // --------------------------------------------------
    if (existing) {
        if (!configuredPassword) {
            console.log(`ℹ️  User '${username}' already exists — skipped\n` +
                `   (اضبط SEED_ADMIN_PASSWORD في .env ثم أعد التشغيل لإعادة ضبط كلمة المرور)`);
            return;
        }
        await client_1.prisma.user.update({
            where: { id: existing.id },
            data: {
                password: await bcryptjs_1.default.hash(configuredPassword, 12),
                roleId: adminRoleId,
                isActive: true,
            },
        });
        console.log(`✅ Password reset for existing user: ${username}`);
        return;
    }
    // --------------------------------------------------
    // مستخدم جديد — كلمة المرور من .env وإلا نولّد واحدة
    // --------------------------------------------------
    const password = configuredPassword ?? (0, crypto_1.randomBytes)(12).toString("base64url");
    await client_1.prisma.user.create({
        data: {
            username,
            firstName: env("SEED_ADMIN_FIRST_NAME") ?? "System",
            lastName: env("SEED_ADMIN_LAST_NAME") ?? "Administrator",
            email: env("SEED_ADMIN_EMAIL") ?? null,
            password: await bcryptjs_1.default.hash(password, 12),
            roleId: adminRoleId,
            isActive: true,
        },
    });
    console.log(`✅ Admin user created: ${username}`);
    if (!configuredPassword) {
        console.log("");
        console.log("   ⚠️  كلمة مرور مولّدة عشوائياً — احفظها الآن، لن تُعرض مجدداً:");
        console.log(`   ${password}`);
        console.log("");
    }
};
const main = async () => {
    console.log("🌱 Seeding...\n");
    const adminRoleId = await (0, provision_1.provisionRbac)(true);
    await seedAdminUser(adminRoleId);
    console.log("\n🌱 Done.");
};
main()
    .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await client_1.prisma.$disconnect();
});
//# sourceMappingURL=role.seeder.js.map