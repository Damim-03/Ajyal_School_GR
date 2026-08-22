import { create } from "zustand";

import {
  STEP, assemblyOf, handoff, leadOf, phaseOfStep,
  type EntranceProfile, type HomeEntrancePhase, type Mark,
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
};

const tick = () => {
  const t = performance.now() - startedAt;

  /*
   * `while` لا `if`: على جهازٍ خانق قد يقفز الإطارُ مئاتِ المللي فتفوت
   * خطوتان معاً. استهلاكُهما في التقّة نفسِها يجعل الجدولَ **يتخطّى** ما
   * فات بدل أن يُصطفّ خلفه — فالمستخدم يرى مشهداً متأخّراً لا مبعثراً.
   * (وأكبرُ مصادر التخلّف — تركيبُ الرئيسية — لم يعد داخل هذه الساعة
   *  أصلاً، فهذا احتياطٌ لما بقي.)
   */
  while (pending.length && pending[0].at <= t) pending.shift()!.apply();

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
  navReady: true,
});

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

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
      events.push({
        at: handoff.mount,
        apply: () => useEntranceStore.setState({ mounted: true }),
      });
    }

    runClock(events);

    /*
     * حارسُ الطليعة: إن لم تُعلن الرئيسيةُ جاهزيّتها خلال ثانيتين فقد
     * تعطّل شيء — تُنهى الرحلةُ إلى حالتها الصالحة ولا تُترك معلّقة.
     */
    guard = window.setTimeout(() => homeEntrance.complete(), 2000);
  },

  /**
   * **الرئيسيةُ رُسمت.** من هنا يبدأ التجميع.
   *
   * تُنادى من `HomePage` في أوّل إطارٍ بعد تركيبها — بعد أن يكون الحجبُ
   * الثقيل قد وقع وانقضى. وهي مُهمَلةٌ إن نوديت مرّتين (‏StrictMode
   * يركّب المكوّن مرّتين في التطوير) أو بعد الاكتمال.
   */
  ready() {
    const s = useEntranceStore.getState();
    if (assembling || s.phase === "complete" || s.profile === "return") return;

    assembling = true;
    if (guard) clearTimeout(guard);

    const marks = assemblyOf(s.profile);
    if (!marks.length) return homeEntrance.complete();

    useEntranceStore.setState({ revealed: true });

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
    worldLit: step >= STEP.environment,
    bgReady: step >= STEP.shell,
    identityReady: step >= STEP.shell,
    assembled: step >= STEP.navigation,
    focusArrived: step >= STEP.focus,
    edgeReady: step >= STEP.edge,
    entered: step >= STEP.content,
    settled: step >= STEP.complete,
  };
}
