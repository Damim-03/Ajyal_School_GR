import { describe, expect, it } from "vitest";

import { resolveErrorMessage, revealServerCause } from "./server-error";

/**
 * **يُختبر لأنّه الحدُّ الفاصل بين تشخيصٍ وصمت.**
 *
 * خطؤه من نوعٍ لا يظهر إلّا يوم العطل: إن أفرط استبدل رسالةً عربيةً
 * مفهومة بنصٍّ تقنيّ، وإن فرّط عاد المستخدمُ يرى «Internal Server
 * Error» ويرى المطوّرُ سطراً في سجلّ خادمٍ بعيد.
 */

describe("resolveErrorMessage", () => {
  it("يكشف السبب خلف الغلاف العامّ", () => {
    expect(
      resolveErrorMessage({
        message: "Internal Server Error",
        error: "Unknown column 'birthPlace' in 'field list'",
      }),
    ).toBe("Unknown column 'birthPlace' in 'field list'");
  });

  it("لا يمسّ رسالة 4xx المكتوبة لتُقرأ", () => {
    expect(
      resolveErrorMessage({
        message: "حجم الملف يتجاوز 3 ميغابايت",
        error: "LIMIT_FILE_SIZE",
      }),
    ).toBeUndefined();
  });

  it("لا يُرجع شيئاً حين لا سببَ مُرفقاً", () => {
    expect(
      resolveErrorMessage({ message: "Internal Server Error" }),
    ).toBeUndefined();
    expect(resolveErrorMessage(undefined)).toBeUndefined();
    expect(
      resolveErrorMessage({ message: "Internal Server Error", error: "   " }),
    ).toBeUndefined();
  });

  it("يطوي الأسطر إلى سطرٍ واحد", () => {
    const resolved = resolveErrorMessage({
      message: "Internal Server Error",
      error: "Invalid `prisma.student.create()` invocation:\n\n\nRaw query failed.",
    });

    expect(resolved).toBe(
      "Invalid `prisma.student.create()` invocation: Raw query failed.",
    );
    expect(resolved).not.toContain("\n");
  });

  /*
   * الطرفان معاً: رسالةُ Prisma الطويلة تحمل العمليةَ في أوّلها
   * والسببَ في آخرها، وقصٌّ من جهةٍ واحدة يفقد أحدهما.
   */
  it("يحفظ رأس الرسالة الطويلة وذيلها", () => {
    const cause = `Invalid \`prisma.student.create()\` invocation:${"x".repeat(900)}Unknown argument 'birthPlace'`;

    const resolved = resolveErrorMessage({
      message: "Internal Server Error",
      error: cause,
    })!;

    expect(resolved).toContain("prisma.student.create()");
    expect(resolved).toContain("Unknown argument 'birthPlace'");
    expect(resolved).toContain("…");
    expect(resolved.length).toBeLessThan(cause.length);
  });
});

describe("revealServerCause", () => {
  it("يكتب السبب في مكان الغلاف داخل الجسم نفسه", () => {
    const body = {
      message: "Internal Server Error",
      errorCode: "INTERNAL_SERVER_ERROR",
      error: "connect ECONNREFUSED 127.0.0.1:3306",
    };

    revealServerCause(body);

    expect(body.message).toBe("connect ECONNREFUSED 127.0.0.1:3306");
    /* الحقول الأخرى لا تُمسّ */
    expect(body.errorCode).toBe("INTERNAL_SERVER_ERROR");
  });

  it("يتحمّل جسماً غائباً أو غيرَ كائن", () => {
    expect(() => revealServerCause(undefined)).not.toThrow();
    expect(() => revealServerCause("boom")).not.toThrow();
    expect(() => revealServerCause(null)).not.toThrow();
  });
});
