import { describe, expect, it } from "vitest";

import { findDuplicates, identityOf } from "./duplicates";
import type { ParsedRow } from "./read-workbook";

/**
 * **يُختبر لأنّ خطأه في اتّجاهين، وكلاهما يؤذي.**
 *
 * تساهلٌ فيه ⇒ طالبٌ في القاعدة مرّتين برقمين، وفاتورتان، وكشفان.
 * وتشدّدٌ فيه ⇒ أخوان يُمنع أحدُهما وهما اثنان.
 */

const row = (rowNumber: number, values: Record<string, unknown>): ParsedRow => ({
  rowNumber,
  values: values as ParsedRow["values"],
  errors: [],
  warnings: [],
});

describe("identityOf", () => {
  it("توحّد كتابةَ الاسم وصيغةَ الهاتف", () => {
    const a = identityOf(
      { lastName: "بن عمر", firstName: "إسماعيل", parentPhone: "0550-12-34-56" },
      "students",
    );
    const b = identityOf(
      { lastName: "بن عمر", firstName: "اسماعيل", parentPhone: "0550 123456" },
      "students",
    );

    expect(a.key).toBe(b.key);
    expect(a.key).not.toBe("");
  });

  /* بلا هاتفٍ لا مطابقة — والاسمُ وحده يجمع المتشابهين ظلماً */
  it("لا تعطي مفتاحاً للطالب بلا هاتف", () => {
    expect(identityOf({ lastName: "بن عمر", firstName: "علي" }, "students").key).toBe("");
  });

  it("الأستاذ يُطابَق ببريده حين يوجد", () => {
    const withEmail = identityOf(
      { lastName: "س", firstName: "ع", email: "a@b.com" },
      "teachers",
    );

    expect(withEmail.key).toBe("email:a@b.com");
  });
});

describe("findDuplicates", () => {
  it("تُبقي الأوّل وتعلّم ما بعده", () => {
    const rows = [
      row(2, { lastName: "بن عمر", firstName: "علي", parentPhone: "0550123456" }),
      row(3, { lastName: "بن عمر", firstName: "علي", parentPhone: "0550123456" }),
    ];

    const found = findDuplicates(rows, "students");

    expect(found.has(2)).toBe(false);
    expect(found.get(3)?.source).toBe("file");
    expect(found.get(3)?.against).toBe("السطر 2");
  });

  it("تكشف ما هو في القاعدة سلفاً", () => {
    const rows = [
      row(2, { lastName: "بن عمر", firstName: "علي", parentPhone: "0550123456" }),
    ];

    const existing = [
      identityOf(
        { lastName: "بن عمر", firstName: "علي", parentPhone: "0550123456" },
        "students",
      ),
    ];

    expect(findDuplicates(rows, "students", existing).get(2)?.source).toBe("existing");
  });

  /* أخوان: الاسمُ يفترق فلا يُعدّان واحداً ولو اتّحد الهاتف */
  it("لا تخلط أخوين بهاتفٍ واحد", () => {
    const rows = [
      row(2, { lastName: "بن عمر", firstName: "علي", parentPhone: "0550123456" }),
      row(3, { lastName: "بن عمر", firstName: "سارة", parentPhone: "0550123456" }),
    ];

    expect(findDuplicates(rows, "students").size).toBe(0);
  });

  it("لا تعلّم صفّاً بلا مفتاح", () => {
    const rows = [
      row(2, { lastName: "بن عمر", firstName: "علي" }),
      row(3, { lastName: "بن عمر", firstName: "علي" }),
    ];

    expect(findDuplicates(rows, "students").size).toBe(0);
  });
});
