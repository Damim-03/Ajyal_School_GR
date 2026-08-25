import { describe, expect, it } from "vitest";

import { frameAt, phaseAt, SETTLED } from "./BootTimeline";
import {
  BIRTH_FLOOR, PHASE_AT, PHASE_ORDER, REDUCED_SCALE, SEED_HOLD, TOTAL,
} from "./boot.config";

/**
 * **جدولُ الإقلاع — يُختبر لأنّه دالّةٌ خالصة، وهذا كلُّ فائدته.**
 *
 * مشهدٌ سينمائيٌّ لا يُختبر عادةً: يُنظر إليه ويُحكم عليه. لكنّ هذا
 * الجدولَ ليس صورةً — هو **آلةُ حالاتٍ في الزمن**، وأخطاؤها من نوعٍ لا
 * تلتقطه العين: طورٌ يبدأ قبل سابقه بعشرين مللي ثانية، أو قيمةٌ تتجاوز
 * الواحد فتقصّها بطاقةُ الرسوم صامتةً، أو مشهدٌ لا يستقرّ عند نهايته
 * فيبقى يتحرّك تحت شاشة المصادقة.
 *
 * ولأنّ `frameAt(t)` بلا حالةٍ ولا عشوائية، تكفي مقارنةُ مخرجاتها.
 */

const SAMPLES = 400;
const step = TOTAL / SAMPLES;

/** كلُّ القيم المتّصلة في الإطار — تُفحص جملةً. */
const CHANNELS = [
  "logo", "black", "emerge", "spread", "gold", "bloom", "disperse", "intensity", "auth",
] as const;

describe("جدولُ الإقلاع", () => {
  it("يمرّ بالأطوار الثلاثة عشر بالترتيب المعلن", () => {
    const seen: string[] = [];

    for (let i = 0; i <= SAMPLES; i++) {
      const p = phaseAt(i * step);
      if (seen[seen.length - 1] !== p) seen.push(p);
    }

    /* `BOOT_IDLE` و`LOGO_REVEAL` عند الصفر نفسِه، فيُرى الثاني وحده. */
    expect(seen).toEqual(PHASE_ORDER.filter((p) => p !== "BOOT_IDLE"));
  });

  it("**كلُّ قناةٍ مكبوحةٌ في [0..1]** — ولا قيمةَ تفلت إلى المُظلِّل", () => {
    /*
     * وهذا أهمُّ اختبارٍ هنا. القيمةُ التي تتجاوز الواحد لا تُسقط شيئاً
     * ولا تُسجَّل: تُقصّ صامتةً في الوحدة الرسومية، فيظهر العطلُ لطخةً
     * بيضاءَ لا يُعرف من أين جاءت.
     */
    for (let i = 0; i <= SAMPLES; i++) {
      const f = frameAt(i * step);

      for (const key of CHANNELS) {
        expect(f[key], `${key} @ ${(i * step).toFixed(2)}s`).toBeGreaterThanOrEqual(0);
        expect(f[key], `${key} @ ${(i * step).toFixed(2)}s`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("حتميٌّ — اللحظةُ نفسُها تُخرج الإطارَ نفسَه (§35)", () => {
    for (const t of [0, 1.7, 4.2, 6.9, 8.5, TOTAL]) {
      expect(frameAt(t)).toEqual(frameAt(t));
    }
  });

  it("لا يُقفز إلى الأمام: النشأةُ والتبدّدُ يتقدّمان ولا يرجعان", () => {
    let emerge = -1;
    let disperse = -1;

    for (let i = 0; i <= SAMPLES; i++) {
      const f = frameAt(i * step);
      expect(f.emerge).toBeGreaterThanOrEqual(emerge - 1e-9);
      expect(f.disperse).toBeGreaterThanOrEqual(disperse - 1e-9);
      emerge = f.emerge;
      disperse = f.disperse;
    }
  });

  it("**الصمتُ البصريّ**: عتمةٌ تامّةٌ ولا جسيمَ قبل البذرة (§7)", () => {
    const dark = frameAt(PHASE_AT.BLACK_TRANSITION + 0.1);

    expect(dark.black).toBe(1);
    expect(dark.emerge).toBe(0);
    expect(dark.logo).toBe(0);
  });

  it("البذرةُ واحدة: النشأةُ تبدأ بعد العتمة وتكاد تكون صفراً عندها (§8)", () => {
    expect(frameAt(PHASE_AT.BLUE_SEED - 0.01).emerge).toBe(0);

    /*
     * **الشرطُ الذي يجعلها بذرةً واحدة**: النشأةُ تبقى دون رتبةِ ولادةِ
     * ثاني جسيم، طوالَ الطور. فلا يُولد إلّا الجسيمُ صفر.
     *
     * ويُقارَن الرقمان من مصدرهما لا بعددٍ مكتوبٍ هنا — وإلّا انحرف
     * أحدُهما يوماً وبقي الاختبارُ أخضر.
     */
    expect(SEED_HOLD).toBeLessThan(BIRTH_FLOOR);

    for (let t = PHASE_AT.BLUE_SEED; t < PHASE_AT.BLUE_GENESIS; t += 0.02) {
      expect(frameAt(t).emerge, `emerge @ ${t.toFixed(2)}s`).toBeLessThan(BIRTH_FLOOR);
    }

    /* وقد وُلدت فعلاً — لا أنّ الطور مرّ فارغاً. */
    expect(frameAt(PHASE_AT.BLUE_GENESIS - 0.05).emerge).toBeGreaterThan(0);
  });

  it("الأزرقُ يسبق الذهبَ سبقاً تامّاً (§15)", () => {
    /* عند اكتمال الحقل الأزرق لا ذهبَ بعد. */
    expect(frameAt(PHASE_AT.BLUE_FLOW).gold).toBe(0);
    expect(frameAt(PHASE_AT.BLUE_FLOW).emerge).toBeCloseTo(1, 5);

    /* والذهبُ يظهر **تدريجياً** لا دفعةً: منتصفُ مدّته دون الثلثين. */
    const mid = (PHASE_AT.GOLD_INTRODUCTION + PHASE_AT.WARM_BLOOM) / 2;
    expect(frameAt(mid).gold).toBeGreaterThan(0.2);
    expect(frameAt(mid).gold).toBeLessThan(0.8);
  });

  it("الوهجُ نبضةٌ: يصعد ويهبط ولا يبقى (§21)", () => {
    let peak = 0;
    let peakAt = 0;

    for (let i = 0; i <= SAMPLES; i++) {
      const f = frameAt(i * step);
      if (f.bloom > peak) {
        peak = f.bloom;
        peakAt = i * step;
      }
    }

    expect(peak).toBeCloseTo(1, 3);
    expect(peakAt).toBeGreaterThan(PHASE_AT.BLUE_GOLD_INTERACTION);
    expect(peakAt).toBeLessThan(PHASE_AT.AUTH_TRANSITION);
    /* وقد خبا عند التسليم. */
    expect(frameAt(TOTAL).bloom).toBeLessThan(0.05);
  });

  it("**الحقلُ يخفت ولا ينطفئ** — المصادقةُ ترث الجوّ (§24)", () => {
    const end = frameAt(TOTAL);

    expect(end.intensity).toBeGreaterThan(0.15);
    expect(end.intensity).toBeLessThan(0.35);
  });

  it("بيئةُ المصادقة تتشكّل بينما ما زال الحقلُ يتبدّد — تراكبٌ لا تعاقب (§23)", () => {
    const t = PHASE_AT.AUTH_TRANSITION + 0.3;
    const f = frameAt(t);

    expect(f.auth).toBeGreaterThan(0);
    expect(f.auth).toBeLessThan(1);
    /* والتبدّدُ ما زال جارياً في اللحظة نفسِها. */
    expect(f.disperse).toBeGreaterThan(0);
    expect(f.disperse).toBeLessThan(1);
  });

  it("يستقرّ عند النهاية ولا يواصل الحركة تحت شاشة المصادقة", () => {
    const a = frameAt(TOTAL);
    const b = frameAt(TOTAL + 5);

    for (const key of CHANNELS) expect(b[key]).toBeCloseTo(a[key], 9);
    expect(b.done).toBe(true);
    expect(SETTLED.done).toBe(true);
  });

  it("«تقليل الحركة» يضغط الزمنَ ويحفظ الترتيب (§32)", () => {
    /* المشهدُ كلُّه يكتمل في ثلث المدّة تقريباً. */
    expect(frameAt(TOTAL * REDUCED_SCALE, true).done).toBe(true);
    expect(frameAt(TOTAL * REDUCED_SCALE * 0.9, true).done).toBe(false);

    /* والترتيبُ هو هو — الأطوارُ نفسُها بالتسلسل نفسِه. */
    const seen: string[] = [];
    const rStep = (TOTAL * REDUCED_SCALE) / SAMPLES;

    for (let i = 0; i <= SAMPLES; i++) {
      const p = frameAt(i * rStep, true).phase;
      if (seen[seen.length - 1] !== p) seen.push(p);
    }

    expect(seen).toEqual(PHASE_ORDER.filter((p) => p !== "BOOT_IDLE"));
  });

  it("لا قناةَ تقفز قفزةً حادّة بين إطارين متجاورين", () => {
    /*
     * حارسٌ ضدّ انكسارٍ في المنحنيات: أيُّ قناةٍ تتحرّك أكثرَ من 12%
     * في 22ms (‏إطارٌ ونصف) تُقرأ قفزةً لا حركة — وهو ما تمنعه §37.
     */
    const dt = 0.022;

    for (let t = 0; t <= TOTAL; t += dt) {
      const a = frameAt(t);
      const b = frameAt(t + dt);

      for (const key of CHANNELS) {
        expect(
          Math.abs(b[key] - a[key]),
          `${key} @ ${t.toFixed(2)}s`,
        ).toBeLessThan(0.12);
      }
    }
  });
});
