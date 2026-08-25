import { describe, expect, it } from "vitest";

import { railTravel } from "./rail-geometry";
import { geometry } from "./tokens";

/**
 * **القاعدةُ التي يقوم عليها الشريط كلُّه، مُثبَتةً بالحساب لا بالنظر.**
 *
 * «الإطارُ ثابت، والبلاطةُ المطلوبة تأتي إليه» ليست مسألةَ ذوق: هي معادلةٌ
 * إمّا أن تصحّ وإمّا أن تنكسر. وانكسارُها لا يُرى خطأً بيّناً — يُرى
 * «انزياحاً بسيطاً» يظنّه الناظرُ حركةً مقصودة، ثمّ يتراكم مع كلّ تعديلٍ
 * على المقاسات حتّى يصير المربّعُ الأبيضُ يتجوّل من جديد.
 *
 * ولذلك تُختبر الهندسةُ نفسُها لا المكوّن: `railTravel` دالّةٌ نقيّة
 * يستعملها العارضُ حرفياً، فما يصحّ هنا يصحّ على الشاشة.
 */

/** مقاساتٌ واقعية عند 1920px: البلاطة 106، فالمركَّزة 150.5 والفجوة 19. */
const M = {
  compact: 106,
  focused: 106 * geometry.selectedRatio,
  gap: 106 * geometry.gapRatio,
};

/**
 * مركزُ البلاطة رقم i عند الاستقرار، من أوّل الصفّ — **الحقيقةُ المرجعية**.
 *
 * تُبنى بالجمع لا بالضرب عمداً: لو اشتُقّت بالصيغة نفسِها التي يستعملها
 * `railTravel` لصار الاختبارُ يقارن الدالّةَ بنفسها.
 */
const restCenter = (i: number) => {
  let left = 0;
  /* عند الاستقرار المركَّزةُ وحدها متمدّدة، وكلُّ ما قبلها هادئ. */
  for (let j = 0; j < i; j++) left += M.compact + M.gap;
  return left + M.focused / 2;
};

describe("هندسةُ الصفّ — الإطارُ ثابتٌ والصفُّ يمرّ", () => {
  const anchor = 1920 * geometry.focusAnchor;

  it("تضع كلَّ بلاطةٍ تحت المرساة بالضبط — بلا استثناءٍ عند الطرفين", () => {
    for (let i = 0; i < 9; i++) {
      const travel = railTravel(i, M, anchor);
      /* موضعُ مركز البلاطة على الشاشة بعد الإزاحة. */
      const onScreen = restCenter(i) - travel;
      expect(onScreen).toBeCloseTo(anchor, 6);
    }
  });

  it("لا تُكبَح عند البلاطة الأولى — الإزاحةُ سالبةٌ ولا تُصفَّر", () => {
    /*
     * هذا هو العطلُ الأصلي حرفياً: `Math.max(travel, 0)` كان يجعل الصفَّ
     * لا يتحرّك على أوّل بلاطتين، فيتحرّك الإطارُ إليهما بدلاً منه.
     */
    expect(railTravel(0, M, anchor)).toBeLessThan(0);
    expect(railTravel(1, M, anchor)).toBeLessThan(0);
  });

  it("لا تُكبَح عند آخر بلاطة — تصل إلى المرساة كسائرها", () => {
    const last = 8;
    expect(restCenter(last) - railTravel(last, M, anchor)).toBeCloseTo(anchor, 6);
  });

  it("**الاستيفاء الخطّي في منتصف الرحلة يطابق الهندسة الحقيقية**", () => {
    /*
     * أهمُّ اختبارٍ هنا. أثناء السفر تتقاسم البلاطتان المتجاورتان التمدّدَ
     * (‏0.5 لكلٍّ منهما)، فمواضعُ الصفّ الحقيقية تتغيّر. والصفُّ يُقاد
     * بموضعٍ كسريّ يُستوفى خطّياً — فلو اختلف الاثنان لتخلّفت البلاطةُ عن
     * الإطار في منتصف كلّ انتقال، وهو ما يُقرأ «إطاراً يطارد أيقونة».
     *
     * الحقيقةُ عند p = i + 0.5: عرضُ البلاطتين i و i+1 يساوي
     * compact + Δ/2 لكلٍّ منهما، ومركزُ نقطة التركيز هو منتصفُ مركزيهما.
     */
    const i = 3;
    const delta = M.focused - M.compact;
    const half = M.compact + delta / 2;

    const leftOf_i = i * (M.compact + M.gap);
    const centre_i = leftOf_i + half / 2;
    const centre_next = leftOf_i + half + M.gap + half / 2;
    const truth = (centre_i + centre_next) / 2;

    expect(railTravel(i + 0.5, M, anchor)).toBeCloseTo(truth - anchor, 6);
  });

  it("الخطوةُ بين بلاطتين متتاليتين ثابتة — لا تسارعَ في مؤخّرة الصفّ", () => {
    const steps = Array.from({ length: 8 }, (_, i) =>
      railTravel(i + 1, M, anchor) - railTravel(i, M, anchor),
    );

    for (const s of steps) expect(s).toBeCloseTo(M.compact + M.gap, 6);
  });

  it("المرساةُ تتبع العرض — لا رقمَ بكسليٍّ مثبَّت (§32/§54)", () => {
    const wide = 3840 * geometry.focusAnchor;
    const narrow = 1366 * geometry.focusAnchor;

    expect(wide).toBeGreaterThan(narrow);
    /* وعلى كلّ عرضٍ تبقى المعادلة صحيحة. */
    for (const a of [narrow, wide]) {
      expect(restCenter(5) - railTravel(5, M, a)).toBeCloseTo(a, 6);
    }
  });
});
