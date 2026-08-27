import { describe, expect, it } from "vitest";

import { resolveLevel, type LevelRef } from "./resolve-level";

/**
 * **يُختبر لأنّ خطأه يضع الطالب في طورٍ لا ينتمي إليه — بصمت.**
 *
 * «الأولى» اسمٌ في المتوسط وفي الثانوي. واختيارُ الأوّل عند الالتباس
 * لا يرفع خطأً ولا يُبلَّغ عنه؛ يظهر في بطاقةٍ مطبوعةٍ في جيب طالب.
 */

const LEVELS: LevelRef[] = [
  { id: "l1", name: "الأولى", isActive: true, educationStage: { id: "s1", name: "متوسط" } },
  { id: "l2", name: "الثانية", isActive: true, educationStage: { id: "s1", name: "متوسط" } },
  { id: "l3", name: "الأولى", isActive: true, educationStage: { id: "s2", name: "ثانوي" } },
  { id: "l4", name: "الرابعة", isActive: false, educationStage: { id: "s1", name: "متوسط" } },
];

describe("resolveLevel", () => {
  it("تمرّ بلا مستوى — والحقل اختياريّ", () => {
    expect(resolveLevel("", "", LEVELS)).toEqual({ ok: true, levelId: null });
    expect(resolveLevel("متوسط", "", LEVELS)).toEqual({ ok: true, levelId: null });
  });

  it("تُطابق بالطور والمستوى معاً", () => {
    expect(resolveLevel("متوسط", "الأولى", LEVELS)).toEqual({ ok: true, levelId: "l1" });
    expect(resolveLevel("ثانوي", "الأولى", LEVELS)).toEqual({ ok: true, levelId: "l3" });
  });

  it("تتسامح مع الهمزة", () => {
    expect(resolveLevel("متوسط", "الاولى", LEVELS)).toEqual({ ok: true, levelId: "l1" });
  });

  it("تُطابق بالمستوى وحده حين لا يلتبس", () => {
    expect(resolveLevel("", "الثانية", LEVELS)).toEqual({ ok: true, levelId: "l2" });
  });

  /* هذا هو جوهر الوحدة: لا ترجيحَ عند الالتباس */
  it("ترفض المستوى الملتبس وتُسمّي الطورين", () => {
    const out = resolveLevel("", "الأولى", LEVELS);

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toContain("متوسط");
      expect(out.error).toContain("ثانوي");
    }
  });

  it("تُفرّق بين طورٍ مجهول ومستوًى مجهولٍ فيه", () => {
    const badStage = resolveLevel("جامعي", "الأولى", LEVELS);
    expect(badStage.ok).toBe(false);
    if (!badStage.ok) expect(badStage.error).toContain("لا طور");

    const badLevel = resolveLevel("متوسط", "الخامسة", LEVELS);
    expect(badLevel.ok).toBe(false);
    if (!badLevel.ok) expect(badLevel.error).toContain("في طور");
  });

  it("ترفض المعطَّل كما يرفضه الخادم", () => {
    const out = resolveLevel("متوسط", "الرابعة", LEVELS);

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("معطَّل");
  });

  it("لا تخترع مستوًى غير موجود", () => {
    expect(resolveLevel("", "السادسة", LEVELS).ok).toBe(false);
  });
});
