import { describe, expect, it } from "vitest";

import { buildPlan } from "./plan";
import { identityOf } from "./duplicates";
import type { LevelRef } from "./resolve-level";
import type { ParsedSheet } from "./read-workbook";

/**
 * **يُختبر لأنّه العقدُ بين ما يراه المستخدم وما يُكتب.**
 *
 * ما صنّفته الخطّة «جاهزاً» يُرسل بلا سؤال. فسطرٌ ناقصٌ صُنّف جاهزاً
 * يُردّ من الخادم بعد أن وعدنا المستخدمَ بنجاحه.
 */

const LEVELS: LevelRef[] = [
  { id: "l1", name: "الأولى", isActive: true, educationStage: { id: "s1", name: "متوسط" } },
  { id: "l3", name: "الأولى", isActive: true, educationStage: { id: "s2", name: "ثانوي" } },
];

const sheet = (
  rows: { rowNumber: number; values: Record<string, unknown>; errors?: string[] }[],
): ParsedSheet => ({
  kind: "students",
  unknownHeaders: [],
  missingColumns: [],
  rows: rows.map((r) => ({
    rowNumber: r.rowNumber,
    values: r.values as never,
    errors: (r.errors ?? []).map((message) => ({ column: "الاسم", message })),
    warnings: [],
  })),
});

const student = (over: Record<string, unknown> = {}) => ({
  lastName: "بن عمر",
  firstName: "علي",
  gender: "MALE",
  parentPhone: "0550123456",
  ...over,
});

describe("buildPlan", () => {
  it("تُجهّز الحمولة وتحذف الفارغ", () => {
    const plan = buildPlan(
      sheet([{ rowNumber: 2, values: student({ note: null, address: "" }) }]),
      LEVELS,
      [],
    );

    expect(plan.counts.ready).toBe(1);

    const payload = plan.rows[0].payload!;
    expect(payload).toEqual({
      lastName: "بن عمر",
      firstName: "علي",
      gender: "MALE",
      parentPhone: "0550123456",
    });
    /* الفارغُ محذوفٌ لا مُرسَلٌ null — `registrationDate` لا تقبله */
    expect("note" in payload).toBe(false);
    expect("address" in payload).toBe(false);
  });

  it("تحلّ المستوى إلى معرّفه ولا تُرسل الطور", () => {
    const plan = buildPlan(
      sheet([{ rowNumber: 2, values: student({ __stage: "متوسط", __level: "الأولى" }) }]),
      LEVELS,
      [],
    );

    expect(plan.rows[0].payload!.levelId).toBe("l1");
    expect("__stage" in plan.rows[0].payload!).toBe(false);
    expect("__level" in plan.rows[0].payload!).toBe(false);
  });

  it("تمنع السطر حين يلتبس المستوى", () => {
    const plan = buildPlan(
      sheet([{ rowNumber: 2, values: student({ __level: "الأولى" }) }]),
      LEVELS,
      [],
    );

    expect(plan.rows[0].status).toBe("blocked");
    expect(plan.rows[0].problems[0]).toContain("المستوى");
    expect(plan.rows[0].payload).toBeUndefined();
  });

  it("تنقل أخطاء الخانات وتمنع بها", () => {
    const plan = buildPlan(
      sheet([{ rowNumber: 2, values: student(), errors: ["مطلوب — الخانة فارغة"] }]),
      LEVELS,
      [],
    );

    expect(plan.counts.blocked).toBe(1);
    expect(plan.rows[0].problems[0]).toBe("الاسم: مطلوب — الخانة فارغة");
  });

  /* الخطأ يسبق التكرار: من لا يُعرف اسمُه لا يُقال إنّه مكرَّر */
  it("الخطأ يغلب التكرار في التصنيف", () => {
    const rows = sheet([
      { rowNumber: 2, values: student() },
      { rowNumber: 3, values: student(), errors: ["قيمةٌ غير مقبولة"] },
    ]);

    const plan = buildPlan(rows, LEVELS, []);

    expect(plan.rows[1].status).toBe("blocked");
  });

  it("تكشف القائم في القاعدة", () => {
    const existing = [identityOf(student(), "students")];

    const plan = buildPlan(sheet([{ rowNumber: 2, values: student() }]), LEVELS, existing);

    expect(plan.counts.duplicate).toBe(1);
    expect(plan.rows[0].status).toBe("duplicate");
    /* الحمولة محفوظة — المستخدم قد يقرّر إدخاله رغم الشبهة */
    expect(plan.rows[0].payload).toBeDefined();
  });

  it("تعدّ الأصناف الثلاثة", () => {
    const plan = buildPlan(
      sheet([
        { rowNumber: 2, values: student() },
        { rowNumber: 3, values: student() },
        { rowNumber: 4, values: student({ firstName: "سارة" }), errors: ["خطأ"] },
      ]),
      LEVELS,
      [],
    );

    expect(plan.counts).toMatchObject({ total: 3, ready: 1, duplicate: 1, blocked: 1 });
  });
});
