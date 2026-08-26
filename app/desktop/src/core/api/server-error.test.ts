import { describe, expect, it } from "vitest";

import { technicalCause } from "./server-error";

/**
 * **يُختبر لأنّه ما يبقى للمطوّر بعد أن أُخفي عن المستخدم.**
 *
 * السببُ التقنيّ لم يعد يُعرض على الشاشة — يُكتب في السجلّ. فإن
 * ضاع هنا لم ينتبه أحدٌ إلى ضياعه إلّا يوم يحتاجه.
 */

describe("technicalCause", () => {
  it("يستخرج السبب المُرفق", () => {
    expect(
      technicalCause({
        message: "Internal Server Error",
        error: "Unknown column 'birthPlace' in 'field list'",
      }),
    ).toBe("Unknown column 'birthPlace' in 'field list'");
  });

  it("يطوي الأسطر إلى سطرٍ واحد", () => {
    const cause = technicalCause({
      error: "Invalid `prisma.student.create()` invocation:\n\n\nRaw query failed.",
    });

    expect(cause).toBe(
      "Invalid `prisma.student.create()` invocation: Raw query failed.",
    );
    expect(cause).not.toContain("\n");
  });

  /*
   * الطرفان معاً: رسالةُ Prisma تحمل العمليةَ في أوّلها والسببَ في
   * آخرها، وقصٌّ من جهةٍ واحدة يفقد أحدهما.
   */
  it("يحفظ رأس الرسالة الطويلة وذيلها", () => {
    const raw = `Invalid \`prisma.student.create()\` invocation:${"x".repeat(900)}Unknown argument 'birthPlace'`;

    const cause = technicalCause({ error: raw })!;

    expect(cause).toContain("prisma.student.create()");
    expect(cause).toContain("Unknown argument 'birthPlace'");
    expect(cause).toContain("…");
    expect(cause.length).toBeLessThan(raw.length);
  });

  it("لا يُرجع شيئاً حين لا سببَ مُرفقاً", () => {
    expect(technicalCause({ message: "Internal Server Error" })).toBeUndefined();
    expect(technicalCause(undefined)).toBeUndefined();
    expect(technicalCause({ error: "   " })).toBeUndefined();
  });
});
