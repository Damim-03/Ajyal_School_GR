import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { PermissionModule } from "../../generated/prisma";
import { prisma } from "../core/prisma/client";

// ======================================================
// Seeder — Permissions + Roles + Admin User
//
// idempotent: يمكن تشغيله أكثر من مرة بدون تكرار البيانات
//
//   npm run seed
// ======================================================

// --------------------------------------------------
// 1. تعريف الصلاحيات
//
// صيغة الاسم: <module-kebab>.<action>
//   STUDY_GROUP + view  →  "study-group.view"
//
// نفس الصيغة المستعملة في requirePermission()
// --------------------------------------------------

const DEFAULT_ACTIONS = ["view", "create", "update", "delete"] as const;

// الموديولات التي تحتاج أفعالاً مختلفة عن الافتراضي
const ACTION_OVERRIDES: Partial<Record<PermissionModule, readonly string[]>> = {
  /*
   * الحضور يُصحَّح لا يُمحى — والحذف هنا استثناءٌ ضيّق لا نقضٌ للقاعدة:
   * ورقةُ حصةٍ مُلئت بالخطأ (ضغطةٌ على «الكل حاضر» في العمود الخطأ)
   * لا تُصحَّح بالتعديل، لأنّ الصواب أن تعود الخانات فارغة لا أن تصير
   * غياباً. فالمسار الوحيد الذي يستعمل هذه الصلاحية يُفرّغ **حصةً
   * واحدة بعينها**، ولا يوجد مسارٌ يحذف سجلّ حضورٍ منفرداً.
   */
  ATTENDANCE: ["view", "create", "update", "delete"],

  // الفاتورة تُلغى ولا تُحذف (سجل مالي)
  INVOICE: ["view", "create", "update", "cancel"],

  // الدفعة لا تُعدَّل — تُلغى فقط
  PAYMENT: ["view", "create", "cancel"],

  // الإيصال يُطبع ويُلغى
  RECEIPT: ["view", "print", "reprint", "cancel"],

  /*
   * التخليص لا يُعدَّل ولا يُحذف.
   *
   * `create` تعني «احسب» — والحسابُ نفسه هو إعادة الحساب، فالمسوّدة
   * تُبنى من جديد بلا فعلٍ مستقلّ. و`confirm` تُجمّده فلا يُعاد حسابه
   * (تشمل تسجيل التسليم)، و`cancel` هي التصحيح الوحيد بعد ذلك.
   *
   * وفصلُ confirm عن create مقصود: مَن يحسب ليس بالضرورة مَن يلتزم.
   */
  SETTLEMENT: ["view", "create", "confirm", "cancel"],

  // التقارير للعرض والتصدير
  REPORT: ["view", "export"],

  // الإعدادات العامة
  SETTINGS: ["view", "update"],

  /*
   * الصيانة: نسخٌ واستعادةٌ وإعادةُ تهيئة.
   *
   * ولا `create/update/delete` فيها — الأفعالُ هنا ليست على صفٍّ بل
   * على القاعدة كلِّها، و«حذف» لا يصف محوَ مؤسسةٍ بكاملها.
   */
  MAINTENANCE: ["view", "backup", "restore", "reset"],
};

const toKebab = (module: PermissionModule): string =>
  module.toLowerCase().replace(/_/g, "-");

const buildPermissions = () => {
  const permissions: {
    name: string;
    module: PermissionModule;
    description: string;
  }[] = [];

  for (const module of Object.values(PermissionModule)) {
    const actions = ACTION_OVERRIDES[module] ?? DEFAULT_ACTIONS;

    for (const action of actions) {
      permissions.push({
        name: `${toKebab(module)}.${action}`,
        module,
        description: `${action} ${toKebab(module).replace(/-/g, " ")}`,
      });
    }
  }

  return permissions;
};

// --------------------------------------------------
// 2. تعريف الأدوار
//
// ADMIN        → كل الصلاحيات
// MANAGER      → كل شيء ما عدا إدارة المستخدمين والأدوار
// ACCOUNTANT   → الجانب المالي + الاطلاع على الطلبة
// SECRETARY    → الطلبة والتسجيلات والحضور
// --------------------------------------------------

type RoleDefinition = {
  name: string;
  description: string;
  isSystem: boolean;
  // "*" تعني كل الصلاحيات
  permissions: "*" | ((permissionName: string) => boolean);
};

const ACADEMIC_MODULES = [
  "student",
  "teacher",
  "teaching-assignment",
  "enrollment",
  "subject",
  "study-group",
  "level",
  "education-stage",
  "academic-year",
  "schedule",
  "session",
  "attendance",
  "classroom",
  "lesson-slot",
];

const FINANCIAL_MODULES = [
  "invoice",
  "payment",
  "receipt",
  "tuition-fee",
  "settlement",
  "settlement-policy",
];

const moduleOf = (permissionName: string) => permissionName.split(".")[0];
const actionOf = (permissionName: string) => permissionName.split(".")[1];

const ROLES: RoleDefinition[] = [
  {
    name: "ADMIN",
    description: "مدير النظام — صلاحيات كاملة",
    isSystem: true,
    permissions: "*",
  },
  {
    name: "MANAGER",
    description: "مدير المدرسة — كل شيء ما عدا إدارة المستخدمين والأدوار",
    isSystem: true,
    permissions: (name) => !["user", "role"].includes(moduleOf(name)),
  },
  {
    name: "ACCOUNTANT",
    description: "محاسب — الفوترة والدفع والإيصالات",
    isSystem: true,
    permissions: (name) => {
      const module = moduleOf(name);

      if (FINANCIAL_MODULES.includes(module)) return true;
      if (module === "report") return true;

      // اطلاع فقط على البيانات الأكاديمية
      return ACADEMIC_MODULES.includes(module) && actionOf(name) === "view";
    },
  },
  {
    name: "SECRETARY",
    description: "أمانة — الطلبة والتسجيلات والحضور",
    isSystem: true,
    permissions: (name) => {
      const module = moduleOf(name);

      if (["student", "enrollment", "attendance", "session"].includes(module)) {
        return true;
      }

      // اطلاع فقط على باقي البيانات الأكاديمية
      if (ACADEMIC_MODULES.includes(module)) return actionOf(name) === "view";

      // اطلاع على الفواتير دون تعديلها
      return module === "invoice" && actionOf(name) === "view";
    },
  },
];

// --------------------------------------------------
// 3. التنفيذ
// --------------------------------------------------

const seedPermissions = async () => {
  const permissions = buildPermissions();

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {
        module: permission.module,
        description: permission.description,
      },
      create: permission,
    });
  }

  console.log(`✅ Permissions: ${permissions.length}`);

  return prisma.permission.findMany({ select: { id: true, name: true } });
};

const seedRoles = async (
  allPermissions: { id: string; name: string }[],
): Promise<Map<string, string>> => {
  const roleIds = new Map<string, string>();

  for (const definition of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: definition.name },
      update: {
        description: definition.description,
        isSystem: definition.isSystem,
      },
      create: {
        name: definition.name,
        description: definition.description,
        isSystem: definition.isSystem,
      },
    });

    roleIds.set(role.name, role.id);

    const granted =
      definition.permissions === "*"
        ? allPermissions
        : allPermissions.filter((p) => (definition.permissions as any)(p.name));

    // نربط الصلاحيات — createMany + skipDuplicates يجعلها idempotent
    await prisma.rolePermission.createMany({
      data: granted.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });

    // نحذف الصلاحيات التي لم تعد ضمن تعريف الدور
    const grantedIds = granted.map((p) => p.id);

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permissionId: { notIn: grantedIds },
      },
    });

    console.log(`✅ Role ${role.name}: ${granted.length} permission(s)`);
  }

  return roleIds;
};

// متغيّر بيئة فارغ = غير مضبوط (‎.env قد يحتوي KEY= بلا قيمة)
const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

const seedAdminUser = async (adminRoleId: string) => {
  const username = env("SEED_ADMIN_USERNAME") ?? "admin";
  const configuredPassword = env("SEED_ADMIN_PASSWORD");

  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  // --------------------------------------------------
  // المستخدم موجود مسبقاً
  // لا نلمس كلمة مروره إلا إذا ضُبطت SEED_ADMIN_PASSWORD صراحةً
  // --------------------------------------------------

  if (existing) {
    if (!configuredPassword) {
      console.log(
        `ℹ️  User '${username}' already exists — skipped\n` +
          `   (اضبط SEED_ADMIN_PASSWORD في .env ثم أعد التشغيل لإعادة ضبط كلمة المرور)`,
      );
      return;
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password: await bcrypt.hash(configuredPassword, 12),
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

  const password = configuredPassword ?? randomBytes(12).toString("base64url");

  await prisma.user.create({
    data: {
      username,
      firstName: env("SEED_ADMIN_FIRST_NAME") ?? "System",
      lastName: env("SEED_ADMIN_LAST_NAME") ?? "Administrator",
      email: env("SEED_ADMIN_EMAIL") ?? null,
      password: await bcrypt.hash(password, 12),
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

  const permissions = await seedPermissions();
  const roleIds = await seedRoles(permissions);

  const adminRoleId = roleIds.get("ADMIN");

  if (!adminRoleId) {
    throw new Error("ADMIN role was not created");
  }

  await seedAdminUser(adminRoleId);

  console.log("\n🌱 Done.");
};

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
