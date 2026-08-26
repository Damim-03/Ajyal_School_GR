"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.progressOf = exports.canGoBack = exports.displayStep = exports.resolveCurrent = exports.advance = exports.canSubmit = exports.previousStep = exports.nextStep = exports.LAST_STEP = exports.FIRST_STEP = exports.stepIndex = exports.isFirstBootStep = exports.stepTraits = exports.TERMS_VERSION = exports.FIRST_BOOT_VERSION = exports.FIRST_BOOT_STATUSES = exports.FIRST_BOOT_STEPS = void 0;
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
exports.FIRST_BOOT_STEPS = [
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
];
exports.FIRST_BOOT_STATUSES = [
    "NOT_STARTED",
    "IN_PROGRESS",
    "COMPLETED",
    "FAILED",
];
/**
 * نسخةُ التهيئة (§58).
 *
 * تُحفظ مع الحالة ليُعرف لاحقاً بأيّ تسلسلٍ رُكّبت هذه المؤسسة. ورفعُها
 * **لا يُعيد** التهيئةَ على من أتمّها — تركيبٌ قائمٌ يبقى قائماً؛ إنّما
 * يُعرَف منها ما ينقص إن احتاج إصدارٌ قادمٌ خطوةً جديدة.
 */
exports.FIRST_BOOT_VERSION = "1.0";
/**
 * نسخةُ الشروط — تُحفظ مع الموافقة.
 *
 * ورفعُها يعني نصّاً جديداً يجب أن يُعرض من جديد: التحقّق النهائي
 * يقارن المحفوظَ بهذا الرقم، فموافقةٌ على نصٍّ قديمٍ لا تُحسب على
 * نصٍّ لم يُقرأ (§14).
 */
exports.TERMS_VERSION = "1.0";
const TRAITS = {
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
const stepTraits = (step) => TRAITS[step];
exports.stepTraits = stepTraits;
const isFirstBootStep = (value) => exports.FIRST_BOOT_STEPS.includes(value);
exports.isFirstBootStep = isFirstBootStep;
const stepIndex = (step) => exports.FIRST_BOOT_STEPS.indexOf(step);
exports.stepIndex = stepIndex;
exports.FIRST_STEP = exports.FIRST_BOOT_STEPS[0];
exports.LAST_STEP = exports.FIRST_BOOT_STEPS[exports.FIRST_BOOT_STEPS.length - 1];
/** الخطوةُ التالية، أو `null` إن كانت هذه آخرَ خطوة */
const nextStep = (step) => exports.FIRST_BOOT_STEPS[(0, exports.stepIndex)(step) + 1] ?? null;
exports.nextStep = nextStep;
const previousStep = (step) => (0, exports.stepIndex)(step) > 0 ? exports.FIRST_BOOT_STEPS[(0, exports.stepIndex)(step) - 1] : null;
exports.previousStep = previousStep;
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
const canSubmit = (state, step) => {
    if (state.status === "COMPLETED") {
        return { allowed: false, reason: "COMPLETED" };
    }
    if (state.done.includes(step))
        return { allowed: true, resubmit: true };
    if ((0, exports.stepIndex)(step) > (0, exports.stepIndex)(state.current)) {
        return { allowed: false, reason: "AHEAD" };
    }
    return { allowed: true, resubmit: false };
};
exports.canSubmit = canSubmit;
/**
 * الحالةُ بعد إتمام خطوة.
 *
 * والتقدّمُ لا يرجع: من أتمّ «المدير» ثمّ رجع فصحّح «المنطقة» لا تعود
 * حالتُه إلى «الشبكة». فالمؤشّرُ يمضي إلى أبعد خطوةٍ لم تُتمّ بعد —
 * وهذا هو معنى أنّ `done` هي الحقيقة و`current` مشتقّةٌ منها.
 */
const advance = (state, step) => {
    const done = state.done.includes(step) ? state.done : [...state.done, step];
    return {
        status: "IN_PROGRESS",
        current: (0, exports.resolveCurrent)(done),
        done,
    };
};
exports.advance = advance;
/** أوّلُ خطوةٍ لم تُتمّ — وهي «أين المستخدم الآن» */
const resolveCurrent = (done) => {
    const pending = exports.FIRST_BOOT_STEPS.find((step) => !done.includes(step));
    return pending ?? exports.LAST_STEP;
};
exports.resolveCurrent = resolveCurrent;
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
const displayStep = (status, done) => {
    if (status === "COMPLETED")
        return exports.LAST_STEP;
    const current = (0, exports.resolveCurrent)(done);
    return current === exports.LAST_STEP ? "FINAL_VERIFICATION" : current;
};
exports.displayStep = displayStep;
/**
 * الرجوعُ خطوةً واحدة من `from`.
 *
 * ويتخطّى الرجوعُ الخطواتِ غيرَ القابلة له بدل أن يقف عندها: من كان في
 * «المؤسسة» ورجع، فالمديرُ خلفَه وهو لا يُرجَع إليه — فيتجاوزه إلى
 * «الأجهزة». والوقوفُ كان سيعني زرَّ رجوعٍ لا يفعل شيئاً.
 */
const canGoBack = (state, from) => {
    if (state.status === "COMPLETED") {
        return { allowed: false, reason: "COMPLETED" };
    }
    let candidate = (0, exports.previousStep)(from);
    while (candidate && !(0, exports.stepTraits)(candidate).reversible) {
        candidate = (0, exports.previousStep)(candidate);
    }
    if (!candidate)
        return { allowed: false, reason: "IRREVERSIBLE" };
    return { allowed: true, target: candidate };
};
exports.canGoBack = canGoBack;
/**
 * تقدّمٌ معروض — «الخطوة 4 من 15» لا نسبةً مئوية (§43).
 *
 * والعدّ يقف عند `READY`: إظهارُ «15 من 15» على شاشةٍ لم يبقَ بعدها
 * شيء هو الصدقُ نفسُه — والنسبةُ المئوية هنا كانت ستكون تخميناً،
 * لأنّ الخطواتِ ليست متساويةَ الكلفة.
 */
const progressOf = (step) => ({
    index: (0, exports.stepIndex)(step) + 1,
    total: exports.FIRST_BOOT_STEPS.length,
});
exports.progressOf = progressOf;
//# sourceMappingURL=first-boot.state.js.map