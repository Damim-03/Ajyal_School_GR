import { describe, expect, it } from "vitest";

import { buildTemplate } from "./template";
import { readWorkbook } from "./read-workbook";
import { buildPlan } from "./plan";
import { COLUMNS, type SheetKind } from "./columns";
import type { LevelRef } from "./resolve-level";

/**
 * **الفحصُ الذي يمنع انفصالَ النموذج عن قارئه.**
 *
 * ملفّان يعرفان الأعمدة: مولِّدُ النموذج وقارئُه. وهما يفترقان بلا
 * صوت — يُعاد تسميةُ عمودٍ في أحدهما فيصير النموذجُ الذي نُعطيه
 * للمستخدم ملفّاً يرفضه برنامجُنا نفسُه.
 *
 * فيُبنى النموذجُ هنا ويُقرأ بالمسار الحقيقيّ كاملاً — لا محاكاةَ
 * فيه ولا بيانات مصطنعة.
 */

/** `File` غيرُ متوفّر في بيئة node — والقارئ لا يطلب منه إلّا هذا */
const asFile = (blob: Blob): File =>
  ({ arrayBuffer: () => blob.arrayBuffer() }) as File;

const LEVELS: LevelRef[] = [
  { id: "l1", name: "الأولى", isActive: true, educationStage: { id: "s1", name: "متوسط" } },
];

const readTemplate = async (kind: SheetKind) =>
  readWorkbook(asFile(await buildTemplate(kind)), kind);

const KINDS: SheetKind[] = ["students", "teachers"];

describe("النموذج ↔ القارئ", () => {
  it.each(KINDS)("يُقرأ نموذج %s وتُعرف أعمدتُه كلُّها", async (kind) => {
    const result = await readTemplate(kind);

    expect(result.fatal).toBeUndefined();
    expect(result.sheet!.kind).toBe(kind);
    /* لا عمودَ مجهول ولا إلزاميٌّ ناقص */
    expect(result.sheet!.unknownHeaders).toEqual([]);
    expect(result.sheet!.missingColumns).toEqual([]);
  });

  it.each(KINDS)("سطرُ المثال في %s يمرّ بالتحقّق كلِّه", async (kind) => {
    const sheet = (await readTemplate(kind)).sheet!;

    expect(sheet.rows).toHaveLength(1);

    const plan = buildPlan(sheet, LEVELS, []);

    expect(plan.rows[0].problems).toEqual([]);
    expect(plan.counts.ready).toBe(1);
  });

  it.each(KINDS)("النموذج %s يحمل كلّ عمودٍ في التعريف", async (kind) => {
    const sheet = (await readTemplate(kind)).sheet!;
    const seen = new Set(Object.keys(sheet.rows[0].values));

    for (const column of COLUMNS[kind]) expect(seen.has(column.key)).toBe(true);
  });

  it("الهاتف في المثال يحفظ صفره البادئ ولا يُنبَّه عليه", async () => {
    const sheet = (await readTemplate("students")).sheet!;

    expect(sheet.rows[0].values.parentPhone).toBe("0550123456");
    expect(sheet.rows[0].warnings).toEqual([]);
  });

  it("التاريخ في المثال يُقرأ كما كُتب", async () => {
    expect((await readTemplate("students")).sheet!.rows[0].values.birthDate).toBe(
      "2010-04-03",
    );
    expect((await readTemplate("teachers")).sheet!.rows[0].values.hireDate).toBe(
      "2024-09-01",
    );
  });

  it("المستوى في المثال يُحلّ إلى معرّفه", async () => {
    const sheet = (await readTemplate("students")).sheet!;

    expect(buildPlan(sheet, LEVELS, []).rows[0].payload!.levelId).toBe("l1");
  });
});

/**
 * **الفصلُ بين النوعين — وهو شرطُ ألّا تكتب شاشةُ الطلبة أساتذةً.**
 *
 * ولا يكفي أن تتجاهل الشاشةُ الورقةَ الأخرى: من فتح ملفَّ الأساتذة في
 * شاشة الطلبة يستحقّ أن يُقال له أين يفتحه، لا أن يرى «لم تُوجد ورقة».
 */
describe("فصلُ الملفّين", () => {
  it("نموذجُ الطلبة لا يحمل ورقة الأساتذة", async () => {
    const students = await readTemplate("students");

    expect(students.sheet!.kind).toBe("students");
  });

  it("يردّ ملفَّ النوع الآخر ويسمّي شاشتَه", async () => {
    const teachersFile = asFile(await buildTemplate("teachers"));

    const wrong = await readWorkbook(teachersFile, "students");

    expect(wrong.sheet).toBeUndefined();
    expect(wrong.fatal).toContain("الأساتذة");
  });

  it("والعكس كذلك", async () => {
    const studentsFile = asFile(await buildTemplate("students"));

    const wrong = await readWorkbook(studentsFile, "teachers");

    expect(wrong.sheet).toBeUndefined();
    expect(wrong.fatal).toContain("الطلبة");
  });
});
