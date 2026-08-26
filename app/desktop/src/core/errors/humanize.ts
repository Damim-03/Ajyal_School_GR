import { fieldLabel, type FieldLabel } from "./field-labels";

/**
 * **من رسالة الخادم إلى جملةٍ يقرأها موظّف الاستقبال.**
 *
 * الخادم يردّ «First name must be at least 2 characters» ورمزاً مثل
 * `VALIDATION_ERROR`. وهذه لغةُ من كتب الشيفرة، لا لغةُ من يسجّل
 * الطلبة. فتُترجَم هنا إلى «الاسم لا يقلّ عن حرفين».
 *
 * **والترجمةُ قاعديّةٌ لا قاموسيّة.** في الخادم مئةٌ وثمانٍ وستّون
 * صيغةَ رسالة، وقاموسٌ لها كلِّها يتعفّن عند أوّل حقلٍ جديد. فيُقرأ
 * من الرسالة **نوعُ المخالفة** وحده (أقلُّ من كذا، مطلوب، مكرَّر…)،
 * ويأتي اسمُ الحقل من `field` عبر [[field-labels]] — فحقلٌ جديد
 * يُترجَم من نفسه ما دام نوعُ مخالفته معروفاً.
 */

// --------------------------------------------------
// عددُ العربية
// --------------------------------------------------

/**
 * المعدود يتبع عددَه، ولا يُكتب «2 حرف».
 *
 * الواحدُ والاثنان بصيغتهما، ومن ثلاثةٍ إلى عشرة جمعُ قلّة، وما
 * فوقها مفردٌ منصوب. وهذا ما يفرّق «حرفين» من «2 حرف».
 */
const counted = (
  n: number,
  forms: { one: string; two: string; few: string; many: string },
): string => {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (n >= 3 && n <= 10) return `${n} ${forms.few}`;
  return `${n} ${forms.many}`;
};

const chars = (n: number) =>
  counted(n, {
    one: "حرفٍ واحد",
    two: "حرفين",
    few: "أحرف",
    many: "حرفاً",
  });

const days = (n: number) =>
  counted(n, { one: "يومٍ واحد", two: "يومين", few: "أيام", many: "يوماً" });

const items = (n: number) =>
  counted(n, { one: "عنصرٍ واحد", two: "عنصرين", few: "عناصر", many: "عنصراً" });

// --------------------------------------------------
// مطابقة الفعل للتسمية
// --------------------------------------------------

const required = (l: FieldLabel) => `${l.text} مطلوب${l.f ? "ة" : ""}`;
const notLess = (l: FieldLabel) => `${l.text} ${l.f ? "لا تقلّ" : "لا يقلّ"}`;
const notMore = (l: FieldLabel) =>
  `${l.text} ${l.f ? "لا تتجاوز" : "لا يتجاوز"}`;
const mustBe = (l: FieldLabel) =>
  `${l.text} يجب أن ${l.f ? "تكون" : "يكون"}`;

// --------------------------------------------------
// قواعد المخالفات
// --------------------------------------------------

type Rule = {
  readonly test: RegExp;
  readonly build: (l: FieldLabel, m: RegExpMatchArray) => string;
};

/**
 * تُجرَّب بالترتيب، وأخصُّها أوّلاً.
 *
 * فـ«must not exceed 50 characters» تسبق «must not exceed 50»،
 * وإلّا التقطتها الثانيةُ وضاعت كلمةُ «حرفاً».
 */
const RULES: readonly Rule[] = [
  {
    test: /(?:is|are) required|must not be empty|cannot be empty/i,
    build: (l) => required(l),
  },

  /*
   * صيغُ zod الافتراضية — تظهر حين لا يكتب المخطّطُ رسالةً خاصّة.
   * «Too small: expected number to be >0» و«Too big: expected string
   * to have <=50 characters».
   */
  {
    test: /too big:.*<=\s*(\d+) characters?/i,
    build: (l, m) => `${notMore(l)} ${chars(Number(m[1]))}`,
  },
  {
    test: /too small:.*>=?\s*(\d+) characters?/i,
    build: (l, m) => `${notLess(l)} عن ${chars(Number(m[1]))}`,
  },
  {
    test: /too small:.*to be >\s*0(?![\d.])/i,
    build: (l) => `${mustBe(l)} أكبر من صفر`,
  },
  {
    test: /too small:.*to be >=?\s*(\d+)/i,
    build: (l, m) => `${notLess(l)} عن ${m[1]}`,
  },
  {
    test: /too big:.*to be <=?\s*(\d+)/i,
    build: (l, m) => `${notMore(l)} ${m[1]}`,
  },
  /*
   * «received undefined» تعني حقلاً لم يُرسَل — أي فارغاً، لا خاطئاً.
   * وقولُ «غير صالح» لحقلٍ لم يُملأ يُرسل الموظّفَ يفتّش عن خطأٍ في
   * قيمةٍ لا وجود لها.
   */
  {
    test: /received (?:undefined|null|nan)/i,
    build: (l) => required(l),
  },
  {
    test: /invalid input: expected/i,
    build: (l) => `${l.text} غير صالح${l.f ? "ة" : ""}`,
  },

  {
    test: /must be at least (\d+) characters?/i,
    build: (l, m) => `${notLess(l)} عن ${chars(Number(m[1]))}`,
  },
  {
    test: /must not exceed (\d+) characters?/i,
    build: (l, m) => `${notMore(l)} ${chars(Number(m[1]))}`,
  },
  {
    test: /(?:date range )?must not exceed (\d+) days?/i,
    build: (l, m) => `${notMore(l)} ${days(Number(m[1]))}`,
  },

  {
    test: /must be at least (\d+)/i,
    build: (l, m) => `${notLess(l)} عن ${m[1]}`,
  },
  {
    test: /must not exceed (\d+)/i,
    build: (l, m) => `${notMore(l)} ${m[1]}`,
  },
  {
    test: /must be greater than (\d+)/i,
    build: (l, m) =>
      Number(m[1]) === 0
        ? `${mustBe(l)} أكبر من صفر`
        : `${mustBe(l)} أكبر من ${m[1]}`,
  },
  {
    test: /must not be negative|must be positive/i,
    build: (l) => `${mustBe(l)} موجباً`,
  },
  { test: /is too large|too big/i, build: (l) => `${l.text} أكبر ممّا يُقبل` },

  { test: /must be in the past/i, build: (l) => `${mustBe(l)} في الماضي` },
  {
    test: /must be after (?:the )?start date/i,
    build: (l) => `${mustBe(l)} بعد تاريخ البداية`,
  },
  {
    test: /must not be before (?:the )?start date/i,
    build: (l) => `${l.text} ${l.f ? "لا تسبق" : "لا يسبق"} تاريخ البداية`,
  },
  {
    test: /must be a valid|invalid|is not valid/i,
    build: (l) => `${l.text} غير صالح${l.f ? "ة" : ""}`,
  },
  {
    test: /hex value|must be a color/i,
    build: (l) => `${mustBe(l)} لوناً بصيغة ‎#RRGGBB`,
  },
  {
    test: /must be a valid email|email/i,
    build: (l) => `${l.text} غير صالح — يُكتب بصيغة name@example.com`,
  },

  {
    test: /at least one .* must be (?:selected|provided|paid|chosen)/i,
    build: (l) => `يجب اختيار عنصرٍ واحد على الأقلّ من ${l.text}`,
  },
  {
    test: /at least one field must be provided/i,
    build: () => "لم تُغيَّر أيّ قيمة — عدّل حقلاً واحداً على الأقلّ",
  },
  {
    test: /cannot .* more than (\d+)/i,
    build: (l, m) => `${notMore(l)} ${items(Number(m[1]))} في المرّة الواحدة`,
  },
  {
    test: /duplicate/i,
    build: (l) => `${l.text} ${l.f ? "مكرّرة" : "مكرّر"} في القائمة`,
  },
];

/** قائمةُ خياراتٍ في رسالةٍ مثل «must be A, B or C» */
const enumChoices = (message: string): string[] | null => {
  const m = message.match(/must be ((?:[A-Z_]+(?:, )?)+(?: or [A-Z_]+)?)/);
  if (!m) return null;

  const parts = m[1]
    .split(/,\s*|\s+or\s+/)
    .map((s) => s.trim())
    .filter((s) => /^[A-Z_]{2,}$/.test(s));

  return parts.length ? parts : null;
};

/**
 * ترجمةُ مخالفةٍ واحدة.
 *
 * وحين يتعذّر التعرّف على النوع أو على الحقل، تُبنى جملةٌ عامّة —
 * ولا تُعرض الرسالةُ الإنجليزية أبداً: عرضُها يُعيد المستخدمَ إلى
 * ما جئنا نُخرجه منه.
 */
export const humanizeIssue = (issue: {
  field?: string;
  message?: string;
}): string => {
  const label = issue.field ? fieldLabel(issue.field) : null;
  const message = (issue.message ?? "").trim();

  /*
   * رسالةٌ عربيّةٌ أصلاً تمرّ كما هي.
   *
   * بعضُ مخطّطات الخادم كُتبت رسائلُها بالعربية للمستخدم مباشرةً
   * («اكتب ‹إعادة التهيئة› للتأكيد»)، وهي أدقُّ ممّا أبنيه من
   * القواعد لأنّها تعرف سياقَها. فتُصان ولا يُعاد تركيبها.
   */
  if (/[؀-ۿ]/.test(message)) return message;

  /*
   * مخالفةٌ على الكائن كلِّه لا على حقلٍ بعينه — `field` فارغ.
   * تُعالَج قبل البحث عن تسمية، وإلّا سقطت في الجملة العامّة.
   */
  if (!label && /at least one field must be provided/i.test(message)) {
    return "لم تُغيَّر أيّ قيمة — عدّل حقلاً واحداً على الأقلّ";
  }

  const choices = enumChoices(message);
  if (label && choices) {
    return `${mustBe(label)} إحدى القيم: ${choices.join(" أو ")}`;
  }

  if (label) {
    for (const rule of RULES) {
      const m = message.match(rule.test);
      if (m) return rule.build(label, m);
    }
    return `${l_(label)} غير مقبولة`;
  }

  /* حقلٌ لا نعرف تسميتَه — جملةٌ عامّة تصف الحالة بلا اسمٍ برمجيّ */
  if (/is required/i.test(message)) return "حقلٌ مطلوب لم يُملأ";

  return "قيمةٌ غير مقبولة في أحد الحقول";
};

const l_ = (l: FieldLabel) => `قيمة ${l.text}`;

// --------------------------------------------------
// رموز الخادم
// --------------------------------------------------

/**
 * الرمزُ أصدقُ من الرسالة.
 *
 * نصُّ الرسالة يتبدّل بتبدّل الشيفرة، والرمزُ عقدٌ ثابت. فيُترجَم
 * الرمزُ أوّلاً، ولا يُنظر إلى النصّ إلّا حين لا رمزَ معروفاً.
 */
const CODE_MESSAGES: Readonly<Record<string, string>> = {
  // المصادقة
  AUTH_INVALID_CREDENTIALS: "اسم المستخدم أو كلمة المرور غير صحيحة",
  AUTH_TOKEN_NOT_FOUND: "انتهت الجلسة — سجّل الدخول من جديد",
  AUTH_INVALID_TOKEN: "انتهت الجلسة — سجّل الدخول من جديد",
  AUTH_TOKEN_EXPIRED: "انتهت مدّة الجلسة — سجّل الدخول من جديد",
  AUTH_USER_NOT_FOUND: "لا حساب بهذا الاسم",
  AUTH_ACCOUNT_SUSPENDED: "هذا الحساب موقوف — راجع مدير النظام",
  AUTH_TOO_MANY_ATTEMPTS: "محاولاتٌ كثيرة متتالية — انتظر قليلاً ثمّ أعِد المحاولة",

  // الصلاحيات
  ACCESS_UNAUTHORIZED: "سجّل الدخول للمتابعة",
  ACCESS_FORBIDDEN: "لا تملك صلاحيةً لهذا الإجراء — راجع مدير النظام",

  // عامّ
  RESOURCE_NOT_FOUND: "لم يُعثر على المطلوب — قد يكون حُذف",
  RESOURCE_ALREADY_EXISTS: "هذا العنصر مسجَّلٌ من قبل",
  RESOURCE_IN_USE: "لا يمكن الحذف — العنصر مرتبطٌ بسجلّاتٍ أخرى",

  // البنية الدراسية
  ACADEMIC_YEAR_NOT_FOUND: "لم يُعثر على السنة الدراسية",
  ACADEMIC_YEAR_ALREADY_EXISTS: "هذه السنة الدراسية مسجَّلةٌ من قبل",
  EDUCATION_STAGE_NOT_FOUND: "لم يُعثر على الطور",
  LEVEL_NOT_FOUND: "لم يُعثر على المستوى",
  STUDY_GROUP_NOT_FOUND: "لم يُعثر على الفوج",
  SUBJECT_NOT_FOUND: "لم يُعثر على المادة",
  TEACHER_NOT_FOUND: "لم يُعثر على الأستاذ",
  TEACHING_ASSIGNMENT_NOT_FOUND: "لم يُعثر على الإسناد",
  TEACHING_ASSIGNMENT_EXISTS: "هذا الإسناد موجودٌ من قبل",

  // الطلبة والتسجيلات
  STUDENT_NOT_FOUND: "لم يُعثر على الطالب",
  ENROLLMENT_NOT_FOUND: "لم يُعثر على التسجيل",
  ENROLLMENT_ALREADY_EXISTS: "الطالب مسجَّلٌ في هذه المادة من قبل",

  // الجدولة
  SCHEDULE_NOT_FOUND: "لم يُعثر على الحصة المجدولة",
  SCHEDULE_CONFLICT: "الوقت محجوز — تعارضٌ في القاعة أو الأستاذ أو الفوج",
  SESSION_NOT_FOUND: "لم يُعثر على الحصة",

  // المال
  INVOICE_NOT_FOUND: "لم يُعثر على الفاتورة",
  INVOICE_ALREADY_EXISTS: "الفاتورة صادرةٌ من قبل لهذا الشهر",
  INVOICE_ALREADY_PAID: "الفاتورة مدفوعةٌ بالكامل",
  INVOICE_CANCELLED: "الفاتورة ملغاة — لا تقبل الدفع",
  PAYMENT_NOT_FOUND: "لم يُعثر على الدفعة",
  PAYMENT_AMOUNT_INVALID: "المبلغ غير مقبول — راجع المبلغ المتبقّي",
  RECEIPT_NOT_FOUND: "لم يُعثر على الإيصال",
  TUITION_FEE_NOT_FOUND: "لم يُحدَّد سعرٌ لهذه المادة في هذه السنة",

  // التخليص
  SETTLEMENT_NOT_FOUND: "لم يُعثر على التخليص",
  SETTLEMENT_POLICY_NOT_FOUND: "لم يُعثر على سياسة التخليص",
  SETTLEMENT_LOCKED: "التخليص مؤكَّد — لا يُعاد حسابه ولا يُعدَّل",
  SETTLEMENT_ALREADY_EXISTS: "التخليص محسوبٌ من قبل لهذه المدّة",

  // التهيئة الأولى
  SETUP_ALREADY_COMPLETED: "التهيئة تمّت من قبل",
  SETUP_STEP_OUT_OF_ORDER: "أكمِل الخطوات بترتيبها",
  SETUP_VERIFICATION_FAILED: "التحقّق النهائي لم يمرّ — راجع ما نقص",
  SETUP_DEVICE_MISSING: "جهازٌ مطلوبٌ غيرُ متّصل",
  SETUP_INCOMPLETE: "أكمِل تهيئة النظام أوّلاً",
};

// --------------------------------------------------
// المُركِّب
// --------------------------------------------------

export interface ApiErrorBody {
  message?: string;
  errorCode?: string;
  error?: string;
  errors?: { field?: string; message?: string }[];
}

/** أكثرُ من ثلاثٍ يصير جداراً لا رسالة */
const MAX_ISSUES = 3;

/**
 * الجملةُ التي تُعرض للمستخدم.
 *
 * ترتيبُ الترجيح: مخالفاتُ الحقول أوّلاً (أدقُّها وأقربُها إلى ما
 * فعله المستخدم)، ثمّ رمزُ الخادم، ثمّ جملةٌ عامّة بحسب الحالة.
 */
export const humanizeApiError = (
  body: ApiErrorBody | undefined,
  status?: number,
): string => {
  const issues = body?.errors?.filter((i) => i.field || i.message) ?? [];

  if (issues.length) {
    const lines = issues.slice(0, MAX_ISSUES).map(humanizeIssue);
    const rest = issues.length - lines.length;

    return rest > 0
      ? `${lines.join(" · ")} · و${items(rest)} آخر`
      : lines.join(" · ");
  }

  const byCode = body?.errorCode ? CODE_MESSAGES[body.errorCode] : undefined;
  if (byCode) return byCode;

  /*
   * 5xx: عطبٌ في الخادم لا خطأٌ من المستخدم. فلا يُطلب منه تصحيحُ
   * شيء، ولا يُعرض له نصُّ الاستثناء — يبقى في `error` بالرد وفي
   * سجلّ الخادم لمن يشخّص.
   */
  if (status && status >= 500) {
    return "تعذّر إتمام العملية — عطبٌ في الخادم. أعِد المحاولة، وإن تكرّر فأبلغ مدير النظام";
  }

  if (status === 404) return "لم يُعثر على المطلوب";
  if (status === 403) return "لا تملك صلاحيةً لهذا الإجراء";
  if (status === 401) return "سجّل الدخول للمتابعة";
  if (status === 429) return "طلباتٌ كثيرة متتالية — انتظر قليلاً";

  return "تعذّر إتمام العملية";
};
