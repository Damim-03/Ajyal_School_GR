import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_METRIC_DEFINITIONS,
  METRICS_BY_KEY,
} from "../../core/reporting/definitions";
import { REPORT_CAPABILITIES } from "./reports.filters";
import { REPORT_REGISTRY } from "./reports.registry";
import { REPORT_SENSITIVITY } from "./reports.permissions";

// ======================================================
// حراسةُ الاتّساق — §65 §66
//
// هذه الاختباراتُ لا تقيس حساباً؛ تقرأ الشيفرةَ نصّاً وتتحقّق أنّ
// ما يُستعمل مُعرَّفٌ وما يُعرَّف مُستعمَل.
//
// وسببُها واقعةٌ لا افتراض: بُني ستّةَ عشرَ تقريراً، وبلغ المستعمَلُ
// خمسةً وسبعين مؤشّراً، والكتالوجُ فيه خمسةَ عشر. ولم يسقط اختبارٌ
// ولا فشل بناء — لأنّ `metric()` تسقط إلى المفتاح عند غياب
// التعريف. وإنّما ظهر النقصُ في أوّل ملفِّ تصديرٍ حقيقي: صفوفٌ
// مكتوبةٌ `totalStudents` في ورقةٍ عربية تُرسَل إلى الإدارة.
//
// فالفحصُ الآليُّ هنا يجعل النسيانَ يسقط البناء بدل أن يظهر في
// ورقةٍ عند مستخدم.
// ======================================================

const MODULE_DIR = join(__dirname);

const sourceFiles = () =>
  readdirSync(MODULE_DIR)
    .filter((file) => file.endsWith(".ts") && !file.includes(".test."))
    .map((file) => readFileSync(join(MODULE_DIR, file), "utf8"));

/** مفاتيحُ المؤشّرات المستعملة في `metric(...)` و `compared(...)` */
const usedMetricKeys = (): Set<string> => {
  const keys = new Set<string>();

  for (const source of sourceFiles()) {
    for (const match of source.matchAll(
      /\b(?:metric|compared)\(\s*["'](\w[\w-]*)["']/g,
    )) {
      keys.add(match[1]);
    }
  }

  return keys;
};

describe("كتالوج المؤشّرات — §66", () => {
  it("كلُّ مؤشّرٍ مستعمَل له تعريف", () => {
    const missing = [...usedMetricKeys()].filter(
      (key) => !METRICS_BY_KEY.has(key),
    );

    expect(missing).toEqual([]);
  });

  it("لا تعريفَ مكرّرٌ بمفتاحين", () => {
    const keys = ALL_METRIC_DEFINITIONS.map((metric) => metric.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("كلُّ تعريفٍ يحمل صيغةً ووصفاً غيرَ فارغين", () => {
    for (const metric of ALL_METRIC_DEFINITIONS) {
      expect(metric.formula.trim(), metric.key).not.toBe("");
      expect(metric.description.trim(), metric.key).not.toBe("");
      expect(metric.label.trim(), metric.key).not.toBe("");
    }
  });

  /*
   * العنوانُ عربيٌّ لأنّه يُعرض للإدارة ويُكتب في ملفّات التصدير.
   * ومفتاحٌ إنجليزيّ تسرّب إلى حقل العنوان لا يُلاحَظ في المراجعة
   * لأنّه يبدو نصّاً سليماً.
   */
  it("عناوينُ المؤشّرات عربية", () => {
    const arabic = /[؀-ۿ]/;

    for (const metric of ALL_METRIC_DEFINITIONS) {
      expect(arabic.test(metric.label), `${metric.key}: ${metric.label}`).toBe(
        true,
      );
    }
  });

  it("وجهةُ التنقيب مسارٌ مطلق", () => {
    for (const metric of ALL_METRIC_DEFINITIONS) {
      if (metric.drillTo) {
        expect(metric.drillTo.startsWith("/"), metric.key).toBe(true);
      }
    }
  });
});

describe("سجلُّ التقارير — §63", () => {
  it("لا مفتاحَ مكرّر", () => {
    const keys = REPORT_REGISTRY.map((report) => report.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  /*
   * كلُّ تقريرٍ في السجلّ لا بدّ له من قدراتٍ معلَنة، وإلّا رمت
   * `applyCapability` عند أوّل طلب — وهو خطأٌ يظهر في وقت التشغيل
   * لا في البناء.
   */
  it("كلُّ تقريرٍ مسجَّلٍ له قدراتٌ معلَنة", () => {
    const missing = REPORT_REGISTRY.filter(
      (report) => !REPORT_CAPABILITIES[report.key],
    ).map((report) => report.key);

    expect(missing).toEqual([]);
  });

  /*
   * وحساسيةٌ مصرَّح بها: الافتراضُ `audit` يعمل، لكنّه يجعل
   * تقريراً تشغيلياً محجوباً عن الجميع بلا سبب ظاهر.
   */
  it("كلُّ تقريرٍ مسجَّلٍ له حساسيةٌ مصرَّح بها", () => {
    const missing = REPORT_REGISTRY.filter(
      (report) => !REPORT_SENSITIVITY[report.key],
    ).map((report) => report.key);

    expect(missing).toEqual([]);
  });

  it("العناوين والأوصاف عربية وغير فارغة", () => {
    const arabic = /[؀-ۿ]/;

    for (const report of REPORT_REGISTRY) {
      expect(arabic.test(report.title), report.key).toBe(true);
      expect(report.description.trim().length, report.key).toBeGreaterThan(10);
    }
  });
});

describe("القدرات والصلاحيات", () => {
  /*
   * القدراتُ قد تحوي مفاتيحَ لا سجلَّ لها — `financial-flow` مثلاً
   * أُعلنت قدراتُه قبل أن تُبنى شاشتُه. وذلك مقبول: القدرةُ تصريحٌ
   * لا وعدٌ بمسار.
   *
   * لكنّ العكسَ خطأ، وقد اختُبر أعلاه.
   */
  it("كلُّ حساسيةٍ مصرَّح بها لها قدراتٌ أو سجلّ", () => {
    const orphans = Object.keys(REPORT_SENSITIVITY).filter(
      (key) =>
        !REPORT_CAPABILITIES[key] &&
        !REPORT_REGISTRY.some((report) => report.key === key),
    );

    expect(orphans).toEqual([]);
  });
});
