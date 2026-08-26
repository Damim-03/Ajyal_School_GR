"use strict";
/**
 * التحقّقُ النهائي — الفصلُ بين **الجمع** و**الحكم**.
 *
 * الجمعُ يلمس القاعدةَ (`first-boot.service.ts`)، والحكمُ هنا: دالّةٌ
 * خالصةٌ تأخذ لقطةً وتقول ما نقص. والفائدةُ ليست تنظيمية — هي التي
 * تجعل «ماذا يحدث إن كانت السنةُ الجارية مكرّرة؟» سؤالاً يُجاب عنه في
 * اختبارٍ يعمل في مِللي ثانية بلا قاعدةِ بيانات (§60).
 *
 * وكلُّ فحصٍ يحمل مفتاحاً ثابتاً: الواجهةُ تترجمه، فلا تُرسَل إليها
 * جملةٌ عربيةٌ يتعذّر عرضُها بالفرنسية (§46).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.failedKeys = exports.allPassed = exports.evaluateChecks = void 0;
const first_boot_state_1 = require("./first-boot.state");
/**
 * الحكمُ على اللقطة.
 *
 * والترتيبُ مقصود: القاعدةُ أوّلاً لأنّ سقوطَها يُفسّر كلَّ ما بعده،
 * فإن ظهرت للمستخدم قائمةٌ حمراءُ كلُّها كان أوّلُ سطرٍ فيها هو السبب.
 */
const evaluateChecks = (snapshot) => {
    const checks = [];
    const push = (key, ok, detail) => checks.push(detail ? { key, ok, detail } : { key, ok });
    push("database", snapshot.databaseReachable);
    push("schema", snapshot.schemaReadable);
    push("language", snapshot.language.trim().length > 0);
    push("region", snapshot.country.trim().length > 0 &&
        snapshot.timezone.trim().length > 0 &&
        snapshot.dateFormat.trim().length > 0);
    push("institution", snapshot.institutionName.trim().length >= 2);
    /*
     * مديرٌ **نشط** لا مجرّد صفٍّ في الجدول: حسابٌ أُنشئ ثمّ عُطِّل
     * يترك التركيبَ بلا أحدٍ يستطيع الدخول — وهو نقيضُ ما تعنيه هذه
     * الخطوة.
     */
    push("administrator", snapshot.activeAdministrators >= 1, `active=${snapshot.activeAdministrators}`);
    push("role", snapshot.adminRoleExists);
    push("permissions", snapshot.adminPermissions > 0, `granted=${snapshot.adminPermissions}`);
    push("terms", snapshot.acceptedTermsVersion === first_boot_state_1.TERMS_VERSION, `accepted=${snapshot.acceptedTermsVersion || "—"} expected=${first_boot_state_1.TERMS_VERSION}`);
    /*
     * سنةٌ جاريةٌ **واحدة** بالضبط.
     *
     * الصفرُ يترك نصفَ الشاشات بلا سياق. والاثنتان أسوأُ من الصفر: كلُّ
     * استعلامٍ يأخذ `findFirst({ isCurrent: true })` فيقع على أيّهما
     * شاء الترتيب، فتُقيَّد الفواتيرُ في سنةٍ والحضورُ في أخرى بلا خطأٍ
     * ظاهر.
     */
    push("academicYear", snapshot.currentAcademicYears === 1 && snapshot.academicYearDatesValid, `current=${snapshot.currentAcademicYears} dates=${snapshot.academicYearDatesValid}`);
    push("devices", snapshot.devicesRecorded);
    push("appVersion", snapshot.appVersion.trim().length > 0 &&
        snapshot.firstBootVersion === first_boot_state_1.FIRST_BOOT_VERSION, `app=${snapshot.appVersion || "—"} boot=${snapshot.firstBootVersion || "—"}`);
    return checks;
};
exports.evaluateChecks = evaluateChecks;
const allPassed = (checks) => checks.every((check) => check.ok);
exports.allPassed = allPassed;
const failedKeys = (checks) => checks.filter((check) => !check.ok).map((check) => check.key);
exports.failedKeys = failedKeys;
//# sourceMappingURL=first-boot.verify.js.map