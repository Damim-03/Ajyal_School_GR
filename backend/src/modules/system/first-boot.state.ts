/**
 * آلةُ حالات التهيئة الأولى — نقيّةٌ بلا قاعدةِ بيانات ولا شبكة.
 *
 * **ولماذا آلةُ حالاتٍ لا عدّادُ خطوات؟** لأنّ `step = 4` لا يقول شيئاً
 * عمّا وقع فعلاً: إن أُضيفت شاشةٌ في المنتصف صار الرقمُ المحفوظ يشير
 * إلى شاشةٍ أخرى، ومَن انقطع عنده يعود إلى غيرِ ما تركه. والاسمُ يبقى
 * اسماً مهما تبدّل ترتيبُه.
 *
 * وأبعدُ من ذلك: الآلةُ هي الحارس. الواجهةُ تطلب خطوةً، والخادمُ يقرّر
 * هل هي المسموحة الآن — فلا يُقفَز إلى «المدير» قبل «الرخصة»، ولا
 * يُرجَع إلى خطوةٍ رجوعُها يُفسد ما بعدها (§44).
 *
 * وكلُّ ما هنا دوالُّ خالصة تُختبر بلا خادم (‏`first-boot.state.test.ts`).
 */

// --------------------------------------------------
// الخطوات
// --------------------------------------------------

/**
 * الترتيبُ هو العقد. وثلاثةُ مواضعَ فيه تحتاج تعليلاً:
 *
 * • `NETWORK` قبل كلّ ما يُكتب في القاعدة — الخطواتُ التالية تحفظ،
 *   والحفظُ لا يقوم قبل أن يُعرف أين الخادم وهل يُبلَغ.
 *
 * • `ADMINISTRATOR` قبل `INSTITUTION`: أوّلُ ما يجب أن يوجد هو **مَن
 *   يملك هذا التركيب**. وهويةُ المؤسسة تُنسب إليه (`acceptedBy`
 *   وسجلّاتُ ما بعدُ)، فلو سبقته لكانت بيانات بلا صاحب.
 *
 * • `ACADEMIC_YEAR` بعد `INSTITUTION` — وهي الاستثناءُ الأكاديميّ
 *   الوحيد (§22): لا تبني التهيئةُ مؤسسةً، لكنّ نصفَ النظام يقرأ
 *   «السنةَ الجارية»، فبدونها يدخل المستخدمُ إلى شاشاتٍ تعتذر.
 */
export const FIRST_BOOT_STEPS = [
  "LANGUAGE",
  "REGION",
  "NETWORK",
  "DISPLAY",
  "PERFORMANCE",
  "TERMS",
  "UPDATE",
  "DEVICES",
  "ADMINISTRATOR",
  "INSTITUTION",
  "ACADEMIC_YEAR",
  "PRIVACY",
  "RECOVERY",
  "FINAL_VERIFICATION",
  "READY",
] as const;

export type FirstBootStep = (typeof FIRST_BOOT_STEPS)[number];

export const FIRST_BOOT_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
] as const;

export type FirstBootStatus = (typeof FIRST_BOOT_STATUSES)[number];

/**
 * نسخةُ التهيئة (§58).
 *
 * تُحفظ مع الحالة ليُعرف لاحقاً بأيّ تسلسلٍ رُكّبت هذه المؤسسة. ورفعُها
 * **لا يُعيد** التهيئةَ على من أتمّها — تركيبٌ قائمٌ يبقى قائماً؛ إنّما
 * يُعرَف منها ما ينقص إن احتاج إصدارٌ قادمٌ خطوةً جديدة.
 */
export const FIRST_BOOT_VERSION = "1.0";

/**
 * نسخةُ الشروط — تُحفظ مع الموافقة.
 *
 * ورفعُها يعني نصّاً جديداً يجب أن يُعرض من جديد: التحقّق النهائي
 * يقارن المحفوظَ بهذا الرقم، فموافقةٌ على نصٍّ قديمٍ لا تُحسب على
 * نصٍّ لم يُقرأ (§14).
 */
export const TERMS_VERSION = "1.0";

// --------------------------------------------------
// خصائصُ كلّ خطوة
// --------------------------------------------------

interface StepTraits {
  /**
   * هل يجوز الرجوعُ إليها بعد إتمامها؟
   *
   * والمعيارُ واحد: هل يترك الرجوعُ النظامَ متّسقاً؟ فالخطواتُ التي
   * تكتب تفضيلاً (لغة، عرض، أداء) تُعاد كتابتُها بلا أثر. وخطوةُ
   * المدير تُنشئ **مستخدماً وكلمةَ مرور**؛ الرجوعُ إليها يوحي بأنّ
   * الحساب سيُبدَّل وهو لن يُبدَّل، فمنعُه أصدقُ من السماح به.
   */
  reversible: boolean;
  /**
   * هل تُتمّها الواجهةُ بلا إرسال؟ لا — كلُّ خطوةٍ تُسجَّل في الخادم.
   * وهذا الحقل يميّز الخطواتِ التي **تكتب بياناتٍ حقيقية** عن التي
   * تُسجّل تفضيلاً، لأنّ الأولى وحدَها تحتاج معاملةً وفحصَ تَكرار.
   */
  writesData: boolean;
}

const TRAITS: Record<FirstBootStep, StepTraits> = {
  LANGUAGE: { reversible: true, writesData: false },
  REGION: { reversible: true, writesData: false },
  NETWORK: { reversible: true, writesData: false },
  DISPLAY: { reversible: true, writesData: false },
  PERFORMANCE: { reversible: true, writesData: false },
  TERMS: { reversible: true, writesData: false },
  UPDATE: { reversible: true, writesData: false },
  DEVICES: { reversible: true, writesData: false },
  /* حسابٌ أُنشئ لا يُلغى بزرّ رجوع */
  ADMINISTRATOR: { reversible: false, writesData: true },
  INSTITUTION: { reversible: true, writesData: true },
  ACADEMIC_YEAR: { reversible: true, writesData: true },
  PRIVACY: { reversible: true, writesData: false },
  RECOVERY: { reversible: true, writesData: false },
  FINAL_VERIFICATION: { reversible: true, writesData: false },
  /* «جاهز» شاشةُ تسليم: بعدها الإتمامُ لا الرجوع */
  READY: { reversible: false, writesData: false },
};

export const stepTraits = (step: FirstBootStep): StepTraits => TRAITS[step];

export const isFirstBootStep = (value: string): value is FirstBootStep =>
  (FIRST_BOOT_STEPS as readonly string[]).includes(value);

export const stepIndex = (step: FirstBootStep): number =>
  FIRST_BOOT_STEPS.indexOf(step);

export const FIRST_STEP: FirstBootStep = FIRST_BOOT_STEPS[0];
export const LAST_STEP: FirstBootStep =
  FIRST_BOOT_STEPS[FIRST_BOOT_STEPS.length - 1]!;

/** الخطوةُ التالية، أو `null` إن كانت هذه آخرَ خطوة */
export const nextStep = (step: FirstBootStep): FirstBootStep | null =>
  FIRST_BOOT_STEPS[stepIndex(step) + 1] ?? null;

export const previousStep = (step: FirstBootStep): FirstBootStep | null =>
  stepIndex(step) > 0 ? FIRST_BOOT_STEPS[stepIndex(step) - 1]! : null;

// --------------------------------------------------
// قرارُ القبول
// --------------------------------------------------

export interface MachineState {
  status: FirstBootStatus;
  current: FirstBootStep;
  /** ما أُتمّ فعلاً — لا ما مُرَّ عليه */
  done: FirstBootStep[];
}

export type SubmitDecision =
  | { allowed: true; /** هل هذه إعادةُ إرسالٍ لخطوةٍ متمّة؟ */ resubmit: boolean }
  | { allowed: false; reason: "COMPLETED" | "AHEAD" };

/**
 * هل يُقبل إرسالُ هذه الخطوة الآن؟
 *
 * ثلاثةُ أحكام:
 *   • التهيئةُ متمّةٌ ⇒ لا شيء يُقبل. الشاشةُ لا تُفتح بعد اليوم إلّا
 *     من «إعادة التهيئة» في الإعدادات، وهي تُصفّر الحالةَ أوّلاً (§59).
 *   • الخطوةُ بعد الحالية ⇒ رفض. القفزُ إلى الأمام هو بابُ تخطّي
 *     خطوةٍ إجبارية — ولا تخطّي (§63).
 *   • الخطوةُ الحاليةُ أو واحدةٌ متمّة ⇒ قبول، والثانيةُ **تصحيحٌ**
 *     لا تكرار: من رجع إلى «المنطقة» وبدّل التوقيت يُعيد الإرسال.
 */
export const canSubmit = (
  state: MachineState,
  step: FirstBootStep,
): SubmitDecision => {
  if (state.status === "COMPLETED") {
    return { allowed: false, reason: "COMPLETED" };
  }

  if (state.done.includes(step)) return { allowed: true, resubmit: true };

  if (stepIndex(step) > stepIndex(state.current)) {
    return { allowed: false, reason: "AHEAD" };
  }

  return { allowed: true, resubmit: false };
};

/**
 * الحالةُ بعد إتمام خطوة.
 *
 * والتقدّمُ لا يرجع: من أتمّ «المدير» ثمّ رجع فصحّح «المنطقة» لا تعود
 * حالتُه إلى «الشبكة». فالمؤشّرُ يمضي إلى أبعد خطوةٍ لم تُتمّ بعد —
 * وهذا هو معنى أنّ `done` هي الحقيقة و`current` مشتقّةٌ منها.
 */
export const advance = (
  state: MachineState,
  step: FirstBootStep,
): MachineState => {
  const done = state.done.includes(step) ? state.done : [...state.done, step];

  return {
    status: "IN_PROGRESS",
    current: resolveCurrent(done),
    done,
  };
};

/** أوّلُ خطوةٍ لم تُتمّ — وهي «أين المستخدم الآن» */
export const resolveCurrent = (done: FirstBootStep[]): FirstBootStep => {
  const pending = FIRST_BOOT_STEPS.find((step) => !done.includes(step));

  return pending ?? LAST_STEP;
};

/**
 * **الخطوةُ المعروضة — و`READY` منها لتركيبٍ مُتَمٍّ وحده.**
 *
 * `resolveCurrent` تُجيب عن «أين وصل التقدّم»، وهذه عن «ماذا يُعرض».
 * والفرقُ بينهما كان مصيدةً لا مخرجَ منها:
 *
 * `verifyService` تختم `FINAL_VERIFICATION` حين ينجح الفحص — وذلك
 * مقصود، فمن عالج النقصَ لا يبقى في حالةٍ تقول إنّه فشل. لكنّ ختمَها
 * يجعل `done` كاملةً، فتردّ `resolveCurrent` آخرَ الخطوات: `READY`.
 * والحالةُ يومَها لا تزال `IN_PROGRESS` — الإتمامُ لم يقع بعد، لأنّه
 * لا يقع إلّا بضغط زرِّ شاشة التحقّق.
 *
 * فمن نجح فحصُه ثمّ أغلق البرنامجَ قبل الضغط، وجد في كلّ إقلاعٍ بعده
 * شاشةَ «أنت جاهز» — لأنّ الخطوةَ `READY` — وزرُّها يُسلّم إلى التطبيق
 * ولا يُتمّ شيئاً. فشاشةُ التحقّق، وهي الوحيدةُ التي تنادي `/complete`،
 * لا تُعرض عليه أبداً. تركيبٌ عالقٌ يعيد شاشةَ التتويج إلى الأبد.
 *
 * والقيدُ هنا يقطعها: ما لم يُتمّ، فآخرُ ما يُعرض شاشةُ التحقّق — وهي
 * تُعيد الفحصَ وتملك الزرَّ الذي يُتمّ.
 */
export const displayStep = (
  status: MachineState["status"],
  done: FirstBootStep[],
): FirstBootStep => {
  if (status === "COMPLETED") return LAST_STEP;

  const current = resolveCurrent(done);

  return current === LAST_STEP ? "FINAL_VERIFICATION" : current;
};

export type BackDecision =
  | { allowed: true; target: FirstBootStep }
  | { allowed: false; reason: "NO_PREVIOUS" | "IRREVERSIBLE" | "COMPLETED" };

/**
 * الرجوعُ خطوةً واحدة من `from`.
 *
 * ويتخطّى الرجوعُ الخطواتِ غيرَ القابلة له بدل أن يقف عندها: من كان في
 * «المؤسسة» ورجع، فالمديرُ خلفَه وهو لا يُرجَع إليه — فيتجاوزه إلى
 * «الأجهزة». والوقوفُ كان سيعني زرَّ رجوعٍ لا يفعل شيئاً.
 */
export const canGoBack = (
  state: MachineState,
  from: FirstBootStep,
): BackDecision => {
  if (state.status === "COMPLETED") {
    return { allowed: false, reason: "COMPLETED" };
  }

  let candidate = previousStep(from);

  while (candidate && !stepTraits(candidate).reversible) {
    candidate = previousStep(candidate);
  }

  if (!candidate) return { allowed: false, reason: "IRREVERSIBLE" };

  return { allowed: true, target: candidate };
};

/**
 * تقدّمٌ معروض — «الخطوة 4 من 15» لا نسبةً مئوية (§43).
 *
 * والعدّ يقف عند `READY`: إظهارُ «15 من 15» على شاشةٍ لم يبقَ بعدها
 * شيء هو الصدقُ نفسُه — والنسبةُ المئوية هنا كانت ستكون تخميناً،
 * لأنّ الخطواتِ ليست متساويةَ الكلفة.
 */
export const progressOf = (step: FirstBootStep) => ({
  index: stepIndex(step) + 1,
  total: FIRST_BOOT_STEPS.length,
});
