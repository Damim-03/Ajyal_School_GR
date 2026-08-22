/**
 * النسخُ الاحتياطي والاستعادة وإعادة التهيئة.
 *
 * ثلاثةُ أفعالٍ خطيرة يجمعها أنّها تمسّ القاعدة كلَّها لا صفّاً منها،
 * فتُكتب في موضعٍ واحد ليُقرأ حرسُها مرّةً واحدة.
 *
 * **ولا تعتمد على `mysqldump`.** الأداةُ الموجودة على هذا الجهاز من
 * MySQL 8.4، والخادم الذي يخدم المشروع **MariaDB 10.4** — وبينهما
 * اختلافٌ في صيغة المخرَج يُفشل الاستعادة أو يُنتج ملفّاً لا يُقرأ.
 * وأبعدُ من ذلك: مؤسسةٌ تُركّب البرنامج على جهازٍ آخر قد لا تجد
 * الأداةَ في المسار أصلاً، فتسقط الميزةُ كلُّها بلا سبب ظاهر.
 *
 * فالنسخةُ تُقرأ من القاعدة نفسها صفّاً صفّاً بـ`SELECT *` خام، وتُعاد
 * كما خرجت. **خامٌ في الاتجاهين**: لا يمسّ Prisma الأنواعَ ذهاباً ولا
 * إياباً، فلا يتحوّل عددٌ عشريّ إلى نصٍّ ولا تاريخٌ إلى غيره.
 */

import fs from "node:fs";
import path from "node:path";

import AdmZip from "adm-zip";

import type { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  BadRequestException,
  NotFoundException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import type { ResetInput } from "./maintenance.schema";

/** جذرُ المرفوعات — الصور والوثائق الممسوحة، كما يخدمها `app.ts` */
const UPLOADS = path.join(__dirname, "..", "..", "..", "uploads");

/**
 * مجلَّدُ النسخ — على القرص لا في المتصفّح.
 *
 * الواجهةُ تعمل داخل WebView لا متصفّحٍ كامل، ولا لاحقةَ حوارِ حفظٍ
 * في هذا البناء. فبدل أن يُدفع الأرشيفُ إلى نافذةٍ قد لا تستقبله،
 * يكتبه الخادمُ في موضعٍ معلوم — وهو يعمل على الجهاز نفسه. ويبقى
 * الأمرُ أنفع: النسخُ تتراكم في مكانٍ واحد يُرى ويُستعاد منه بضغطة.
 *
 * **ولا يُغني ذلك عن نسخةٍ خارج الجهاز.** قرصٌ يتلف يأخذ القاعدة
 * ونسخَها معاً — فيُعرض المسار للمستخدم لينقلها إلى قرصٍ أو سحابة.
 */
const BACKUPS = path.join(__dirname, "..", "..", "..", "backups");

const ensureBackupsDir = () => {
  if (!fs.existsSync(BACKUPS)) fs.mkdirSync(BACKUPS, { recursive: true });
  return BACKUPS;
};

/** اسمٌ من داخل الطلب لا يُبنى منه مسار — ولا يخرج من المجلَّد */
const backupPath = (name: string) => {
  const safe = path.basename(name);

  if (!safe.endsWith(".zip") || safe !== name) {
    throw new BadRequestException(
      "اسمُ نسخةٍ غير صالح",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  return path.join(ensureBackupsDir(), safe);
};

export const listBackupsService = async () => {
  const dir = ensureBackupsDir();

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".zip"))
    .map((entry) => {
      const stat = fs.statSync(path.join(dir, entry.name));

      return {
        name: entry.name,
        bytes: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    })
    /* الأحدثُ أوّلاً — هو ما يُستعاد في الغالب */
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const readBackupService = async (name: string) => {
  const full = backupPath(name);

  if (!fs.existsSync(full)) {
    throw new NotFoundException(
      "لا وجود لهذه النسخة",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  return { name: path.basename(full), buffer: fs.readFileSync(full) };
};

export const deleteBackupService = async (name: string) => {
  const full = backupPath(name);

  if (!fs.existsSync(full)) {
    throw new NotFoundException(
      "لا وجود لهذه النسخة",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  fs.unlinkSync(full);

  return { name: path.basename(full) };
};

/** لا يُنسخ ولا يُستعاد: سجلُّ الهجرات ملكُ Prisma لا ملكُ المؤسسة */
const EXCLUDED_TABLES = new Set(["_prisma_migrations"]);

/**
 * ما يُبقيه المستخدم من إعادة التهيئة.
 *
 * والحساباتُ ليست خياراً: حذفُ `Role` أو `Permission` يُبقي المستخدم
 * موجوداً ولا يستطيع الدخول — فالحسابُ بلا دورٍ بابٌ بلا مفتاح.
 */
const ALWAYS_KEPT = ["User", "Role", "Permission", "RolePermission"] as const;

export const KEEP_GROUPS = {
  identity: ["Setting"],
  structure: [
    "AcademicYear",
    "EducationStage",
    "Level",
    "StudyGroup",
    "Subject",
    "Classroom",
    "LessonSlot",
  ],
  staff: ["Teacher"],
  pricing: ["TuitionFee", "SettlementPolicy"],
} as const;

export type KeepGroup = keyof typeof KEEP_GROUPS;

/** ترجمةُ المجموعات إلى عربيةٍ تُعرض في النافذة */
export const GROUP_LABEL: Record<KeepGroup, string> = {
  identity: "هوية المؤسسة",
  structure: "البنية الدراسية",
  staff: "الأساتذة",
  pricing: "الأسعار والسياسات",
};

// --------------------------------------------------
// أدواتُ القاعدة
// --------------------------------------------------

/** جداولُ القاعدة كما هي فيها — لا كما نظنّها */
const listTables = async (): Promise<string[]> => {
  const rows = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME`,
  );

  return rows
    .map((row) => row.TABLE_NAME)
    .filter((name) => !EXCLUDED_TABLES.has(name));
};

/**
 * ما يصلح لـJSON — والتاريخُ والعدد الكبير والثنائيّ لا يصلح بذاته.
 *
 * ويُوسَم النوعُ ليُعاد كما كان: `JSON.parse` يُرجع نصّاً مكان التاريخ
 * فيُدرَج نصّاً وتفسد الأعمدة. فالوسمُ هنا هو ما يجعل الدورة مغلقة.
 */
const encode = (value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return { __t: "d", v: value.toISOString() };
  if (typeof value === "bigint") return { __t: "n", v: value.toString() };
  if (Buffer.isBuffer(value)) return { __t: "b", v: value.toString("base64") };

  return value;
};

const decode = (value: unknown): unknown => {
  if (value === null || value === undefined) return null;

  if (typeof value === "object" && value !== null && "__t" in value) {
    const tagged = value as { __t: string; v: string };

    if (tagged.__t === "d") return new Date(tagged.v);
    if (tagged.__t === "n") return BigInt(tagged.v);
    if (tagged.__t === "b") return Buffer.from(tagged.v, "base64");
  }

  return value;
};

/** يُقرأ بالوسم كي لا يفسد نصٌّ فيه علامةُ اقتباس */
const quote = (name: string) => `\`${name.replace(/`/g, "``")}\``;

/**
 * أسماءُ الجداول تُقارَن بلا حالةِ أحرف — وهذا ليس تزيّداً.
 *
 * الخادمُ هنا MariaDB على ويندوز، و`lower_case_table_names=1` فيه
 * افتراضاً: فيُرجع `information_schema` أسماءً صغيرة كلَّها
 * (`user`, `rolepermission`) بينما المخطَّط يكتبها `User` و
 * `RolePermission`.
 *
 * والمقارنةُ الحرفية كانت تُخرج **قائمةَ المحميّات فارغة** — أي أنّ
 * إعادة التهيئة كانت ستمحو المستخدمين وأدوارهم، وهو الشيء الوحيد
 * الذي وُعد المستخدمُ ببقائه. كُشف بالتشغيل لا بالقراءة.
 */
const norm = (name: string) => name.toLowerCase();

/**
 * `FOREIGN_KEY_CHECKS` متغيّرُ **جلسة** لا متغيّرُ خادم.
 *
 * وPrisma يوزّع الاستعلامات على بِركةِ اتّصالات: فإطفاؤه باستدعاءٍ
 * مستقلّ يقع على اتّصال، ويقع الحذفُ على اتّصالٍ آخر لم يُطفأ فيه —
 * فيرتدّ `1451: Cannot delete or update a parent row`. وقد وقع فعلاً.
 *
 * والمعاملةُ التفاعلية تُثبّت اتّصالاً واحداً للقالب كلِّه، فيسري
 * الإطفاء على ما بعده. وفيها ربحٌ ثانٍ لم يكن مقصوداً: استعادةٌ تفشل
 * في منتصفها تتراجع كلَّها، فلا تبقى القاعدةُ نصفَ ممحوّةٍ ونصفَ
 * مستعادة.
 */
const TX = { timeout: 600_000, maxWait: 30_000 } as const;

const asSet = (names: readonly string[]) => new Set(names.map(norm));

// --------------------------------------------------
// نظرةٌ عامّة — ما في القاعدة قبل أن يُقرَّر شيء
// --------------------------------------------------

export const overviewService = async () => {
  const tables = await listTables();

  const counts: Record<string, number> = {};

  for (const table of tables) {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) AS n FROM ${quote(table)}`,
    );

    counts[table] = Number(rows[0]?.n ?? 0);
  }

  /* حجمُ المرفوعات — ليعرف قبل النسخ كم يُنتظر */
  let files = 0;
  let bytes = 0;

  if (fs.existsSync(UPLOADS)) {
    for (const entry of fs.readdirSync(UPLOADS, { withFileTypes: true })) {
      if (!entry.isFile()) continue;

      files++;
      bytes += fs.statSync(path.join(UPLOADS, entry.name)).size;
    }
  }

  const kept = asSet(ALWAYS_KEPT);

  return {
    tables: tables.map((name) => ({
      name,
      rows: counts[name] ?? 0,
      /** لا يُمحى أبداً — الحسابُ بلا دورٍ بابٌ بلا مفتاح */
      locked: kept.has(norm(name)),
      group:
        (Object.keys(KEEP_GROUPS) as KeepGroup[]).find((key) =>
          asSet(KEEP_GROUPS[key]).has(norm(name)),
        ) ?? null,
    })),
    uploads: { files, bytes },
    backupsDir: ensureBackupsDir(),
    groups: (Object.keys(KEEP_GROUPS) as KeepGroup[]).map((key) => ({
      key,
      label: GROUP_LABEL[key],
      tables: KEEP_GROUPS[key],
      rows: tables
        .filter((table) => asSet(KEEP_GROUPS[key]).has(norm(table)))
        .reduce((sum, table) => sum + (counts[table] ?? 0), 0),
    })),
  };
};

// --------------------------------------------------
// النسخة — قاعدةٌ ومرفوعاتٌ في ملفٍّ واحد
// --------------------------------------------------

export const backupService = async () => {
  const tables = await listTables();
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const table of tables) {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM ${quote(table)}`,
    );

    data[table] = rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) out[key] = encode(value);
      return out;
    });

    counts[table] = rows.length;
  }

  const zip = new AdmZip();

  zip.addFile(
    "manifest.json",
    Buffer.from(
      JSON.stringify(
        {
          app: "ajyal-school",
          /* رقمُ الصيغة لا رقمُ البرنامج — به تُرفض نسخةٌ لا تُفهم */
          format: 1,
          createdAt: new Date().toISOString(),
          tables: counts,
        },
        null,
        2,
      ),
      "utf8",
    ),
  );

  zip.addFile("data.json", Buffer.from(JSON.stringify(data), "utf8"));

  if (fs.existsSync(UPLOADS)) {
    for (const entry of fs.readdirSync(UPLOADS, { withFileTypes: true })) {
      if (!entry.isFile()) continue;

      zip.addFile(
        `uploads/${entry.name}`,
        fs.readFileSync(path.join(UPLOADS, entry.name)),
      );
    }
  }

  const stamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace(/[-:]/g, "")
    .replace("T", "-");

  const filename = `ajyal-backup-${stamp}.zip`;
  const full = path.join(ensureBackupsDir(), filename);

  zip.writeZip(full);

  return {
    name: filename,
    path: full,
    bytes: fs.statSync(full).size,
    tables: counts,
  };
};

// --------------------------------------------------
// الاستعادة — القاعدةُ تعود كما كانت لحظةَ النسخ
// --------------------------------------------------

export const restoreService = async (source: Buffer | { name: string }) => {
  const archive = Buffer.isBuffer(source)
    ? source
    : (await readBackupService(source.name)).buffer;

  let zip: AdmZip;

  try {
    zip = new AdmZip(archive);
  } catch {
    throw new BadRequestException(
      "الملف ليس نسخةً احتياطية صالحة",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  const manifestEntry = zip.getEntry("manifest.json");
  const dataEntry = zip.getEntry("data.json");

  if (!manifestEntry || !dataEntry) {
    throw new NotFoundException(
      "الملف لا يحمل نسخةً من هذا البرنامج — لا يحوي manifest.json و data.json",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  const manifest = JSON.parse(manifestEntry.getData().toString("utf8")) as {
    app?: string;
    format?: number;
  };

  if (manifest.app !== "ajyal-school" || manifest.format !== 1) {
    throw new BadRequestException(
      "صيغةُ النسخة غير مدعومة في هذه النسخة من البرنامج",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  const data = JSON.parse(dataEntry.getData().toString("utf8")) as Record<
    string,
    Record<string, unknown>[]
  >;

  const tables = await listTables();
  const restored: Record<string, number> = {};

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");

    try {
      for (const table of tables) {
        await tx.$executeRawUnsafe(`DELETE FROM ${quote(table)}`);
      }

      for (const table of tables) {
        const rows = data[table];
        if (!rows || rows.length === 0) continue;

        const columns = Object.keys(rows[0]!);
        const columnList = columns.map(quote).join(", ");
        const placeholders = `(${columns.map(() => "?").join(", ")})`;

        /* دفعاتٌ من مئة — استعلامٌ واحدٌ لعشرة آلاف صفٍّ يتجاوز حدَّ الحزمة */
        for (let at = 0; at < rows.length; at += 100) {
          const batch = rows.slice(at, at + 100);

          const values: unknown[] = [];
          for (const row of batch) {
            for (const column of columns) values.push(decode(row[column]));
          }

          await tx.$executeRawUnsafe(
            `INSERT INTO ${quote(table)} (${columnList}) VALUES ` +
              batch.map(() => placeholders).join(", "),
            ...values,
          );
        }

        restored[table] = rows.length;
      }
    } finally {
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
    }
  }, TX);

  /* المرفوعات: تُكتب فوق ما يماثلها ولا يُمحى ما ليس فيها */
  let files = 0;

  if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !entry.entryName.startsWith("uploads/")) continue;

    /* اسمُ الملفّ وحده — لا يُبنى مسارٌ من داخل الأرشيف */
    const name = path.basename(entry.entryName);
    if (!name) continue;

    fs.writeFileSync(path.join(UPLOADS, name), entry.getData());
    files++;
  }

  return { tables: restored, files };
};

// --------------------------------------------------
// إعادة التهيئة — محوٌ لا رجعة فيه
// --------------------------------------------------

export const resetService = async (body: ResetInput) => {
  const tables = await listTables();

  const kept = asSet(ALWAYS_KEPT);

  for (const group of body.keep ?? []) {
    for (const table of KEEP_GROUPS[group as KeepGroup] ?? []) kept.add(norm(table));
  }

  /*
   * حارسٌ أخير: لو خلت قائمةُ المحميّات من الحسابات لأيّ سبب — تغيُّر
   * اسمِ جدولٍ في المخطَّط، أو خادمٌ يُرجع الأسماء بحالةٍ ثالثة — يُوقَف
   * المحوُ ولا يُكمَل. الخطأُ هنا لا يُصحَّح بعد وقوعه.
   */
  const missing = ALWAYS_KEPT.filter(
    (name) => !tables.some((table) => norm(table) === norm(name)),
  );

  if (missing.length > 0) {
    throw new BadRequestException(
      `تعذّر التعرّف على جداول الحسابات (${missing.join(", ")}) — أُوقفت إعادة التهيئة`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  const wiped = tables.filter((table) => !kept.has(norm(table)));
  const deleted: Record<string, number> = {};

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");

    try {
      for (const table of wiped) {
        const before = await tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT COUNT(*) AS n FROM ${quote(table)}`,
        );

        await tx.$executeRawUnsafe(`DELETE FROM ${quote(table)}`);
        deleted[table] = Number(before[0]?.n ?? 0);
      }
    } finally {
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
    }
  }, TX);

  /*
   * الملفّاتُ تُجمَع لا تُمحى بالجملة.
   *
   * شعارُ المؤسسة في `Setting` وقد يبقى، وصورُ طلبةٍ حُذفوا لا تبقى.
   * فيُمسح ما **لم يعد أحدٌ يشير إليه** بعد المحو: يُقرأ ما بقي في
   * الجداول كلِّها، ويُحذف من المجلَّد ما ليس فيه اسمُه. وهو أسلمُ من
   * قائمةِ أعمدةٍ تُكتب اليوم ويُضاف إليها عمودٌ غداً فيُحذف مرجعُه.
   */
  let purged = 0;

  if (body.purgeFiles && fs.existsSync(UPLOADS)) {
    const referenced = new Set<string>();

    for (const table of tables) {
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM ${quote(table)}`,
      );

      for (const row of rows) {
        for (const value of Object.values(row)) {
          if (typeof value !== "string") continue;

          for (const part of value.split(/[\\/"'\s,]+/)) {
            if (part) referenced.add(path.basename(part));
          }
        }
      }
    }

    for (const entry of fs.readdirSync(UPLOADS, { withFileTypes: true })) {
      if (!entry.isFile() || referenced.has(entry.name)) continue;

      fs.unlinkSync(path.join(UPLOADS, entry.name));
      purged++;
    }
  }

  return {
    deleted,
    kept: tables.filter((table) => kept.has(norm(table))).sort(),
    purgedFiles: purged,
  };
};
