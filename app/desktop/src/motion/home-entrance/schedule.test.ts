import { describe, expect, it } from "vitest";

import { STEP, assemblyOf, icon, focusFrameStageOf } from "./tokens";
import { focusFrame } from "../spatial/tokens";

/**
 * **جدولُ الدخول — مقيَّدٌ بالمواصفة، لا متروكٌ للذوق.**
 *
 * أرقامُ هذا الجدول أسهلُ ما ينجرف في المشروع: تُضبط بلاطةٌ هنا فيُزاح
 * مَعلمٌ هناك، ولا شيء يشتكي — لأنّ النتيجة تبقى «حركةً تعمل».
 *
 * والمواصفة تعطي **نطاقات** لا نقاطاً («‏These are NOT strict
 * pixel-perfect timings … Tune them visually‏»)، فتُختبر نطاقاتُها: يبقى
 * الضبطُ بالعين حرّاً داخلها، ولا ينكسر شيءٌ لأنّ أحداً حرّك مَعلماً
 * عشرين مللي ثانية — وينكسر إن خرج عنها.
 *
 * والأهمُّ من الأرقام كلِّها شرطان لا نطاقَ لهما:
 *   • **الترتيب** — البيئةُ قبل الشريط قبل التركيز قبل المحتوى.
 *   • **ألّا يتأخّر التركيز** — وهو المطلبُ الوحيد الصريح في §8.
 */

const auth = assemblyOf("auth");
const at = (step: number) => auth.find((m) => m.step === step)!.at;

describe("جدولُ دخول الرئيسية", () => {
  it("يمرّ بالمراحل الثماني بالترتيب الذي تصفه المواصفة", () => {
    const order = [
      STEP.environment, // ① البيئة
      STEP.shell,
      STEP.navigation, // ② الشريط
      STEP.focusGlow, // ③ الوهج
      STEP.focusPlate, // ④ الزجاج
      STEP.edge, // ⑤ الحدّ الأبيض
      STEP.focus, // ⑥ تأكيد العنصر
      STEP.content, // ⑦ المحتوى
      STEP.complete, // ⑧ الاكتمال
    ];

    expect(auth.map((m) => m.step)).toEqual(order);

    /* والزمنُ يتقدّم ولا يرجع. */
    for (let i = 1; i < auth.length; i++) {
      expect(auth[i].at).toBeGreaterThan(auth[i - 1].at);
    }
  });

  it("يكتمل داخل 0.6s–0.8s", () => {
    expect(at(STEP.complete)).toBeGreaterThanOrEqual(600);
    expect(at(STEP.complete)).toBeLessThanOrEqual(800);
  });

  it("**التركيزُ لا يتأخّر** — كلُّ مَعلمٍ داخل نطاق المواصفة", () => {
    /*
     * «‏FOCUS MUST NOT FEEL LATE‏» هو المطلب الوحيد الصريح في §8، والباقي
     * «‏not strict pixel-perfect‏». فتُختبر **النطاقات** لا النقاط: رقمٌ
     * مضبوطٌ بالعين يبقى صحيحاً ما دام داخل النطاق، ولا ينكسر الاختبارُ
     * لأنّ أحداً حرّك مَعلماً عشرين مللي ثانية.
     */
    const within = (v: number, lo: number, hi: number) => {
      expect(v).toBeGreaterThanOrEqual(lo);
      expect(v).toBeLessThanOrEqual(hi);
    };

    within(at(STEP.navigation), 80, 150); // حضورٌ مكانيّ للشريط
    within(at(STEP.focusGlow), 150, 250); // وهجٌ محيط
    within(at(STEP.focusPlate), 200, 350); // الزجاج
    within(at(STEP.focus), 250, 400); // العنصرُ المحدَّد يسيطر
    expect(at(STEP.content)).toBeGreaterThanOrEqual(350); // الهيرو بعدهما
  });

  it("الحدُّ الأبيض يقع بين الزجاج وسيطرة العنصر — لا بعدهما", () => {
    expect(at(STEP.edge)).toBeGreaterThan(at(STEP.focusPlate));
    expect(at(STEP.edge)).toBeLessThanOrEqual(at(STEP.focus));
  });

  it("يبني الإطارَ على ثلاث خطواتٍ **متراكبة** لا متعاقبة", () => {
    /*
     * القاعدة: مدّةُ الطبقة أطولُ من الفاصل الذي يليها. وإلّا انتهت كلُّ
     * طبقةٍ قبل أن تبدأ التالية، فيُقرأ الإطارُ ثلاثَ قِطعٍ تُركَّب
     * بالدور — لا جسماً واحداً يتكثّف.
     */
    const build = focusFrame.buildDuration * 1000;

    expect(at(STEP.focusPlate) - at(STEP.focusGlow)).toBeLessThan(build);
    expect(at(STEP.edge) - at(STEP.focusPlate)).toBeLessThan(build);
  });

  it("مدّةُ حركة التركيز داخل 0.3s–0.4s كما تنصّ المواصفة", () => {
    expect(focusFrame.buildDuration).toBeGreaterThanOrEqual(0.3);
    expect(focusFrame.buildDuration).toBeLessThanOrEqual(0.4);
  });

  it("**لا تتابعَ للأيقونات** — الشريطُ طبقةٌ واحدة", () => {
    /*
     * §21 صريحة: «‏icon 1 → 50ms, icon 2 → 100ms … This is NOT the
     * desired effect‏». والاختبارُ يمنع عودتَه من بابٍ خلفيّ: لا مفتاحَ
     * اسمُه `stagger` في هذا النظام أصلاً.
     */
    expect("stagger" in icon).toBe(false);
    expect(Object.keys(icon)).toEqual(["rail"]);
  });

  it("**الأيقونات حاضرةٌ مكانياً مبكّراً** — لا تبدأ من العدم", () => {
    /*
     * «‏The icons should become spatially present very early‏»، و§4 تعطي
     * الرقمَ: `opacity ~0.75 → 1`. وصفرٌ هنا يعني «تظهر»، وهو ما تمنعه.
     */
    expect(icon.rail.from).toBeGreaterThanOrEqual(0.6);
    expect(icon.rail.from).toBeLessThan(icon.rail.to);
  });

  it("وحضورُ الشريط أسرعُ من بناء الإطار — يثبّت نفسه ثمّ يبدأ التركيز", () => {
    expect(icon.rail.duration).toBeLessThan(focusFrame.buildDuration);
  });

  it("مرحلةُ الإطار تُشتقّ من الخطوة اشتقاقاً صحيحاً", () => {
    expect(focusFrameStageOf(STEP.navigation)).toBe("hidden");
    expect(focusFrameStageOf(STEP.focusGlow)).toBe("glow");
    expect(focusFrameStageOf(STEP.focusPlate)).toBe("plate");
    expect(focusFrameStageOf(STEP.edge)).toBe("rim");
    /* وتبقى «rim» إلى آخر الجدول — البناءُ يتراكم ولا يتبادل. */
    expect(focusFrameStageOf(STEP.complete)).toBe("rim");
  });

  it("الإقلاعُ البارد يحفظ الترتيبَ نفسَه بإيقاعٍ أوسع", () => {
    const cold = assemblyOf("cold");

    expect(cold.map((m) => m.step)).toEqual(auth.map((m) => m.step));
    expect(cold[cold.length - 1].at).toBeGreaterThan(at(STEP.complete));
    /* ولا يتجاوز الثانية — «لا تجعل المستخدم ينتظر». */
    expect(cold[cold.length - 1].at).toBeLessThanOrEqual(1000);
  });
});
