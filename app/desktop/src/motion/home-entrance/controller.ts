import { create } from "zustand";

import { prefersStillMotion } from "../../core/system/preferences";

import {
  STEP, assemblyOf, blackoutAt, curtain, curtainSettleAt, focusFrameStageOf,
  handoff, leadOf, phaseOfStep,
  type CurtainBeat, type EntranceProfile, type FocusFrameStage,
  type HomeEntrancePhase, type Mark,
} from "./tokens";

/**
 * منسّقُ دخول الرئيسية — **مالكٌ واحد** لرحلة «كلمة المرور ← الرئيسية».
 *
 * القاعدةُ التي يفرضها: لا `setTimeout` لتوقيت الدخول في أيّ مكوّن. كانت
 * الرحلةُ موزّعةً على ثلاثة ملفّات — مؤقّتٌ في شاشة الاختيار، وتبديلُ
 * شجرةٍ في `App`، وسبعةُ مؤقّتاتٍ في الرئيسية — فلم يكن هناك موضعٌ واحد
 * يعرف «أين نحن الآن»، ولا وسيلةٌ لمقاطعة الرحلة ولا لإنهائها بأمان.
 *
 * **والساعةُ ساعتان، لا واحدة.** هذا هو الفرق الجوهري عن أوّل تنفيذ:
 *
 *   ① الطليعة — تُقاس من نجاح المصادقة. انسحابُ كلمة المرور، ثمّ تركيبُ
 *     الرئيسية خلف شاشةٍ ما زالت معتمة.
 *
 *   ② التجميع — يُقاس من **أوّل إطارٍ رُسمت فيه الرئيسية** (`ready()`).
 *     الغلافُ والتنقّلُ والتركيزُ والمحتوى.
 *
 * ولماذا لا ساعةٌ واحدة مطلقة: لأنّ ما بينهما ليس زمناً بل **عملاً**.
 * قِستُ تركيبَ الرئيسية في بناء الإنتاج فوجدته يحجب الخيطَ 310ms، وهو
 * رقمٌ يتبع الجهازَ وعددَ الأقسام. وبساعةٍ مطلقة كانت ثلاثُ مراحلَ
 * تُستهلك في التقّة التالية للحجب دفعةً واحدة — فيضيع التتابعُ في
 * اللحظة التي بُني لأجلها. الإسنادُ إلى الحدث يجعل الجدولَ صحيحاً على
 * كلّ جهاز بلا رقمٍ يُضبط يدوياً.
 *
 * ولماذا مخزنٌ (zustand) لا Context: للسبب نفسِه الذي جعل `orchestrator.ts`
 * مخزناً — المستهلكون في ثلاث شجراتٍ مختلفة (‏`App` فوق الموجّه،
 * و`BootScreen` خارجه، و`HomePage` داخله)، ومزوّدٌ يلفّ الجميع كان
 * سيُعيد عرضَ التطبيق كلِّه عند كلّ خطوة.
 */

/* ============================================================
 * 1 — الحالة
 * ============================================================ */

interface EntranceStore {
  phase: HomeEntrancePhase;
  /** الخطوةُ الحالية — تُقارَن بـ`STEP.*`. */
  step: number;
  profile: EntranceProfile;
  /** «تقليل الحركة» مفعَّل — يُقرأ مرّةً عند البدء لا في كلّ إطار. */
  still: boolean;

  /**
   * تُركَّب الرئيسيةُ الآن — **ولا تُرى بعد**.
   *
   * يصير `true` عند `handoff.mount`، والشاشةُ فوقها ما زالت معتمة. هذا
   * هو الفصلُ الذي يستر الحجب: التركيبُ شيء، والكشفُ عمّا رُكّب شيءٌ
   * آخر يقع بعده.
   */
  mounted: boolean;
  /**
   * الرئيسيةُ صارت مرسومةً — تبدأ الشاشةُ التي فوقها بالانسحاب.
   *
   * لولا فصلُه عن `mounted` لانكشف نصفُ مشهدٍ يُبنى: التلاشي يجري على
   * المُركِّب فيمضي بسلاسةٍ **بينما** الخيطُ محجوب، فيرى المستخدم
   * رئيسيةً نصفَ جاهزة تظهر من خلف شاشةٍ تختفي.
   */
  revealed: boolean;
  /** هل ما زالت شاشةُ الإقلاع مركَّبةً فوق الرئيسية؟ */
  overlayHeld: boolean;
  /**
   * أيُّ حركةٍ من حركات الستار نحن فيها الآن.
   *
   * ثلاثُ قيمٍ لا عَلَمان، لأنّ اللحظةَ ثلاثُ حركاتٍ لا حركتان:
   *
   *   `"off"`    لا شيء — قبل الرحلة وبعد الكشف.
   *   `"mark"`   الشعارُ حاضرٌ **فوق الفضاء وهو حيّ**؛ لا سوادَ بعد.
   *   `"black"`  الشعارُ والفضاءُ ذاهبان معاً إلى العتمة، وفيها تُبنى
   *              الرئيسية.
   *
   * وعَلَمٌ واحدٌ (`قائم/ساقط`) كان يجمع الثانيةَ والثالثة في معنىً واحد
   * — وهو بالضبط ما جعل السوادَ يبتلع الفضاءَ قبل أن يُرى الشعارُ فيه.
   * يقرؤها `HandoffCurtain` وحده.
   */
  curtain: CurtainBeat;
  /**
   * هل يقبل الصفُّ الإدخال؟ (§23)
   *
   * من `navigation` فصاعداً. قبلها لا توجد بلاطاتٌ يُنتقل بينها أصلاً،
   * وبعدها **لا يُحجَب شيء** ولو كانت الحركةُ جارية.
   */
  navReady: boolean;
}

const IDLE: EntranceStore = {
  phase: "idle",
  step: STEP.dark,
  profile: "return",
  still: false,
  mounted: false,
  revealed: false,
  overlayHeld: false,
  curtain: "off",
  navReady: false,
};

export const useEntranceStore = create<EntranceStore>()(() => ({ ...IDLE }));

/* ============================================================
 * 2 — الساعة
 * ============================================================ */

interface Event { at: number; apply: () => void }

let raf = 0;
let startedAt = 0;
/** الأحداثُ الباقية — تُستهلك بالترتيب ولا يُعاد المرورُ عليها. */
let pending: Event[] = [];
/** هل انطلقت مرحلةُ التجميع؟ يمنع `ready()` من أن يُنادى مرّتين. */
let assembling = false;
/**
 * **بوّابةُ الكشف — شرطان لا واحد.**
 *
 * كان الكشفُ يقع بـ`ready()` وحده: الرئيسيةُ تُرسم فتنسحب الشاشةُ
 * فوقها. وبدخول ستار الشعار صار للحظةِ الكشف مالكان: الرئيسيةُ يجب أن
 * تكون مرسومةً (وإلّا انكشف مشهدٌ نصفُ مبنيّ)، **و**الستارُ يجب أن يكون
 * قد استوفى مكوثَه (وإلّا ومض الشعارُ ومضةً لا تُقرأ على جهازٍ سريع).
 *
 * وأيُّهما تأخّر فهو الذي يفتح البوّابة — ولذلك عَلَمان لا مؤقّتٌ يجمع
 * بينهما: ترتيبُ وصولهما يتبع الجهازَ لا الجدول.
 */
let homePainted = false;
let curtainSettled = false;
/**
 * شبكةُ الأمان — المؤقّتُ الوحيد في النظام كلّه، ووظيفتُه أن يُنهي.
 *
 * `requestAnimationFrame` **يتوقّف** حين تُخفى النافذة أو يُخنق التبويب،
 * ولا يستأنف إلّا بعودتها. ورأيتُ ذلك مقيساً: فجواتٌ تبلغ 1.9s بين تقّةٍ
 * وأخرى في نافذةٍ خلفية. فلو غادر المستخدمُ النافذةَ في منتصف الدخول
 * لتجمّد المشهدُ عند خطوته — بلاطاتٌ نصفُها شفّاف — إلى أن يعود.
 *
 * ويحرس أمراً ثانياً: `ready()` قد لا يأتي أبداً (فشلَ تركيبُ الرئيسية،
 * أو قُذف المستخدم إلى مسارٍ آخر). فلا يجوز أن تبقى شاشةُ الإقلاع
 * معلّقةً فوق تطبيقٍ حيّ إلى الأبد.
 */
let guard = 0;

const stopClock = () => {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  pending = [];
};

const stop = () => {
  stopClock();
  if (guard) clearTimeout(guard);
  guard = 0;
  assembling = false;
  homePainted = false;
  curtainSettled = false;
};

const tick = () => {
  const t = performance.now() - startedAt;

  /**
   * الساعةُ التي نعمل عليها الآن — **ومقارنتُها شرطُ سلامةِ الحلقة**.
   *
   * حدثٌ في هذه الساعة قد يفتح ساعةً أخرى: علامةُ انتهاء مكوث الستار
   * تستدعي `reveal()` وهو يبدأ جدولَ التجميع. و`pending` متغيّرٌ عامّ،
   * فلو واصلت الحلقةُ بعده لوجدت أحداثَ الجدول **الجديد** وقارنتها
   * بـ`t` القديمة (‏~1.7s) — فتستهلكها كلَّها في تقّةٍ واحدة، ويظهر
   * المشهدُ الذي بُني للتتابع دفعةً واحدة.
   *
   * والخروجُ هنا سليمٌ تماماً: `runClock` عيّن `raf` للساعة الجديدة قبل
   * أن نعود إليه.
   */
  const clock = pending;

  /*
   * `while` لا `if`: على جهازٍ خانق قد يقفز الإطارُ مئاتِ المللي فتفوت
   * خطوتان معاً. استهلاكُهما في التقّة نفسِها يجعل الجدولَ **يتخطّى** ما
   * فات بدل أن يُصطفّ خلفه — فالمستخدم يرى مشهداً متأخّراً لا مبعثراً.
   * (وأكبرُ مصادر التخلّف — تركيبُ الرئيسية — لم يعد داخل هذه الساعة
   *  أصلاً، فهذا احتياطٌ لما بقي.)
   */
  while (clock === pending && pending.length && pending[0].at <= t) {
    pending.shift()!.apply();
  }

  if (clock !== pending) return;

  raf = pending.length ? requestAnimationFrame(tick) : 0;
};

/** يبدأ ساعةً جديدة على مجموعة أحداثٍ مرتَّبة. */
const runClock = (events: Event[]) => {
  stopClock();
  if (!events.length) return;
  events.sort((a, b) => a.at - b.at);
  startedAt = performance.now();
  pending = events;
  raf = requestAnimationFrame(tick);
};

/** يحوّل علامةَ جدولٍ إلى حدثٍ يكتب الحالة. */
const stepEvent = (m: Mark): Event => ({
  at: m.at,
  apply: () =>
    useEntranceStore.setState({
      step: m.step,
      phase: phaseOfStep(m.step),
      navReady: m.step >= STEP.navigation,
    }),
});

/* ============================================================
 * 3 — الواجهة
 * ============================================================ */

/** الحالةُ النهائيةُ الصالحة — نقطةُ السقوط الآمن (§25). */
const finalState = (): Partial<EntranceStore> => ({
  phase: "complete",
  step: STEP.complete,
  mounted: true,
  revealed: true,
  overlayHeld: false,
  curtain: "off",
  navReady: true,
});

/**
 * **الكشف — يقع حين يستوفي الشرطان، لا حين يصل أوّلُهما.**
 *
 * تُنادى من موضعين: `ready()` حين تُرسم الرئيسية، وعلامةُ انتهاء مكوث
 * الستار في جدول الطليعة. وأيُّهما جاء أخيراً هو الذي يفتح البوّابة؛
 * والسابقُ منهما يجدها مغلقةً فيعود بلا أثر.
 *
 * وهذا هو ما كان في `ready()` نفسِه قبل الستار — لم يتبدّل التجميعُ
 * ولا جدولُه، وإنّما تبدّل **من يأذن ببدئه**.
 */
const reveal = () => {
  const s = useEntranceStore.getState();

  if (assembling || s.phase === "complete" || s.profile === "return") return;
  if (!homePainted) return;
  /* والستارُ لا يقوم إلّا في طريق المصادقة — فلا ينتظره الإقلاعُ البارد. */
  if (s.profile === "auth" && !curtainSettled) return;

  assembling = true;
  if (guard) clearTimeout(guard);

  const marks = assemblyOf(s.profile);
  if (!marks.length) return homeEntrance.complete();

  /*
   * الكشفُ وإسقاطُ الستار في كتابةٍ واحدة: الستارُ ينقشع (‏`curtain.out`)
   * بينما تُجمَّع الرئيسيةُ تحته، فأوّلُ ما يُرى منها هو غلافُها وقد بدأ
   * يستيقظ — لا شاشةٌ ساكنةٌ تنتظر أن تتحرّك.
   */
  useEntranceStore.setState({ revealed: true, curtain: "off" });

  const events = marks.map(stepEvent);

  if (s.profile === "auth") {
    events.push({
      at: handoff.release,
      apply: () => useEntranceStore.setState({ overlayHeld: false }),
    });
  }

  runClock(events);

  /* وحارسُ التجميع: آخرُ علامةٍ زائد هامشٌ لتخلّفٍ معقول في الساعة. */
  guard = window.setTimeout(
    () => homeEntrance.complete(),
    events[events.length - 1].at + 400,
  );
};

export const homeEntrance = {
  /**
   * بدءُ الرحلة. تُنادى من موضعٍ واحد لكلّ طريق:
   *   • `"auth"`   — شاشةُ الاختيار، لحظةَ نجاح المصادقة.
   *   • `"cold"`   — الرئيسية، حين تُركَّب بلا رحلةٍ سابقة (‏Ctrl+R).
   *   • `"return"` — الرئيسية، عائدةً من قسم: تكتمل فوراً.
   *
   * وهي تُجري الطليعةَ وحدها؛ التجميعُ ينتظر `ready()`.
   */
  start(profile: EntranceProfile) {
    stop();

    if (profile === "return") {
      // العودةُ من قسم: الغلافُ قائمٌ أصلاً، فلا مشهدَ يُبنى.
      useEntranceStore.setState({ ...IDLE, ...finalState(), profile });
      return;
    }

    const still = prefersStillMotion();
    const lead = leadOf(profile);

    useEntranceStore.setState({
      ...IDLE,
      profile,
      still,
      step: lead.length ? lead[0].step : STEP.dark,
      phase: lead.length ? phaseOfStep(lead[0].step) : "idle",
      /*
       * الإقلاعُ البارد لا شاشةَ فوقه ولا تسليمَ ينتظره: الرئيسيةُ هي
       * المركَّبةُ منذ الإطار الأول. أمّا `auth` فتبدأ والشاشةُ السابقة
       * ما زالت تملك الصورة.
       */
      mounted: profile === "cold",
      overlayHeld: profile === "auth",
    });

    const events = lead.map(stepEvent);

    if (profile === "auth") {
      /*
       * أربعُ علاماتٍ لطريق المصادقة، وترتيبُها هو كلُّ المعنى:
       *
       *   ① يحضر الشعار      — فوق الفضاء وهو حيّ، والمحتوى قد انسحب.
       *   ② تبدأ العتمة      — الشعارُ والفضاءُ يذهبان معاً.
       *   ③ تُركَّب الرئيسية  — والشاشةُ سوداءُ خالصة، فالحجبُ لا يُرى.
       *   ④ ينقضي حدُّ العتمة — فيُفتح نصفُ بوّابة الكشف.
       *
       * والتركيبُ عند الثالثة لا قبلها: قبلها يقع الحجبُ على فضاءٍ
       * يتحرّك فيُرى تجمّدُه، وبعد الرابعة يُرى السوادُ ينقشع عن شاشةٍ
       * لم تُبنَ.
       */
      events.push(
        {
          at: curtain.in,
          apply: () => useEntranceStore.setState({ curtain: "mark" }),
        },
        {
          at: blackoutAt,
          apply: () => useEntranceStore.setState({ curtain: "black" }),
        },
        {
          at: handoff.mount,
          apply: () => useEntranceStore.setState({ mounted: true }),
        },
        {
          at: curtainSettleAt,
          apply: () => {
            curtainSettled = true;
            reveal();
          },
        },
      );
    }

    runClock(events);

    /*
     * حارسُ الطليعة: إن لم تُعلن الرئيسيةُ جاهزيّتها فقد تعطّل شيء —
     * تُنهى الرحلةُ إلى حالتها الصالحة ولا تُترك معلّقة.
     *
     * والمهلةُ تُقاس **بعد** انقضاء الستار في طريق المصادقة: الكشفُ
     * مؤجَّلٌ إليه أصلاً، فحارسٌ يسبقه كان سيقطع اللحظةَ التي بُني
     * لأجلها ويقذف المستخدمَ إلى الحالة النهائية بلا تجميع.
     */
    guard = window.setTimeout(
      () => homeEntrance.complete(),
      (profile === "auth" ? curtainSettleAt : 0) + 2000,
    );
  },

  /**
   * **الرئيسيةُ رُسمت** — نصفُ الإذن بالكشف، لا الإذنُ كلُّه.
   *
   * تُنادى من `HomePage` في أوّل إطارٍ بعد تركيبها — بعد أن يكون الحجبُ
   * الثقيل قد وقع وانقضى. وهي مُهمَلةٌ إن نوديت مرّتين (‏StrictMode
   * يركّب المكوّن مرّتين في التطوير) أو بعد الاكتمال.
   *
   * وكانت تكشف بنفسها؛ صارت ترفع عَلَمها وتَكِل القرارَ إلى `reveal`:
   * في طريق المصادقة يبقى ستارُ الشعار قائماً بعدها، وكشفٌ عنده كان
   * يجعل الشعارَ ومضةً بمقدار زمنِ تركيبِ الرئيسية — أي أنّه يقصُر
   * كلّما أسرع الجهاز، وهو نقيضُ لحظةٍ قُصد بها أن تُقرأ.
   */
  ready() {
    homePainted = true;
    reveal();
  },

  /**
   * الإنهاءُ الفوري — **نقطةُ السقوط الآمن**، وهي ما يضمن (§25).
   *
   * تُنادى من أربعة مواضع: انتهاءُ الجدول طبيعياً، وانقضاءُ أيّ حارس،
   * وتدخّلُ المستخدم، وتعذّرُ التجميع. وفي كلّها تنتهي الحالةُ إلى
   * الشيء نفسِه: لا بلاطةَ خفيّة، ولا تمويهٌ عالق، ولا حجابٌ باقٍ.
   */
  complete() {
    stop();
    useEntranceStore.setState(finalState());
  },

  /**
   * تدخّلُ المستخدم أثناء الدخول (§23).
   *
   * إن كان الصفُّ جاهزاً فالرحلةُ تُطوى فوراً: من ضغط سهماً فقد أعلن
   * أنّه لا ينتظر المشهد، ومواصلةُ العرض بعدها تجعل الجهازَ يبدو بطيئاً
   * مهما كانت الحركةُ ناعمة. وإن لم يكن جاهزاً فلا شيء — لا بلاطةَ
   * يُنتقل إليها أصلاً، وطيُّ المشهد هناك يُلغي دخولاً لم يُرَ منه شيء.
   */
  interrupt() {
    if (useEntranceStore.getState().navReady) homeEntrance.complete();
  },

  /** لجلسةٍ جديدة (تسجيلُ خروج) — لا حالةَ تُورَّث. */
  reset() {
    stop();
    useEntranceStore.setState({ ...IDLE });
  },

  /** للقراءة خارج React (‏`App`، لوحةُ التنقيح). */
  get: () => useEntranceStore.getState(),
};

/* ============================================================
 * 4 — قارئاتٌ للمكوّنات
 * ============================================================ */

export const useEntrancePhase = () => useEntranceStore((s) => s.phase);
export const useEntranceStep = () => useEntranceStore((s) => s.step);
export const useEntranceStill = () => useEntranceStore((s) => s.still);
export const useHomeMounted = () => useEntranceStore((s) => s.mounted);
export const useHomeRevealed = () => useEntranceStore((s) => s.revealed);
export const useOverlayHeld = () => useEntranceStore((s) => s.overlayHeld);
/** يقرؤها `HandoffCurtain` وحده — أيُّ حركةٍ من حركات الستار نحن فيها. */
export const useCurtain = () => useEntranceStore((s) => s.curtain);

/**
 * أعلامُ المراحل — الشكلُ الذي كانت الرئيسية تقرأ به جدولَ `boot.ts`.
 *
 * إبقاؤها بأسمائها هو ما جعل تركيبَ هذا النظام لا يمسّ `SpatialNavItem`
 * ولا `FocusIndicator` ولا حقلَ الطاقة: تبدّل **مصدرُ** العلَم لا
 * معناه. وأيُّ إعادة تسميةٍ هنا كانت ستتحوّل إلى تعديلٍ في عشرة مواضع
 * بلا مكسب.
 */
export function useEntranceStages() {
  const step = useEntranceStep();
  return {
    /** ① البيئة */
    worldLit: step >= STEP.environment,
    bgReady: step >= STEP.shell,
    identityReady: step >= STEP.shell,
    /** ② الشريط — حاضرٌ ويبدأ وضوحُه بالارتفاع */
    assembled: step >= STEP.navigation,
    /** ③ وهجُ التركيز */
    glowReady: step >= STEP.focusGlow,
    /** ④ سطحُ التركيز الزجاجي */
    plateReady: step >= STEP.focusPlate,
    /** ⑤ الحدُّ الأبيض */
    edgeReady: step >= STEP.edge,
    /** ⑥ تأكيدُ العنصر */
    focusArrived: step >= STEP.focus,
    /** ⑦ المحتوى */
    entered: step >= STEP.content,
    /** ⑧ اكتمالُ الصفحة */
    settled: step >= STEP.complete,
  };
}

/**
 * مرحلةُ بناء الإطار — ثلاثُ خطواتٍ في قيمةٍ واحدة يقرؤها العارض.
 *
 * تُشتقّ هنا لا في الرئيسية: العارضُ يحتاج «أين بلغ الإطار» لا ثلاثةَ
 * أعلامٍ يعيد تركيبها بنفسه — ولو مُرّرت أعلاماً لصار ترتيبُها قراراً
 * يُتّخذ في نقطة الاستدعاء.
 */
export const useFocusFrameStage = (): FocusFrameStage =>
  useEntranceStore((s) => focusFrameStageOf(s.step));
