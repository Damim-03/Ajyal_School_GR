import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assetUrl } from "./asset-url";
import { saveApiUrl, clearApiUrl } from "../core/api/base-url";

/**
 * **يُختبر لأنّ عطبَه لا يظهر على جهاز البناء.**
 *
 * على جهاز المطوّر يتطابق العنوانُ المخبوز والعنوانُ المختار، فتعمل
 * الصور. ولا ينشقّ الاثنان إلّا على جهاز المؤسسة الذي وُجّه إلى خادمٍ
 * آخر من شاشة «الشبكة» — وهناك لا مطوّرَ ينظر.
 */

/*
 * بيئةُ الاختبار node بلا localStorage، و`base-url` يبتلع غيابَه
 * ويرتدّ إلى المخبوز — فيمرّ الاختبارُ على العطب نفسِه الذي يفحصه.
 * فيُركَّب مخزنٌ في الذاكرة بالعقد الذي تستعمله الوحدة.
 */
beforeEach(() => {
  const store = new Map<string, string>();

  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

afterEach(() => {
  clearApiUrl();
  vi.unstubAllGlobals();
});

describe("assetUrl", () => {
  it("يتبع العنوانَ المختار زمنَ التشغيل لا المخبوز", () => {
    saveApiUrl("192.168.1.20:3001");

    expect(assetUrl("/uploads/a.jpg")).toBe(
      "http://192.168.1.20:3001/uploads/a.jpg",
    );
  });

  /*
   * التبديلُ يسري على الطلب التالي مباشرةً — لا بعد إعادة التشغيل.
   * وهذا كان أصلَ العطب: الأصلُ كان يُحسب مرّةً عند تحميل الوحدة.
   */
  it("يلتقط تبديلَ الخادم بلا إعادة تحميل", () => {
    saveApiUrl("10.0.0.5:3001");
    expect(assetUrl("/uploads/a.jpg")).toContain("10.0.0.5:3001");

    saveApiUrl("10.0.0.9:3001");
    expect(assetUrl("/uploads/a.jpg")).toContain("10.0.0.9:3001");
  });

  it("يمرّر الرابط الكامل كما هو", () => {
    const full = "https://cdn.example.com/x.png";

    expect(assetUrl(full)).toBe(full);
  });

  it("لا يعرض ما ليس مساراً معروفاً", () => {
    expect(assetUrl(undefined)).toBeUndefined();
    expect(assetUrl(null)).toBeUndefined();
    expect(assetUrl("")).toBeUndefined();
    expect(assetUrl("uploads/a.jpg")).toBeUndefined();
    expect(assetUrl("../../etc/passwd")).toBeUndefined();
  });
});
