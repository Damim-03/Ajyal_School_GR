import { describe, expect, it } from "vitest";

import {
  TEACHER_DOCUMENT_KEYS,
  TEACHER_DOCUMENT_TYPES,
  isCustomType,
  isKnownTeacherType,
} from "./document.types";

/**
 * عقدُ مفاتيح وثائق الأستاذ.
 *
 * المفتاحُ المضاف يُولَّد في الواجهة ويُتحقَّق منه في الخادم، والطرفان
 * لا يتشاركان شيفرة — فالنمط هو العقدُ بينهما وحدَه. وكسرُه لا يظهر
 * خطأً في التصريف بل رفضاً 400 عند أوّل وثيقةٍ تسمّيها الإدارة.
 */
describe("مفاتيح وثائق الأستاذ", () => {
  it("يقبل ما ولّدته الواجهة", () => {
    /* المولِّد في teachers.api.ts: ستُّ خاناتٍ عشوائية + أربعٌ من الوقت */
    const generate = () =>
      `custom_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

    for (let i = 0; i < 200; i++) {
      const key = generate();
      expect(isCustomType(key), key).toBe(true);
      expect(isKnownTeacherType(key), key).toBe(true);
    }
  });

  it("يردّ ما ليس مفتاحاً", () => {
    for (const key of [
      "custom_",
      "custom_ab",
      "custom_شهادة",
      "custom_AB12cd",
      "custom_a b c d",
      "../../etc/passwd",
      "photo_",
      "",
    ]) {
      expect(isCustomType(key), key).toBe(false);
      expect(isKnownTeacherType(key), key).toBe(false);
    }
  });

  it("يقبل الخانات الافتراضية ولا يعدّها مضافة", () => {
    for (const key of TEACHER_DOCUMENT_KEYS) {
      expect(isKnownTeacherType(key), key).toBe(true);
      expect(isCustomType(key), key).toBe(false);
    }
  });

  it("لا مفتاحَ مكرّراً", () => {
    expect(new Set(TEACHER_DOCUMENT_KEYS).size).toBe(TEACHER_DOCUMENT_TYPES.length);
  });
});
