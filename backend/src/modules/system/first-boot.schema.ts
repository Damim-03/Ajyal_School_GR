/**
 * مخطّطاتُ التهيئة — التحقّقُ الذي يحمي، لا الذي يُجمّل.
 *
 * الواجهةُ تتحقّق أيضاً، وذلك للتجربة: أن يرى المستخدمُ خطأه قبل أن
 * يضغط. وهذا الملفُّ هو الحارس (§40): طلبٌ يصل من خارج الواجهة —
 * سكربتٌ أو أداةُ اختبار — يُقاس بالمقياس نفسِه.
 *
 * والرسائلُ بالعربية لأنّها تُسجَّل وتُقرأ من المطوّر؛ وما يُعرض
 * للمستخدم تترجمه الواجهةُ من مفتاح الحقل لا من هذا النصّ (§41).
 */

import { z } from "zod";

import {
  DATE_FORMATS,
  DENSITIES,
  LANGUAGES,
  NETWORK_MODES,
  PERFORMANCE_PROFILES,
  UI_SCALES,
  WINDOW_MODES,
} from "./first-boot.keys";
import { FIRST_BOOT_STEPS } from "./first-boot.state";

// --------------------------------------------------
// 02 — اللغة
// --------------------------------------------------

export const languageSchema = z.object({
  language: z.enum(LANGUAGES),
});

// --------------------------------------------------
// 03 — المنطقة والوقت
// --------------------------------------------------

export const regionSchema = z.object({
  country: z.string().trim().min(2, "الدولة مطلوبة").max(64),
  /*
   * المنطقةُ الزمنية تُقاس بأنّ البيئةَ تعرفها لا بقائمةٍ مكتوبة:
   * قوائمُ IANA تتغيّر مع تحديثات النظام، وقائمةٌ ثابتةٌ في الشيفرة
   * تعني رفضَ منطقةٍ صحيحةٍ بعد سنتين. و`Intl` هو المرجع الحيّ.
   */
  timezone: z
    .string()
    .trim()
    .min(1, "المنطقة الزمنية مطلوبة")
    .max(64)
    .refine(isKnownTimezone, "منطقةٌ زمنيةٌ غير معروفة"),
  dateFormat: z.enum(DATE_FORMATS),
});

function isKnownTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// --------------------------------------------------
// 04 — الشبكة
//
// والعنوانُ لا يُحفظ في القاعدة: هو **طريقُ هذا الجهاز إليها**،
// وحفظُه فيها دَورٌ مغلق (‏لتقرأه يجب أن تصل، ولتصل يجب أن تقرأه).
// فيبقى في الجهاز، والقاعدةُ تسجّل النمطَ وحده.
// --------------------------------------------------

export const networkSchema = z.object({
  mode: z.enum(NETWORK_MODES),
});

// --------------------------------------------------
// 05 — العرض
// --------------------------------------------------

export const displaySchema = z.object({
  uiScale: z.enum(UI_SCALES),
  density: z.enum(DENSITIES),
  windowMode: z.enum(WINDOW_MODES),
});

// --------------------------------------------------
// 06 — الأداء
// --------------------------------------------------

export const performanceSchema = z.object({
  profile: z.enum(PERFORMANCE_PROFILES),
});

// --------------------------------------------------
// 07 — الشروط
//
// `accepted: true` حرفياً لا `boolean`: الرفضُ ليس قيمةً تُحفظ،
// فالخطوةُ لا تُتمّ إلّا بالموافقة (§14). و`version` تأتي من الواجهة
// ويقارنها الخادمُ بنسخته — نصٌّ قديمٌ وُوفق عليه في جهازٍ لم يُحدَّث
// لا يُحسب موافقةً على النصّ الحالي.
// --------------------------------------------------

export const termsSchema = z.object({
  accepted: z.literal(true),
  version: z.string().trim().min(1).max(16),
});

// --------------------------------------------------
// 08 — التحديث
//
// لا تُصدّق الواجهةَ في «حدث التحديث»: كلُّ ما يُحفظ هنا **وقائع
// مقروءة** — أيّ نسخةٍ تعمل الآن ومتى فُحصت. والقناةُ تصف الآلية
// المتاحة فعلاً في هذا التركيب (§36).
// --------------------------------------------------

export const updateSchema = z.object({
  appVersion: z.string().trim().min(1, "نسخة التطبيق مطلوبة").max(32),
  channel: z.enum(["NONE", "MANUAL", "TAURI"]),
});

// --------------------------------------------------
// 09 — الأجهزة
//
// الملخّصُ يُحفظ نصّاً JSON. ولا صفوفَ لها: الأجهزةُ تُكتشف عند كل
// إقلاع، والمحفوظُ سِجلٌّ لما وُجد يومَ التركيب لا مرجعٌ يُعتمد عليه.
// --------------------------------------------------

const deviceEntry = z.object({
  kind: z.enum([
    "KEYBOARD",
    "POINTER",
    "DOCUMENT_PRINTER",
    "RECEIPT_PRINTER",
    "SCANNER",
    "BARCODE_SCANNER",
  ]),
  name: z.string().trim().max(120).default(""),
  /**
   * `REQUIRED` ⇔ لا يقوم التطبيق بدونه. ولوحةُ المفاتيح وحدَها كذلك
   * — وما عداها اختياريٌّ لا يوقف التهيئة (§37).
   */
  requirement: z.enum(["REQUIRED", "OPTIONAL"]),
  detected: z.boolean(),
  /** هل جُرّب فعلاً (طبعةُ اختبارٍ أو ضغطةُ مفتاح)؟ */
  verified: z.boolean().default(false),
});

export const devicesSchema = z.object({
  devices: z.array(deviceEntry).max(32),
});

// --------------------------------------------------
// 10 — المدير
//
// سياسةُ كلمة المرور هنا **وفي الواجهة** — والنسخُ مقصود: الواجهةُ
// تُرشد أثناء الكتابة، والخادمُ يرفض. ولو اكتُفي بالأولى لكان تجاوزُها
// طلباً واحداً بـcurl.
// --------------------------------------------------

const PASSWORD_RULES = [
  { test: /[A-Z]/, message: "يجب أن تحتوي حرفاً كبيراً" },
  { test: /[a-z]/, message: "يجب أن تحتوي حرفاً صغيراً" },
  { test: /[0-9]/, message: "يجب أن تحتوي رقماً" },
  { test: /[^A-Za-z0-9]/, message: "يجب أن تحتوي رمزاً خاصاً" },
] as const;

const passwordField = PASSWORD_RULES.reduce(
  (schema, rule) => schema.regex(rule.test, rule.message),
  z
    .string()
    .min(10, "كلمة المرور 10 محارف على الأقل")
    .max(128, "كلمة المرور طويلة جداً"),
);

export const administratorSchema = z
  .object({
    firstName: z.string().trim().min(2, "الاسم مطلوب").max(50),
    lastName: z.string().trim().min(2, "اللقب مطلوب").max(50),
    /*
     * اسمُ الدخول محدودُ المحارف: يُكتب في شاشةٍ بلا لوحةِ مفاتيحَ
     * عربيةٍ أحياناً، ومسافةٌ في طرفه تُنتج حساباً لا يُدخل إليه أبداً
     * ولا يظهر سببُه.
     */
    username: z
      .string()
      .trim()
      .min(3, "اسم الدخول 3 محارف على الأقل")
      .max(32)
      .regex(/^[a-zA-Z0-9._-]+$/, "اسم الدخول: حروف لاتينية وأرقام و . _ - فقط"),
    email: z.email({ error: "بريدٌ غير صالح" }).max(120).optional().or(z.literal("")),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((body) => body.password === body.confirmPassword, {
    error: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

// --------------------------------------------------
// 11 — هوية المؤسسة
//
// الحقولُ الأساسيةُ وحدها (§18): لا مواد ولا أساتذة ولا أسعار.
// وتُكتب في مفاتيح `school.*` نفسِها التي تقرؤها الترويسةُ والإيصالات
// — لا في مفاتيحَ موازية تُنسخ لاحقاً.
// --------------------------------------------------

export const institutionSchema = z.object({
  name: z.string().trim().min(2, "اسم المؤسسة مطلوب").max(120),
  shortName: z.string().trim().max(32).optional().or(z.literal("")),
  nameEn: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  email: z.email({ error: "بريدٌ غير صالح" }).max(120).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  /** مسارُ شعارٍ سبق رفعُه عبر `/api/uploads` — لا الملفُّ نفسُه */
  logoPath: z.string().trim().max(255).optional().or(z.literal("")),
});

// --------------------------------------------------
// 12 — السنة الدراسية
// --------------------------------------------------

export const academicYearSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(4, "اسم السنة 4 محارف على الأقل")
      .max(50),
    startDate: z.coerce.date({ error: "تاريخ البداية مطلوب" }),
    endDate: z.coerce.date({ error: "تاريخ النهاية مطلوب" }),
    sessionsPerMonth: z.coerce.number().int().min(1).max(31).default(8),
  })
  .refine((body) => body.endDate > body.startDate, {
    error: "تاريخ النهاية يجب أن يكون بعد البداية",
    path: ["endDate"],
  });

// --------------------------------------------------
// 13 — الخصوصية
//
// خيارٌ واحد لأنّ الحقيقيَّ واحد (§19/§29). لا تحليلاتٍ ولا تقاريرَ
// أعطالٍ تُرسل: NexSchool لا يفتح اتصالاً خارج شبكة المؤسسة، فعرضُ
// مفتاحٍ لإطفاء ما لا يعمل كذبٌ مهذَّب.
// --------------------------------------------------

export const privacySchema = z.object({
  /** تسجيلُ الأعطال **محلياً** — يُقرأ من الجهاز نفسه عند العطب */
  diagnostics: z.boolean(),
});

// --------------------------------------------------
// 14 — هاتف الاسترجاع
//
// **اختياريٌّ بقرارٍ صريح** لا بإهمال (§20): لا يوجد في هذا التركيب
// إرسالُ رسائلَ ولا استرجاعُ كلمةِ مرورٍ آليّ — فاشتراطُه كان سيمنع
// المضيَّ لأجل رقمٍ لا يستعمله شيء. وهو يُحفظ لأنّه **جهةُ اتصال
// المؤسسة** حين يحتاج أحدٌ صاحبَ التركيب.
// --------------------------------------------------

export const RECOVERY_REQUIRED = false;

export const recoverySchema = z.object({
  phone: z
    .string()
    .trim()
    .max(24)
    .refine(
      (value) => value === "" || /^\+?[0-9\s-]{6,24}$/.test(value),
      "رقمُ هاتفٍ غير صالح",
    ),
});

// --------------------------------------------------
// الرجوع
// --------------------------------------------------

export const backSchema = z.object({
  from: z.enum(FIRST_BOOT_STEPS),
});

// --------------------------------------------------
// إعادةُ التهيئة — محميّةٌ بالمصادقة والصلاحية (§59)
// --------------------------------------------------

export const resetFirstBootSchema = z.object({
  /** كلمةٌ تُكتب بيد المستخدم — الحرسُ الثالث بعد المصادقة والصلاحية */
  confirm: z.literal("RESET"),
});

export type LanguageInput = z.infer<typeof languageSchema>;
export type RegionInput = z.infer<typeof regionSchema>;
export type NetworkInput = z.infer<typeof networkSchema>;
export type DisplayInput = z.infer<typeof displaySchema>;
export type PerformanceInput = z.infer<typeof performanceSchema>;
export type TermsInput = z.infer<typeof termsSchema>;
export type UpdateInput = z.infer<typeof updateSchema>;
export type DevicesInput = z.infer<typeof devicesSchema>;
export type AdministratorInput = z.infer<typeof administratorSchema>;
export type InstitutionInput = z.infer<typeof institutionSchema>;
export type AcademicYearInput = z.infer<typeof academicYearSchema>;
export type PrivacyInput = z.infer<typeof privacySchema>;
export type RecoveryInput = z.infer<typeof recoverySchema>;
export type BackInput = z.infer<typeof backSchema>;
