import { describe, expect, it } from "vitest";

import {
  advance,
  canGoBack,
  canSubmit,
  displayStep,
  FIRST_BOOT_STEPS,
  isFirstBootStep,
  nextStep,
  previousStep,
  progressOf,
  resolveCurrent,
  stepTraits,
  type FirstBootStep,
  type MachineState,
} from "./first-boot.state";

/**
 * آلةُ الحالات — وهي الموضعُ الذي تُختبر فيه قواعدُ §44 و§63 بلا خادم.
 *
 * وما يُقاس هنا ليس «هل تعمل الدالّة» بل **هل يُمكن التخطّي**: أن
 * يُثبَت أنّ القفزَ مرفوضٌ وأنّ الإعادةَ لا تُكرّر، أنفعُ من مئةِ
 * اختبارٍ على الشاشات.
 */

const stateAt = (
  done: FirstBootStep[],
  status: MachineState["status"] = "IN_PROGRESS",
): MachineState => ({
  status,
  current: resolveCurrent(done),
  done,
});

describe("ترتيبُ الخطوات", () => {
  it("يبدأ باللغة وينتهي بالجاهزية", () => {
    expect(FIRST_BOOT_STEPS[0]).toBe("LANGUAGE");
    expect(FIRST_BOOT_STEPS[FIRST_BOOT_STEPS.length - 1]).toBe("READY");
  });

  it("يضع المديرَ قبل هوية المؤسسة والسنةِ الدراسية", () => {
    const index = (step: FirstBootStep) => FIRST_BOOT_STEPS.indexOf(step);

    expect(index("ADMINISTRATOR")).toBeLessThan(index("INSTITUTION"));
    expect(index("INSTITUTION")).toBeLessThan(index("ACADEMIC_YEAR"));
  });

  it("يضع الشبكةَ قبل كلِّ خطوةٍ تكتب في القاعدة", () => {
    const network = FIRST_BOOT_STEPS.indexOf("NETWORK");

    const writers = FIRST_BOOT_STEPS.filter(
      (step) => stepTraits(step).writesData,
    );

    for (const step of writers) {
      expect(FIRST_BOOT_STEPS.indexOf(step)).toBeGreaterThan(network);
    }
  });

  it("يعرف خطواتِه ويرفض ما ليس منها", () => {
    expect(isFirstBootStep("LANGUAGE")).toBe(true);
    expect(isFirstBootStep("DASHBOARD")).toBe(false);
  });

  it("لا تالٍ بعد الأخيرة ولا سابقٌ قبل الأولى", () => {
    expect(nextStep("READY")).toBeNull();
    expect(previousStep("LANGUAGE")).toBeNull();
  });
});

describe("الخطوةُ الحالية", () => {
  it("هي أوّلُ ما لم يُتمّ", () => {
    expect(resolveCurrent([])).toBe("LANGUAGE");
    expect(resolveCurrent(["LANGUAGE", "REGION"])).toBe("NETWORK");
  });

  it("تتخطّى الفجوةَ إلى أوّلِ ناقصٍ لا إلى ما بعد آخرِ متمّ", () => {
    /*
     * حالةُ الرجوع: أتمّ المستخدمُ حتى «العرض» ثمّ رجع فمُحيت
     * «المنطقة». فموضعُه المنطقةُ — لا ما بعد العرض.
     */
    expect(resolveCurrent(["LANGUAGE", "NETWORK", "DISPLAY"])).toBe("REGION");
  });
});

describe("قبولُ الإرسال", () => {
  it("يقبل الخطوةَ الحالية", () => {
    expect(canSubmit(stateAt([]), "LANGUAGE")).toEqual({
      allowed: true,
      resubmit: false,
    });
  });

  it("يرفض القفزَ إلى خطوةٍ لاحقة", () => {
    const decision = canSubmit(stateAt([]), "ADMINISTRATOR");

    expect(decision).toEqual({ allowed: false, reason: "AHEAD" });
  });

  it("يقبل إعادةَ إرسالِ خطوةٍ متمّة تصحيحاً", () => {
    const state = stateAt(["LANGUAGE", "REGION"]);

    expect(canSubmit(state, "LANGUAGE")).toEqual({
      allowed: true,
      resubmit: true,
    });
  });

  it("يرفض كلَّ شيءٍ بعد الاكتمال", () => {
    const state = stateAt([...FIRST_BOOT_STEPS], "COMPLETED");

    expect(canSubmit(state, "LANGUAGE")).toEqual({
      allowed: false,
      reason: "COMPLETED",
    });
  });
});

describe("التقدّم", () => {
  it("يُعلّم الخطوةَ ويُقدّم المؤشّر", () => {
    const after = advance(stateAt([]), "LANGUAGE");

    expect(after.done).toEqual(["LANGUAGE"]);
    expect(after.current).toBe("REGION");
    expect(after.status).toBe("IN_PROGRESS");
  });

  it("لا يُكرّر خطوةً متمّةً عند الإعادة", () => {
    const state = stateAt(["LANGUAGE", "REGION", "NETWORK"]);
    const after = advance(state, "LANGUAGE");

    expect(after.done.filter((step) => step === "LANGUAGE")).toHaveLength(1);
    expect(after.current).toBe("DISPLAY");
  });

  it("لا يتراجع المؤشّرُ بتصحيحِ خطوةٍ قديمة", () => {
    const state = stateAt(["LANGUAGE", "REGION", "NETWORK", "DISPLAY"]);

    expect(advance(state, "REGION").current).toBe("PERFORMANCE");
  });
});

describe("الرجوع", () => {
  it("يرجع خطوةً واحدة في الخطوات القابلة", () => {
    const state = stateAt(["LANGUAGE", "REGION"]);

    expect(canGoBack(state, "NETWORK")).toEqual({
      allowed: true,
      target: "REGION",
    });
  });

  it("يتخطّى خطوةَ المدير لأنّها لا تُرجَع", () => {
    const done: FirstBootStep[] = [
      "LANGUAGE",
      "REGION",
      "NETWORK",
      "DISPLAY",
      "PERFORMANCE",
      "TERMS",
      "UPDATE",
      "DEVICES",
      "ADMINISTRATOR",
    ];

    /* من «المؤسسة» رجوعاً: المديرُ خلفَها ولا يُرجَع إليه ⇒ الأجهزة */
    expect(canGoBack(stateAt(done), "INSTITUTION")).toEqual({
      allowed: true,
      target: "DEVICES",
    });
  });

  it("لا رجوعَ من أوّل خطوة", () => {
    expect(canGoBack(stateAt([]), "LANGUAGE")).toEqual({
      allowed: false,
      reason: "IRREVERSIBLE",
    });
  });

  it("لا رجوعَ بعد الاكتمال", () => {
    const state = stateAt([...FIRST_BOOT_STEPS], "COMPLETED");

    expect(canGoBack(state, "RECOVERY")).toEqual({
      allowed: false,
      reason: "COMPLETED",
    });
  });
});

describe("التقدّم المعروض", () => {
  it("يعدّ من واحدٍ لا من صفر", () => {
    expect(progressOf("LANGUAGE")).toEqual({
      index: 1,
      total: FIRST_BOOT_STEPS.length,
    });
  });

  it("يبلغ النهايةَ عند الجاهزية", () => {
    const { index, total } = progressOf("READY");

    expect(index).toBe(total);
  });
});

describe("الخطوةُ المعروضة", () => {
  /*
   * **المصيدةُ التي أُغلقت هنا.**
   *
   * `verifyService` تختم `FINAL_VERIFICATION` عند نجاح الفحص، والحالةُ
   * تبقى `IN_PROGRESS` لأنّ الإتمامَ لم يقع بعد. فتصير `done` كاملةً،
   * وتردّ `resolveCurrent` آخرَ الخطوات — وهي شاشةُ التتويج.
   *
   * ونتيجتُها كانت تركيباً عالقاً: «أنت جاهز» في كلّ إقلاع، وزرُّها
   * يُسلّم إلى التطبيق ولا ينادي `/complete`. فشاشةُ التحقّق — الوحيدةُ
   * التي تُتمّ — لا تُعرض ثانيةً أبداً.
   */
  it("**لا تتويجَ لتركيبٍ لم يُتمّ** — وإن اكتملت خطواتُه", () => {
    const done = FIRST_BOOT_STEPS.filter((step) => step !== "READY");

    /* `resolveCurrent` تقول أين وصل التقدّم… */
    expect(resolveCurrent(done)).toBe("READY");

    /* …و`displayStep` تقول ماذا يُعرض. وهذا هو الفرق. */
    expect(displayStep("IN_PROGRESS", done)).toBe("FINAL_VERIFICATION");
    expect(displayStep("FAILED", done)).toBe("FINAL_VERIFICATION");
  });

  it("والتركيبُ المُتَمُّ يبلغ «جاهز» مهما كانت خطواتُه المسجَّلة", () => {
    expect(displayStep("COMPLETED", [...FIRST_BOOT_STEPS])).toBe("READY");
    /* حتى لو ضاع سجلُّ الخطوات: الحالةُ هي الحَكَم بعد الإتمام. */
    expect(displayStep("COMPLETED", [])).toBe("READY");
  });

  it("ولا تُغيّر شيئاً في منتصف الطريق", () => {
    for (let i = 0; i < FIRST_BOOT_STEPS.length - 1; i++) {
      const done = FIRST_BOOT_STEPS.slice(0, i);

      expect(displayStep("IN_PROGRESS", done)).toBe(resolveCurrent(done));
    }
  });
});
