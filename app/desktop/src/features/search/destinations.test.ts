import { describe, expect, it } from "vitest";

import { DESTINATIONS } from "./destinations";
import { fold, searchDestinations } from "./match";
import { PATHS } from "../../routes/paths";

/**
 * **حراسةُ التغطية — وهي كلُّ قيمة هذا الاختبار.**
 *
 * محرّكُ البحث الداخليّ يفشل بصمت: تُضاف شاشةٌ ولا يجدها أحد، و«لا
 * نتيجة» تبدو جواباً مشروعاً فلا يشتكي مستخدمٌ ولا اختبار. ولا يُكتشف
 * الأمرُ إلّا حين يقول أحدهم «البحث لا يجد شاشة كذا» بعد شهور.
 *
 * فيُقارَن الدليلُ بـ`PATHS` — وهي مصدرُ الحقيقة للعناوين. وكلُّ مسارٍ
 * قابلٍ للفتح يجب أن يكون له مدخلٌ في الدليل، وإلّا سقط الاختبار عند
 * أوّل شاشةٍ تُضاف ولا تُسجَّل.
 */

/**
 * ما لا يُبحث عنه — ولكلٍّ سببُه.
 *
 * القائمةُ صريحةٌ لا نمطٌ عامّ: الاستثناءُ بالنمط يبتلع صامتاً ما لم
 * يُقصد استثناؤه.
 */
const NOT_SEARCHABLE = new Set<string>([
  PATHS.login, // لا يُفتح من داخل التطبيق
  PATHS.home, // أنت فيها
  PATHS.receipts, // تحويلٌ إلى المدفوعات، لا شاشة
  PATHS.schedules, // تحويلٌ إلى الجدول الأسبوعي
  PATHS.users, // محورٌ قديم — تحت الإعدادات الآن
  PATHS.roles, // مغطّىً بـ`settingsRoles`
]);

/** عناوينُ `PATHS` الثابتة — بلا الدوالّ التي تحتاج معرّفاً. */
const staticPaths = Object.entries(PATHS)
  .filter(([key, value]) => typeof value === "string" && !key.endsWith("Pattern"))
  .map(([, value]) => value as string);

describe("دليلُ وجهات البحث", () => {
  it("يغطّي كلَّ مسارٍ قابلٍ للفتح في `PATHS`", () => {
    const covered = new Set(DESTINATIONS.map((d) => d.to));

    const missing = staticPaths.filter(
      (p) => !NOT_SEARCHABLE.has(p) && !covered.has(p),
    );

    expect(missing).toEqual([]);
  });

  it("لا وجهةَ بلا مسار، ولا مفتاحَ مكرَّر", () => {
    for (const d of DESTINATIONS) {
      expect(d.to).toBeTruthy();
      expect(d.title.trim()).toBeTruthy();
    }

    const ids = DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("يُبنى من السجلّات فيتجاوز الشاشات المكتوبة يدوياً بكثير", () => {
    /* حارسٌ ضدّ انهيارٍ صامت في البناء (سجلٌّ لم يُستورَد مثلاً). */
    expect(DESTINATIONS.length).toBeGreaterThan(50);
  });
});

describe("مطابقةُ العربية", () => {
  it("تتجاوز الهمزات والتاء المربوطة والألف المقصورة", () => {
    expect(fold("الأساتذة")).toBe(fold("الاساتذه"));
    expect(fold("إسناد")).toBe(fold("اسناد"));
    expect(fold("على")).toBe(fold("علي"));
  });

  it("تتجاوز التشكيل — والمستخدم لا يكتب الضمّة", () => {
    expect(fold("حقوقُ الشهر")).toBe(fold("حقوق الشهر"));
    expect(fold("مستحقُّ الأستاذ")).toBe(fold("مستحق الاستاذ"));
  });

  it("تجد الشاشةَ بكلمةٍ من التشكيل الخام", () => {
    /* «حقوق الشهر» مشكولةٌ في `STANDALONE`؛ يجب أن تُصاب بلا تشكيل. */
    const hits = searchDestinations("حقوق الشهر");
    expect(hits.some((h) => h.to.includes("monthly-fees"))).toBe(true);
  });

  it("تجد الكشوفَ بكلمةٍ لا تظهر في اسمها", () => {
    /* من يبحث عن «غياب» يقصد كشف الحضور — والكلمةُ ليست في العنوان. */
    const hits = searchDestinations("غياب");
    expect(hits.some((h) => h.to === PATHS.attendanceDaily)).toBe(true);
  });

  it("**كلُّ كلمةٍ يجب أن تُصيب** — لا اتّحادَ فضفاض", () => {
    /* «زرافة» لا تطابق شيئاً، فتُسقط النتيجة كلَّها ولو أصابت «كشف». */
    expect(searchDestinations("كشف زرافة")).toEqual([]);
  });

  it("تُقدّم الأعمَّ عند التعادل", () => {
    const hits = searchDestinations("الطلبة");
    expect(hits[0]?.to).toBe(PATHS.students);
  });

  it("لا تُرجع شيئاً لاستعلامٍ فارغ", () => {
    expect(searchDestinations("   ")).toEqual([]);
  });
});
