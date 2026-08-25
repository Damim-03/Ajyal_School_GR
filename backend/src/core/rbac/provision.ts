/**
 * الأدوارُ والصلاحيات — تعريفُها وتركيبُها في القاعدة.
 *
 * كان هذا كلُّه في `src/seeders/role.seeder.ts`: سكربتٌ يُنادى بيد
 * المطوّر قبل التسليم. وصار للتهيئة الأولى (First Boot) طريقٌ ثانٍ إلى
 * الشيء نفسِه — المؤسسةُ تُنشئ مديرَها من داخل التطبيق، ولا مديرَ بلا
 * دورٍ ولا دورَ بلا صلاحيات.
 *
 * فلو نُسخت التعريفاتُ هناك لصار في المشروع مصدرانِ للحقيقة يفترقان
 * عند أوّل صلاحيةٍ تُضاف: مؤسسةٌ رُكّبت بالسكربت تملك ما لا تملكه
 * مؤسسةٌ رُكّبت بالتهيئة. وهذا الملفّ هو المصدر، والسكربتُ يستدعيه.
 *
 * وكلُّ ما فيه **idempotent**: يُنادى مرّةً أو عشراً فالنتيجة واحدة —
 * وهو شرطٌ لا ترفٌ، لأنّ خطوةَ المدير في التهيئة قد تُعاد بعد انقطاع.
 */

import { PermissionModule } from "../../../generated/prisma";
import { prisma } from "../prisma/client";

// --------------------------------------------------
// 1. الصلاحيات
//
// صيغة الاسم: <module-kebab>.<action>
//   STUDY_GROUP + view  →  "study-group.view"
//
// نفس الصيغة المستعملة في requirePermission()
// --------------------------------------------------

const DEFAULT_ACTIONS = ["view", "create", "update", "delete"] as const;

/** الموديولات التي تحتاج أفعالاً مختلفة عن الافتراضي */
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

export const buildPermissions = () => {
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
// 2. الأدوار
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

/** اسمُ دور المدير — تقرؤه التهيئةُ والتحقّق، فلا يُكتب نصّاً في موضعين */
export const ADMIN_ROLE = "ADMIN";

export const ROLES: RoleDefinition[] = [
  {
    name: ADMIN_ROLE,
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
// 3. التركيب
// --------------------------------------------------

export const seedPermissions = async (log = false) => {
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

  if (log) console.log(`✅ Permissions: ${permissions.length}`);

  return prisma.permission.findMany({ select: { id: true, name: true } });
};

export const seedRoles = async (
  allPermissions: { id: string; name: string }[],
  log = false,
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
        : allPermissions.filter((p) =>
            (definition.permissions as (name: string) => boolean)(p.name),
          );

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

    if (log) console.log(`✅ Role ${role.name}: ${granted.length} permission(s)`);
  }

  return roleIds;
};

/**
 * تركيبُ المنظومة كلِّها وإرجاعُ معرّف دور المدير.
 *
 * وهي الدالّةُ التي تناديها التهيئةُ الأولى قبل إنشاء المدير: لا يجوز
 * أن يُنشأ مستخدمٌ ثمّ يُكتشَف أنّ دورَه بلا صلاحيةٍ واحدة.
 */
export const provisionRbac = async (log = false): Promise<string> => {
  const permissions = await seedPermissions(log);
  const roleIds = await seedRoles(permissions, log);

  const adminRoleId = roleIds.get(ADMIN_ROLE);

  if (!adminRoleId) {
    throw new Error(`${ADMIN_ROLE} role was not created`);
  }

  return adminRoleId;
};
