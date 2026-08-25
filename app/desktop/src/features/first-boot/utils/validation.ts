/**
 * تحقّقُ الواجهة — **للإرشاد لا للحماية**.
 *
 * والحمايةُ في `backend/src/modules/system/first-boot.schema.ts`،
 * وقواعدُها هي هذه بعينها. والنسخُ مقصودٌ ومعلوم: هذه تُري المستخدمَ
 * قاعدةً تُستوفى وهو يكتب، وتلك ترفض طلباً يصل من أيّ مكان (§40).
 *
 * وكلُّ ما هنا دوالُّ خالصةٌ تُختبر بلا DOM (`validation.test.ts`).
 */

// --------------------------------------------------
// كلمة المرور
// --------------------------------------------------

export type PasswordRuleKey =
  | "length"
  | "upper"
  | "lower"
  | "digit"
  | "symbol";

export const PASSWORD_MIN = 10;

const RULES: { key: PasswordRuleKey; test: (value: string) => boolean }[] = [
  { key: "length", test: (value) => value.length >= PASSWORD_MIN },
  { key: "upper", test: (value) => /[A-Z]/.test(value) },
  { key: "lower", test: (value) => /[a-z]/.test(value) },
  { key: "digit", test: (value) => /[0-9]/.test(value) },
  { key: "symbol", test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export interface PasswordCheck {
  key: PasswordRuleKey;
  ok: boolean;
}

export const checkPassword = (value: string): PasswordCheck[] =>
  RULES.map((rule) => ({ key: rule.key, ok: rule.test(value) }));

export const passwordSatisfied = (value: string): boolean =>
  RULES.every((rule) => rule.test(value));

// --------------------------------------------------
// اسم الدخول
// --------------------------------------------------

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export const usernameValid = (value: string): boolean => {
  const trimmed = value.trim();

  return (
    trimmed.length >= 3 &&
    trimmed.length <= 32 &&
    USERNAME_PATTERN.test(trimmed)
  );
};

/**
 * اقتراحُ اسمِ دخولٍ من الاسم واللقب.
 *
 * وهي راحةٌ صغيرةٌ ذاتُ أثر: أكثرُ من يمرّ بهذه الشاشة ليس تقنياً،
 * وحقلٌ فارغٌ بقاعدةٍ محرفيّة (لاتينيٌّ فقط) بإزاء اسمٍ عربيٍّ كُتب
 * للتوّ هو أوّلُ موضعٍ يتوقّف عنده. فيُقترح ما يمكن اشتقاقُه، ويبقى
 * الحقلُ حرّاً.
 */
export const suggestUsername = (firstName: string, lastName: string): string => {
  const latin = `${firstName} ${lastName}`
    .normalize("NFD")
    /* تُنزع العلاماتُ التشكيلية فيصير «José» → «Jose» */
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  return latin.length >= 3 ? latin.slice(0, 32) : "";
};

// --------------------------------------------------
// المؤسسة
// --------------------------------------------------

export const institutionNameValid = (value: string): boolean =>
  value.trim().length >= 2 && value.trim().length <= 120;

export const emailValid = (value: string): boolean => {
  const trimmed = value.trim();

  if (trimmed === "") return true; // اختياريّ

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) && trimmed.length <= 120;
};

// --------------------------------------------------
// السنة الدراسية
// --------------------------------------------------

export interface AcademicYearDraft {
  name: string;
  startDate: string;
  endDate: string;
  sessionsPerMonth: number;
}

export type AcademicYearIssue =
  | "name"
  | "startDate"
  | "endDate"
  | "order"
  | "sessions";

export const academicYearIssues = (
  draft: AcademicYearDraft,
): AcademicYearIssue[] => {
  const issues: AcademicYearIssue[] = [];

  if (draft.name.trim().length < 4) issues.push("name");
  if (!draft.startDate) issues.push("startDate");
  if (!draft.endDate) issues.push("endDate");

  if (draft.startDate && draft.endDate) {
    /*
     * المقارنةُ نصّيةٌ لأنّ الحقلَ `<input type="date">` يعطي
     * `YYYY-MM-DD` دائماً — وهي صيغةٌ ترتيبُها المعجميُّ هو ترتيبُها
     * الزمنيّ. وبناءُ `Date` منها يُدخل المنطقةَ الزمنية في مقارنةٍ
     * لا شأنَ لها بها، فيقع اليومُ الواحد قبلَ نفسِه أو بعده.
     */
    if (draft.endDate <= draft.startDate) issues.push("order");
  }

  if (
    !Number.isInteger(draft.sessionsPerMonth) ||
    draft.sessionsPerMonth < 1 ||
    draft.sessionsPerMonth > 31
  ) {
    issues.push("sessions");
  }

  return issues;
};

/**
 * اقتراحُ سنةٍ من تاريخ اليوم.
 *
 * والقاعدةُ المعمولُ بها في المؤسسات هنا: السنةُ تبدأ في سبتمبر
 * وتنتهي في جوان. فمن فتح البرنامجَ في أكتوبر 2026 يُقترح له
 * «2026/2027»، ومن فتحه في مارس 2027 يُقترح له **2026/2027 أيضاً** —
 * لأنّه في وسط السنة لا في مطلع التالية. وهذا الفرقُ هو كلُّ فائدة
 * الاقتراح؛ ولولاه لكان الحقلُ فارغاً أسلمَ.
 */
export const suggestAcademicYear = (today = new Date()): AcademicYearDraft => {
  const year = today.getFullYear();
  const month = today.getMonth(); // 0 = جانفي

  /* من جويلية (6) فصاعداً نحن في مطلع سنةٍ جديدة */
  const startYear = month >= 6 ? year : year - 1;
  const endYear = startYear + 1;

  return {
    name: `${startYear}/${endYear}`,
    startDate: `${startYear}-09-01`,
    endDate: `${endYear}-06-30`,
    sessionsPerMonth: 8,
  };
};

// --------------------------------------------------
// الشبكة
// --------------------------------------------------

export const hostValid = (value: string): boolean => {
  const trimmed = value.trim();

  if (trimmed === "") return false;

  /* اسمُ مضيفٍ أو عنوانُ IPv4 — ولا مسافاتٍ ولا شرطةَ مائلة */
  return /^[a-zA-Z0-9._-]+$/.test(trimmed);
};

export const portValid = (value: string | number): boolean => {
  const port = Number(value);

  return Number.isInteger(port) && port > 0 && port <= 65535;
};
