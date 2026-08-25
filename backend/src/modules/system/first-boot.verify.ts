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

import { FIRST_BOOT_VERSION, TERMS_VERSION } from "./first-boot.state";

/** ما يُقاس — لقطةٌ من الواقع، لا من الواجهة */
export interface VerificationSnapshot {
  /** هل ردَّت القاعدةُ على استعلامٍ بسيط؟ */
  databaseReachable: boolean;
  /** هل الجداولُ التي يحتاجها النظام موجودةٌ ومقروءة؟ */
  schemaReadable: boolean;
  language: string;
  country: string;
  timezone: string;
  dateFormat: string;
  /** اسمُ المؤسسة كما هو مضبوطٌ فعلاً — لا الافتراضيّ */
  institutionName: string;
  /** عددُ المستخدمين النشطين الذين يحملون دورَ المدير */
  activeAdministrators: number;
  /** هل دورُ المدير موجود؟ */
  adminRoleExists: boolean;
  /** عددُ صلاحيات دور المدير */
  adminPermissions: number;
  acceptedTermsVersion: string;
  /** السنواتُ المعلَّمة «جارية» — يجب أن تكون واحدةً بالضبط */
  currentAcademicYears: number;
  /** هل تواريخُ السنة الجارية سليمة (النهايةُ بعد البداية)؟ */
  academicYearDatesValid: boolean;
  /** ملخّصُ الأجهزة المسجَّل — الأجهزةُ اختياريةٌ، والتسجيلُ ليس كذلك */
  devicesRecorded: boolean;
  appVersion: string;
  firstBootVersion: string;
}

export type CheckKey =
  | "database"
  | "schema"
  | "language"
  | "region"
  | "institution"
  | "administrator"
  | "role"
  | "permissions"
  | "terms"
  | "academicYear"
  | "devices"
  | "appVersion";

export interface CheckResult {
  key: CheckKey;
  ok: boolean;
  /** تفصيلٌ تقنيّ للسجلّ — لا يُعرض نصّاً للمستخدم */
  detail?: string;
}

/**
 * الحكمُ على اللقطة.
 *
 * والترتيبُ مقصود: القاعدةُ أوّلاً لأنّ سقوطَها يُفسّر كلَّ ما بعده،
 * فإن ظهرت للمستخدم قائمةٌ حمراءُ كلُّها كان أوّلُ سطرٍ فيها هو السبب.
 */
export const evaluateChecks = (
  snapshot: VerificationSnapshot,
): CheckResult[] => {
  const checks: CheckResult[] = [];

  const push = (key: CheckKey, ok: boolean, detail?: string) =>
    checks.push(detail ? { key, ok, detail } : { key, ok });

  push("database", snapshot.databaseReachable);
  push("schema", snapshot.schemaReadable);

  push("language", snapshot.language.trim().length > 0);

  push(
    "region",
    snapshot.country.trim().length > 0 &&
      snapshot.timezone.trim().length > 0 &&
      snapshot.dateFormat.trim().length > 0,
  );

  push("institution", snapshot.institutionName.trim().length >= 2);

  /*
   * مديرٌ **نشط** لا مجرّد صفٍّ في الجدول: حسابٌ أُنشئ ثمّ عُطِّل
   * يترك التركيبَ بلا أحدٍ يستطيع الدخول — وهو نقيضُ ما تعنيه هذه
   * الخطوة.
   */
  push(
    "administrator",
    snapshot.activeAdministrators >= 1,
    `active=${snapshot.activeAdministrators}`,
  );

  push("role", snapshot.adminRoleExists);

  push(
    "permissions",
    snapshot.adminPermissions > 0,
    `granted=${snapshot.adminPermissions}`,
  );

  push(
    "terms",
    snapshot.acceptedTermsVersion === TERMS_VERSION,
    `accepted=${snapshot.acceptedTermsVersion || "—"} expected=${TERMS_VERSION}`,
  );

  /*
   * سنةٌ جاريةٌ **واحدة** بالضبط.
   *
   * الصفرُ يترك نصفَ الشاشات بلا سياق. والاثنتان أسوأُ من الصفر: كلُّ
   * استعلامٍ يأخذ `findFirst({ isCurrent: true })` فيقع على أيّهما
   * شاء الترتيب، فتُقيَّد الفواتيرُ في سنةٍ والحضورُ في أخرى بلا خطأٍ
   * ظاهر.
   */
  push(
    "academicYear",
    snapshot.currentAcademicYears === 1 && snapshot.academicYearDatesValid,
    `current=${snapshot.currentAcademicYears} dates=${snapshot.academicYearDatesValid}`,
  );

  push("devices", snapshot.devicesRecorded);

  push(
    "appVersion",
    snapshot.appVersion.trim().length > 0 &&
      snapshot.firstBootVersion === FIRST_BOOT_VERSION,
    `app=${snapshot.appVersion || "—"} boot=${snapshot.firstBootVersion || "—"}`,
  );

  return checks;
};

export const allPassed = (checks: CheckResult[]): boolean =>
  checks.every((check) => check.ok);

export const failedKeys = (checks: CheckResult[]): CheckKey[] =>
  checks.filter((check) => !check.ok).map((check) => check.key);
