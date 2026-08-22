"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetService = exports.restoreService = exports.backupService = exports.overviewService = exports.GROUP_LABEL = exports.KEEP_GROUPS = exports.deleteBackupService = exports.readBackupService = exports.listBackupsService = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
/** جذرُ المرفوعات — الصور والوثائق الممسوحة، كما يخدمها `app.ts` */
const UPLOADS = node_path_1.default.join(__dirname, "..", "..", "..", "uploads");
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
const BACKUPS = node_path_1.default.join(__dirname, "..", "..", "..", "backups");
const ensureBackupsDir = () => {
    if (!node_fs_1.default.existsSync(BACKUPS))
        node_fs_1.default.mkdirSync(BACKUPS, { recursive: true });
    return BACKUPS;
};
/** اسمٌ من داخل الطلب لا يُبنى منه مسار — ولا يخرج من المجلَّد */
const backupPath = (name) => {
    const safe = node_path_1.default.basename(name);
    if (!safe.endsWith(".zip") || safe !== name) {
        throw new app_errors_1.BadRequestException("اسمُ نسخةٍ غير صالح", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    return node_path_1.default.join(ensureBackupsDir(), safe);
};
const listBackupsService = async () => {
    const dir = ensureBackupsDir();
    return node_fs_1.default
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".zip"))
        .map((entry) => {
        const stat = node_fs_1.default.statSync(node_path_1.default.join(dir, entry.name));
        return {
            name: entry.name,
            bytes: stat.size,
            createdAt: stat.mtime.toISOString(),
        };
    })
        /* الأحدثُ أوّلاً — هو ما يُستعاد في الغالب */
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};
exports.listBackupsService = listBackupsService;
const readBackupService = async (name) => {
    const full = backupPath(name);
    if (!node_fs_1.default.existsSync(full)) {
        throw new app_errors_1.NotFoundException("لا وجود لهذه النسخة", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    return { name: node_path_1.default.basename(full), buffer: node_fs_1.default.readFileSync(full) };
};
exports.readBackupService = readBackupService;
const deleteBackupService = async (name) => {
    const full = backupPath(name);
    if (!node_fs_1.default.existsSync(full)) {
        throw new app_errors_1.NotFoundException("لا وجود لهذه النسخة", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    node_fs_1.default.unlinkSync(full);
    return { name: node_path_1.default.basename(full) };
};
exports.deleteBackupService = deleteBackupService;
/** لا يُنسخ ولا يُستعاد: سجلُّ الهجرات ملكُ Prisma لا ملكُ المؤسسة */
const EXCLUDED_TABLES = new Set(["_prisma_migrations"]);
/**
 * ما يُبقيه المستخدم من إعادة التهيئة.
 *
 * والحساباتُ ليست خياراً: حذفُ `Role` أو `Permission` يُبقي المستخدم
 * موجوداً ولا يستطيع الدخول — فالحسابُ بلا دورٍ بابٌ بلا مفتاح.
 */
const ALWAYS_KEPT = ["User", "Role", "Permission", "RolePermission"];
exports.KEEP_GROUPS = {
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
};
/** ترجمةُ المجموعات إلى عربيةٍ تُعرض في النافذة */
exports.GROUP_LABEL = {
    identity: "هوية المؤسسة",
    structure: "البنية الدراسية",
    staff: "الأساتذة",
    pricing: "الأسعار والسياسات",
};
// --------------------------------------------------
// أدواتُ القاعدة
// --------------------------------------------------
/** جداولُ القاعدة كما هي فيها — لا كما نظنّها */
const listTables = async () => {
    const rows = await client_1.prisma.$queryRawUnsafe(`SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME`);
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
const encode = (value) => {
    if (value === null || value === undefined)
        return null;
    if (value instanceof Date)
        return { __t: "d", v: value.toISOString() };
    if (typeof value === "bigint")
        return { __t: "n", v: value.toString() };
    if (Buffer.isBuffer(value))
        return { __t: "b", v: value.toString("base64") };
    return value;
};
const decode = (value) => {
    if (value === null || value === undefined)
        return null;
    if (typeof value === "object" && value !== null && "__t" in value) {
        const tagged = value;
        if (tagged.__t === "d")
            return new Date(tagged.v);
        if (tagged.__t === "n")
            return BigInt(tagged.v);
        if (tagged.__t === "b")
            return Buffer.from(tagged.v, "base64");
    }
    return value;
};
/** يُقرأ بالوسم كي لا يفسد نصٌّ فيه علامةُ اقتباس */
const quote = (name) => `\`${name.replace(/`/g, "``")}\``;
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
const norm = (name) => name.toLowerCase();
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
const TX = { timeout: 600000, maxWait: 30000 };
const asSet = (names) => new Set(names.map(norm));
// --------------------------------------------------
// نظرةٌ عامّة — ما في القاعدة قبل أن يُقرَّر شيء
// --------------------------------------------------
const overviewService = async () => {
    const tables = await listTables();
    const counts = {};
    for (const table of tables) {
        const rows = await client_1.prisma.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM ${quote(table)}`);
        counts[table] = Number(rows[0]?.n ?? 0);
    }
    /* حجمُ المرفوعات — ليعرف قبل النسخ كم يُنتظر */
    let files = 0;
    let bytes = 0;
    if (node_fs_1.default.existsSync(UPLOADS)) {
        for (const entry of node_fs_1.default.readdirSync(UPLOADS, { withFileTypes: true })) {
            if (!entry.isFile())
                continue;
            files++;
            bytes += node_fs_1.default.statSync(node_path_1.default.join(UPLOADS, entry.name)).size;
        }
    }
    const kept = asSet(ALWAYS_KEPT);
    return {
        tables: tables.map((name) => ({
            name,
            rows: counts[name] ?? 0,
            /** لا يُمحى أبداً — الحسابُ بلا دورٍ بابٌ بلا مفتاح */
            locked: kept.has(norm(name)),
            group: Object.keys(exports.KEEP_GROUPS).find((key) => asSet(exports.KEEP_GROUPS[key]).has(norm(name))) ?? null,
        })),
        uploads: { files, bytes },
        backupsDir: ensureBackupsDir(),
        groups: Object.keys(exports.KEEP_GROUPS).map((key) => ({
            key,
            label: exports.GROUP_LABEL[key],
            tables: exports.KEEP_GROUPS[key],
            rows: tables
                .filter((table) => asSet(exports.KEEP_GROUPS[key]).has(norm(table)))
                .reduce((sum, table) => sum + (counts[table] ?? 0), 0),
        })),
    };
};
exports.overviewService = overviewService;
// --------------------------------------------------
// النسخة — قاعدةٌ ومرفوعاتٌ في ملفٍّ واحد
// --------------------------------------------------
const backupService = async () => {
    const tables = await listTables();
    const data = {};
    const counts = {};
    for (const table of tables) {
        const rows = await client_1.prisma.$queryRawUnsafe(`SELECT * FROM ${quote(table)}`);
        data[table] = rows.map((row) => {
            const out = {};
            for (const [key, value] of Object.entries(row))
                out[key] = encode(value);
            return out;
        });
        counts[table] = rows.length;
    }
    const zip = new adm_zip_1.default();
    zip.addFile("manifest.json", Buffer.from(JSON.stringify({
        app: "ajyal-school",
        /* رقمُ الصيغة لا رقمُ البرنامج — به تُرفض نسخةٌ لا تُفهم */
        format: 1,
        createdAt: new Date().toISOString(),
        tables: counts,
    }, null, 2), "utf8"));
    zip.addFile("data.json", Buffer.from(JSON.stringify(data), "utf8"));
    if (node_fs_1.default.existsSync(UPLOADS)) {
        for (const entry of node_fs_1.default.readdirSync(UPLOADS, { withFileTypes: true })) {
            if (!entry.isFile())
                continue;
            zip.addFile(`uploads/${entry.name}`, node_fs_1.default.readFileSync(node_path_1.default.join(UPLOADS, entry.name)));
        }
    }
    const stamp = new Date()
        .toISOString()
        .slice(0, 16)
        .replace(/[-:]/g, "")
        .replace("T", "-");
    const filename = `ajyal-backup-${stamp}.zip`;
    const full = node_path_1.default.join(ensureBackupsDir(), filename);
    zip.writeZip(full);
    return {
        name: filename,
        path: full,
        bytes: node_fs_1.default.statSync(full).size,
        tables: counts,
    };
};
exports.backupService = backupService;
// --------------------------------------------------
// الاستعادة — القاعدةُ تعود كما كانت لحظةَ النسخ
// --------------------------------------------------
const restoreService = async (source) => {
    const archive = Buffer.isBuffer(source)
        ? source
        : (await (0, exports.readBackupService)(source.name)).buffer;
    let zip;
    try {
        zip = new adm_zip_1.default(archive);
    }
    catch {
        throw new app_errors_1.BadRequestException("الملف ليس نسخةً احتياطية صالحة", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    const manifestEntry = zip.getEntry("manifest.json");
    const dataEntry = zip.getEntry("data.json");
    if (!manifestEntry || !dataEntry) {
        throw new app_errors_1.NotFoundException("الملف لا يحمل نسخةً من هذا البرنامج — لا يحوي manifest.json و data.json", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    const manifest = JSON.parse(manifestEntry.getData().toString("utf8"));
    if (manifest.app !== "ajyal-school" || manifest.format !== 1) {
        throw new app_errors_1.BadRequestException("صيغةُ النسخة غير مدعومة في هذه النسخة من البرنامج", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    const data = JSON.parse(dataEntry.getData().toString("utf8"));
    const tables = await listTables();
    const restored = {};
    await client_1.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
        try {
            for (const table of tables) {
                await tx.$executeRawUnsafe(`DELETE FROM ${quote(table)}`);
            }
            for (const table of tables) {
                const rows = data[table];
                if (!rows || rows.length === 0)
                    continue;
                const columns = Object.keys(rows[0]);
                const columnList = columns.map(quote).join(", ");
                const placeholders = `(${columns.map(() => "?").join(", ")})`;
                /* دفعاتٌ من مئة — استعلامٌ واحدٌ لعشرة آلاف صفٍّ يتجاوز حدَّ الحزمة */
                for (let at = 0; at < rows.length; at += 100) {
                    const batch = rows.slice(at, at + 100);
                    const values = [];
                    for (const row of batch) {
                        for (const column of columns)
                            values.push(decode(row[column]));
                    }
                    await tx.$executeRawUnsafe(`INSERT INTO ${quote(table)} (${columnList}) VALUES ` +
                        batch.map(() => placeholders).join(", "), ...values);
                }
                restored[table] = rows.length;
            }
        }
        finally {
            await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
        }
    }, TX);
    /* المرفوعات: تُكتب فوق ما يماثلها ولا يُمحى ما ليس فيها */
    let files = 0;
    if (!node_fs_1.default.existsSync(UPLOADS))
        node_fs_1.default.mkdirSync(UPLOADS, { recursive: true });
    for (const entry of zip.getEntries()) {
        if (entry.isDirectory || !entry.entryName.startsWith("uploads/"))
            continue;
        /* اسمُ الملفّ وحده — لا يُبنى مسارٌ من داخل الأرشيف */
        const name = node_path_1.default.basename(entry.entryName);
        if (!name)
            continue;
        node_fs_1.default.writeFileSync(node_path_1.default.join(UPLOADS, name), entry.getData());
        files++;
    }
    return { tables: restored, files };
};
exports.restoreService = restoreService;
// --------------------------------------------------
// إعادة التهيئة — محوٌ لا رجعة فيه
// --------------------------------------------------
const resetService = async (body) => {
    const tables = await listTables();
    const kept = asSet(ALWAYS_KEPT);
    for (const group of body.keep ?? []) {
        for (const table of exports.KEEP_GROUPS[group] ?? [])
            kept.add(norm(table));
    }
    /*
     * حارسٌ أخير: لو خلت قائمةُ المحميّات من الحسابات لأيّ سبب — تغيُّر
     * اسمِ جدولٍ في المخطَّط، أو خادمٌ يُرجع الأسماء بحالةٍ ثالثة — يُوقَف
     * المحوُ ولا يُكمَل. الخطأُ هنا لا يُصحَّح بعد وقوعه.
     */
    const missing = ALWAYS_KEPT.filter((name) => !tables.some((table) => norm(table) === norm(name)));
    if (missing.length > 0) {
        throw new app_errors_1.BadRequestException(`تعذّر التعرّف على جداول الحسابات (${missing.join(", ")}) — أُوقفت إعادة التهيئة`, error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    const wiped = tables.filter((table) => !kept.has(norm(table)));
    const deleted = {};
    await client_1.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
        try {
            for (const table of wiped) {
                const before = await tx.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM ${quote(table)}`);
                await tx.$executeRawUnsafe(`DELETE FROM ${quote(table)}`);
                deleted[table] = Number(before[0]?.n ?? 0);
            }
        }
        finally {
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
    if (body.purgeFiles && node_fs_1.default.existsSync(UPLOADS)) {
        const referenced = new Set();
        for (const table of tables) {
            const rows = await client_1.prisma.$queryRawUnsafe(`SELECT * FROM ${quote(table)}`);
            for (const row of rows) {
                for (const value of Object.values(row)) {
                    if (typeof value !== "string")
                        continue;
                    for (const part of value.split(/[\\/"'\s,]+/)) {
                        if (part)
                            referenced.add(node_path_1.default.basename(part));
                    }
                }
            }
        }
        for (const entry of node_fs_1.default.readdirSync(UPLOADS, { withFileTypes: true })) {
            if (!entry.isFile() || referenced.has(entry.name))
                continue;
            node_fs_1.default.unlinkSync(node_path_1.default.join(UPLOADS, entry.name));
            purged++;
        }
    }
    return {
        deleted,
        kept: tables.filter((table) => kept.has(norm(table))).sort(),
        purgedFiles: purged,
    };
};
exports.resetService = resetService;
//# sourceMappingURL=maintenance.service.js.map