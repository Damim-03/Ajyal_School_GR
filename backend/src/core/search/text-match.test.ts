import { describe, expect, it } from "vitest";

import { escapeLike, containsOn, words } from "./text-match";

/**
 * **يُختبر لأنّ إغفالَ التهريب يجعل خانةَ البحث تُعيد كلَّ شيء.**
 *
 * Prisma كانت تهرّب `%` و`_` عنّا. ولمّا صارت المطابقةُ بـSQL خام
 * انتقلت المسؤولية إلينا — ومن كتب «100%» في خانة البحث يقصد النصَّ
 * لا «أيّ شيء»، وبلا تهريبٍ يُطابق النمطُ كلَّ صفٍّ في الجدول.
 */

describe("escapeLike", () => {
  it("يهرّب محارف LIKE الخاصّة", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("c\\d")).toBe("c\\\\d");
  });

  it("يترك النصّ العاديّ كما هو", () => {
    expect(escapeLike("بن عمر")).toBe("بن عمر");
    expect(escapeLike("")).toBe("");
  });

  /*
   * المطابقةُ المتساهلة تضع `_` عمداً موضعَ الحروف التي تُكتب على
   * أوجه. فتهريبُه هناك يُبطلها من أصلها.
   */
  it("يُبقي الشرطة السفلية حين تكون مقصودة", () => {
    expect(escapeLike("_سماعيل", true)).toBe("_سماعيل");
    expect(escapeLike("_سما%عيل", true)).toBe("_سما\\%عيل");
  });
});

describe("containsOn", () => {
  it("يبني نمطاً واحداً لكلّ عمود", () => {
    expect(containsOn(["firstName", "lastName"], "علي")).toEqual([
      { column: "firstName", pattern: "%علي%" },
      { column: "lastName", pattern: "%علي%" },
    ]);
  });

  it("يهرّب النصّ داخل النمط", () => {
    expect(containsOn(["code"], "50%")[0].pattern).toBe("%50\\%%");
  });

  it("يُرجع فارغاً بلا أعمدة", () => {
    expect(containsOn([], "x")).toEqual([]);
  });
});

/**
 * تقسيمُ الاستعلام كلماتٍ — وعليه يقوم البحثُ بالاسم الكامل.
 *
 * الاسمُ في حقلين، فـ«سعد الله تسنيم» لا يوجد في حقلٍ بمفرده. وكلمةٌ
 * فارغةٌ تتسلّل من مسافةٍ مكرّرة تصير شرطاً يُطابق كلَّ شيء.
 */
describe("words", () => {
  it("يقسّم على المسافات ويُسقط الفارغ", () => {
    expect(words("سعد الله تسنيم")).toEqual(["سعد", "الله", "تسنيم"]);
    expect(words("  برير   ماجد  ")).toEqual(["برير", "ماجد"]);
  });

  it("يُرجع فارغاً لنصٍّ فارغ", () => {
    expect(words("")).toEqual([]);
    expect(words("   ")).toEqual([]);
  });

  it("الكلمةُ الواحدة تبقى واحدة", () => {
    expect(words("برير")).toEqual(["برير"]);
  });
});
