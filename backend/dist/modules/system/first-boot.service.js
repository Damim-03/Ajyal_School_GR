"use strict";
/**
 * التهيئةُ الأولى — الخدمة.
 *
 * ثلاثةُ مبادئَ تحكم كلَّ دالّةٍ هنا:
 *
 * **1. الخادمُ يملك الحالة.** لا `localStorage` ولا حالةٌ في الذاكرة:
 * جهازٌ يُغلَق في منتصف «الأجهزة» يعود إليها، وجهازٌ ثانٍ يُفتح على
 * القاعدة نفسِها يجد التهيئةَ حيث تركها الأوّل (§4).
 *
 * **2. كلُّ خطوةٍ ذرّية.** تُكتب البياناتُ وتُعلَّم الخطوةُ متمّةً في
 * معاملةٍ واحدة. فإن سقط الخادمُ بينهما لم يبقَ نصفُ عمل: إمّا وقع
 * الأمران أو لم يقع أيٌّ منهما (§26/§28).
 *
 * **3. الإعادةُ لا تُكرّر.** يُعاد إرسالُ خطوةٍ بعد انقطاعٍ فلا تُنشأ
 * سنةٌ ثانية ولا مديرٌ ثانٍ (§27/§57).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dismissOnboardingService = exports.institutionProgressService = exports.probeService = exports.resetFirstBootService = exports.completeService = exports.verifyService = exports.goBackService = exports.setAcademicYearService = exports.setInstitutionService = exports.createAdministratorService = exports.setRecoveryService = exports.setPrivacyService = exports.setDevicesService = exports.setUpdateService = exports.setTermsService = exports.setPerformanceService = exports.setDisplayService = exports.setNetworkService = exports.setRegionService = exports.setLanguageService = exports.getStatusService = exports.assertSetupOpen = exports.isInitialized = exports.loadState = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("../../core/prisma/client");
const provision_1 = require("../../core/rbac/provision");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const first_boot_keys_1 = require("./first-boot.keys");
const first_boot_state_1 = require("./first-boot.state");
const first_boot_verify_1 = require("./first-boot.verify");
const readMany = async (keys) => {
    const rows = await client_1.prisma.setting.findMany({
        where: { key: { in: keys } },
        select: { key: true, value: true },
    });
    return new Map(rows.map((row) => [row.key, row.value]));
};
/** كتابةُ دفعةٍ داخل معاملةٍ قائمة — لا تفتح واحدةً من عندها */
const writeMany = async (tx, values) => {
    for (const [key, value] of Object.entries(values)) {
        await tx.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
    }
};
// ======================================================
// الحالة
// ======================================================
const parseDone = (raw) => {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        /*
         * التصفيةُ ليست حذراً زائداً: خطوةٌ حُذفت من الشيفرة في إصدارٍ
         * لاحق تبقى مكتوبةً في قاعدةِ مؤسسةٍ قديمة، و`stepIndex` لها
         * يعود ‎-1‏ فتنكسر المقارناتُ كلُّها بصمت.
         */
        return parsed.filter((value) => typeof value === "string" && (0, first_boot_state_1.isFirstBootStep)(value));
    }
    catch {
        return [];
    }
};
const STATE_KEYS = [
    first_boot_keys_1.SYSTEM_KEYS.status,
    first_boot_keys_1.SYSTEM_KEYS.step,
    first_boot_keys_1.SYSTEM_KEYS.done,
    first_boot_keys_1.SYSTEM_KEYS.version,
    first_boot_keys_1.SYSTEM_KEYS.startedAt,
    first_boot_keys_1.SYSTEM_KEYS.completedAt,
    first_boot_keys_1.SYSTEM_KEYS.adopted,
];
const isStatus = (value) => ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "FAILED"].includes(value);
/**
 * تركيبٌ سابقٌ للتهيئة — يُعترف به مرّةً ويُختم (§58).
 *
 * والسؤالُ الذي يُجاب هنا: «هل هذه قاعدةٌ فارغةٌ أم مؤسسةٌ تعمل؟».
 * والجوابُ من الواقع لا من علَم: مديرٌ نشطٌ **وسنةٌ جارية** يعنيان
 * أنّ أحداً ركّب هذا النظامَ قبل وجود هذه الشاشات — وحملُه على
 * المرور بها اليوم يقفل تطبيقاً يعمل ويطلب منه إنشاءَ مديرٍ يملكه
 * أصلاً.
 *
 * والشرطان معاً لا أحدُهما: سكربتُ البذر يُنشئ مديراً في قاعدةٍ
 * فارغة، فلو اكتُفي به لظُنَّ كلُّ تركيبٍ جديدٍ مؤسسةً قائمة.
 */
const detectAdoptable = async () => {
    const [admins, currentYears] = await Promise.all([
        client_1.prisma.user.count({
            where: { isActive: true, role: { name: provision_1.ADMIN_ROLE } },
        }),
        client_1.prisma.academicYear.count({ where: { isCurrent: true } }),
    ]);
    return admins >= 1 && currentYears >= 1;
};
const adopt = async () => {
    const now = new Date().toISOString();
    await client_1.prisma.$transaction(async (tx) => {
        await writeMany(tx, {
            [first_boot_keys_1.SYSTEM_KEYS.status]: "COMPLETED",
            [first_boot_keys_1.SYSTEM_KEYS.step]: "READY",
            [first_boot_keys_1.SYSTEM_KEYS.done]: JSON.stringify(first_boot_state_1.FIRST_BOOT_STEPS),
            [first_boot_keys_1.SYSTEM_KEYS.version]: first_boot_state_1.FIRST_BOOT_VERSION,
            [first_boot_keys_1.SYSTEM_KEYS.startedAt]: now,
            [first_boot_keys_1.SYSTEM_KEYS.completedAt]: now,
            [first_boot_keys_1.SYSTEM_KEYS.adopted]: "true",
        });
        /*
         * تفضيلاتٌ لم تُسأل لأنّ الشاشاتِ لم تكن موجودة — تُملأ بما كان
         * التطبيقُ يسلكه فعلاً قبلها: عربيّةٌ وتوقيتُ الجزائر وشكلُ
         * تاريخٍ يوم/شهر/سنة، وهي التي كانت مكتوبةً في الشيفرة.
         */
        const defaults = {
            [first_boot_keys_1.SYSTEM_KEYS.language]: "ar",
            [first_boot_keys_1.SYSTEM_KEYS.country]: "DZ",
            [first_boot_keys_1.SYSTEM_KEYS.timezone]: "Africa/Algiers",
            [first_boot_keys_1.SYSTEM_KEYS.dateFormat]: "DD/MM/YYYY",
            [first_boot_keys_1.SYSTEM_KEYS.networkMode]: "LOCAL",
            [first_boot_keys_1.SYSTEM_KEYS.uiScale]: "DEFAULT",
            [first_boot_keys_1.SYSTEM_KEYS.density]: "COMFORTABLE",
            [first_boot_keys_1.SYSTEM_KEYS.windowMode]: "MAXIMIZED",
            [first_boot_keys_1.SYSTEM_KEYS.performance]: "BALANCED",
            [first_boot_keys_1.SYSTEM_KEYS.termsVersion]: first_boot_state_1.TERMS_VERSION,
            [first_boot_keys_1.SYSTEM_KEYS.termsAcceptedAt]: now,
            /*
             * **لا يدّعي موافقةً لم تقع.** «ADOPTED» تقول للسجلّ: هذا
             * تركيبٌ سبق وجودَ شاشة الشروط. ولو كُتب اسمُ مستخدمٍ هنا
             * لصار السجلُّ يشهد بما لم يحدث.
             */
            [first_boot_keys_1.SYSTEM_KEYS.termsAcceptedBy]: "ADOPTED",
            [first_boot_keys_1.SYSTEM_KEYS.updateChannel]: "NONE",
            [first_boot_keys_1.SYSTEM_KEYS.devices]: JSON.stringify([]),
            [first_boot_keys_1.SYSTEM_KEYS.diagnostics]: "false",
        };
        const existing = await tx.setting.findMany({
            where: { key: { in: Object.keys(defaults) } },
            select: { key: true },
        });
        const known = new Set(existing.map((row) => row.key));
        /* ما ضُبط فعلاً لا يُدهَس: الاعترافُ يملأ الفراغَ لا يُعيد الكتابة */
        await writeMany(tx, Object.fromEntries(Object.entries(defaults).filter(([key]) => !known.has(key))));
    });
};
/**
 * الحالةُ الحاليةُ — ونقطةُ الدخول الوحيدة إليها.
 *
 * وتكتب أحياناً وهي تُقرأ: أوّلُ نداءٍ على تركيبٍ قائمٍ يختمه
 * «معترَفاً به». وذلك مرّةً واحدةً في عمر القاعدة، وبعدها قراءةٌ
 * محضة.
 */
const loadState = async () => {
    let stored = await readMany(STATE_KEYS);
    if (!stored.has(first_boot_keys_1.SYSTEM_KEYS.status)) {
        if (await detectAdoptable()) {
            await adopt();
            stored = await readMany(STATE_KEYS);
        }
    }
    const rawStatus = stored.get(first_boot_keys_1.SYSTEM_KEYS.status) ?? "NOT_STARTED";
    const status = isStatus(rawStatus) ? rawStatus : "NOT_STARTED";
    const done = parseDone(stored.get(first_boot_keys_1.SYSTEM_KEYS.done));
    /*
     * `current` تُشتقّ من `done` ولا تُقرأ من مفتاحها.
     *
     * والمفتاحُ يُكتب مع ذلك — يقرؤه مَن ينظر في القاعدة بعينه. لكنّ
     * الاشتقاقَ هو الحَكَم: لو تعارضا (كتابةٌ ناقصةٌ بعد انقطاع) فالمصدرُ
     * ما تمّ فعلاً، لا مؤشّرٌ قد يشير إلى خطوةٍ لم تُتمّ ما قبلَها.
     *
     * و`displayStep` لا `resolveCurrent`: الثانيةُ تقول أين وصل التقدّم،
     * والأولى ماذا يُعرض — وهي تمنع `READY` عن تركيبٍ لم يُتمّ. انظر
     * تعليلَها في `first-boot.state.ts`.
     */
    const current = (0, first_boot_state_1.displayStep)(status, done);
    return {
        status,
        current,
        done,
        version: stored.get(first_boot_keys_1.SYSTEM_KEYS.version) ?? first_boot_state_1.FIRST_BOOT_VERSION,
        startedAt: stored.get(first_boot_keys_1.SYSTEM_KEYS.startedAt) ?? null,
        completedAt: stored.get(first_boot_keys_1.SYSTEM_KEYS.completedAt) ?? null,
        adopted: stored.get(first_boot_keys_1.SYSTEM_KEYS.adopted) === "true",
        progress: (0, first_boot_state_1.progressOf)(current),
    };
};
exports.loadState = loadState;
/** هل النظامُ مهيَّأ؟ يقرؤها حارسُ المسارات (§62) */
const isInitialized = async () => (await (0, exports.loadState)()).status === "COMPLETED";
exports.isInitialized = isInitialized;
/**
 * حارسُ ما يُفتح أثناء التهيئة وحدها — كرفع الشعار.
 *
 * فذلك المسارُ يكتب ملفّاً على القرص بلا مصادقة، وهو مقبولٌ ما دامت
 * النافذةُ مفتوحةً (لا حسابَ بعدُ ليُصادَق به). ومتى أُغلقت صار رفعُ
 * الصور من مسارِه المحميّ لا من هنا.
 */
const assertSetupOpen = async () => {
    const state = await (0, exports.loadState)();
    if (state.status === "COMPLETED") {
        throw new app_errors_1.ConflictException("التهيئةُ الأولى مكتملة", error_code_enum_1.ErrorCodeEnum.SETUP_ALREADY_COMPLETED);
    }
};
exports.assertSetupOpen = assertSetupOpen;
// ======================================================
// الحالةُ المعروضة — الحالة + ما حُفظ من إجابات
// ======================================================
const ANSWER_KEYS = [
    first_boot_keys_1.SYSTEM_KEYS.language,
    first_boot_keys_1.SYSTEM_KEYS.country,
    first_boot_keys_1.SYSTEM_KEYS.timezone,
    first_boot_keys_1.SYSTEM_KEYS.dateFormat,
    first_boot_keys_1.SYSTEM_KEYS.networkMode,
    first_boot_keys_1.SYSTEM_KEYS.uiScale,
    first_boot_keys_1.SYSTEM_KEYS.density,
    first_boot_keys_1.SYSTEM_KEYS.windowMode,
    first_boot_keys_1.SYSTEM_KEYS.performance,
    first_boot_keys_1.SYSTEM_KEYS.termsVersion,
    first_boot_keys_1.SYSTEM_KEYS.termsAcceptedAt,
    first_boot_keys_1.SYSTEM_KEYS.updateChannel,
    first_boot_keys_1.SYSTEM_KEYS.appVersion,
    first_boot_keys_1.SYSTEM_KEYS.devices,
    first_boot_keys_1.SYSTEM_KEYS.diagnostics,
    first_boot_keys_1.SYSTEM_KEYS.recoveryPhone,
];
/**
 * ما أجاب به المستخدمُ سابقاً — لتعود الشاشةُ كما تركها لا فارغة.
 *
 * ولا كلمةَ مرورٍ ولا شيءَ منها هنا: ما يُكتب في خطوة المدير يذهب
 * إلى جدول المستخدمين مُعمَّى ولا يعود (§38).
 */
const getStatusService = async () => {
    const [state, answers] = await Promise.all([(0, exports.loadState)(), readMany(ANSWER_KEYS)]);
    const school = await readMany([
        "school.name_ar",
        "school.name_en",
        "school.short_name",
        "school.phone",
        "school.email",
        "school.address",
        "school.logo_path",
    ]);
    const currentYear = await client_1.prisma.academicYear.findFirst({
        where: { isCurrent: true },
        select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            sessionsPerMonth: true,
        },
    });
    return {
        ...state,
        steps: first_boot_state_1.FIRST_BOOT_STEPS,
        termsVersion: first_boot_state_1.TERMS_VERSION,
        answers: {
            language: answers.get(first_boot_keys_1.SYSTEM_KEYS.language) ?? "",
            country: answers.get(first_boot_keys_1.SYSTEM_KEYS.country) ?? "",
            timezone: answers.get(first_boot_keys_1.SYSTEM_KEYS.timezone) ?? "",
            dateFormat: answers.get(first_boot_keys_1.SYSTEM_KEYS.dateFormat) ?? "",
            networkMode: answers.get(first_boot_keys_1.SYSTEM_KEYS.networkMode) ?? "",
            uiScale: answers.get(first_boot_keys_1.SYSTEM_KEYS.uiScale) ?? "",
            density: answers.get(first_boot_keys_1.SYSTEM_KEYS.density) ?? "",
            windowMode: answers.get(first_boot_keys_1.SYSTEM_KEYS.windowMode) ?? "",
            performance: answers.get(first_boot_keys_1.SYSTEM_KEYS.performance) ?? "",
            termsVersion: answers.get(first_boot_keys_1.SYSTEM_KEYS.termsVersion) ?? "",
            termsAcceptedAt: answers.get(first_boot_keys_1.SYSTEM_KEYS.termsAcceptedAt) ?? "",
            updateChannel: answers.get(first_boot_keys_1.SYSTEM_KEYS.updateChannel) ?? "",
            appVersion: answers.get(first_boot_keys_1.SYSTEM_KEYS.appVersion) ?? "",
            diagnostics: answers.get(first_boot_keys_1.SYSTEM_KEYS.diagnostics) === "true",
            recoveryPhone: answers.get(first_boot_keys_1.SYSTEM_KEYS.recoveryPhone) ?? "",
            institution: {
                name: school.get("school.name_ar") ?? "",
                nameEn: school.get("school.name_en") ?? "",
                shortName: school.get("school.short_name") ?? "",
                phone: school.get("school.phone") ?? "",
                email: school.get("school.email") ?? "",
                address: school.get("school.address") ?? "",
                logoPath: school.get("school.logo_path") ?? "",
            },
            academicYear: currentYear,
        },
    };
};
exports.getStatusService = getStatusService;
// ======================================================
// تسجيلُ خطوة
// ======================================================
/**
 * الحارسُ الذي يمرّ به كلُّ إرسال.
 *
 * ويُقرأ الحالُ من القاعدة في كلّ مرّة لا يُخزَّن: نافذتان مفتوحتان
 * على التركيب نفسِه (وقد يقع) لا تعملان على نسختين من الحقيقة.
 */
const guardStep = async (step) => {
    const state = await (0, exports.loadState)();
    const decision = (0, first_boot_state_1.canSubmit)(state, step);
    if (!decision.allowed) {
        if (decision.reason === "COMPLETED") {
            throw new app_errors_1.ConflictException("التهيئةُ الأولى مكتملة — لا تُعاد إلّا من إعادة التهيئة", error_code_enum_1.ErrorCodeEnum.SETUP_ALREADY_COMPLETED);
        }
        throw new app_errors_1.BadRequestException(`لا يمكن تنفيذ «${step}» قبل «${state.current}»`, error_code_enum_1.ErrorCodeEnum.SETUP_STEP_OUT_OF_ORDER);
    }
    return { state, resubmit: decision.resubmit };
};
/**
 * كتابةُ الإجابة وعلامةِ الإتمام **معاً**.
 *
 * وهذا هو §28 حرفياً: لو كُتبت الإجابةُ ثمّ سقط الخادمُ قبل العلامة،
 * لعاد المستخدمُ إلى الشاشة نفسِها — وذلك مقبول. أمّا العكسُ — علامةٌ
 * بلا إجابة — فيعني خطوةً «متمّةً» بلا أثرٍ في القاعدة، وهي التي
 * يسقط عندها التحقّقُ النهائيُّ بلا سببٍ مفهوم.
 */
const commitStep = async (step, values, extra) => {
    const { state } = await guardStep(step);
    const nextState = (0, first_boot_state_1.advance)(state, step);
    const now = new Date().toISOString();
    await client_1.prisma.$transaction(async (tx) => {
        if (extra)
            await extra(tx);
        await writeMany(tx, {
            ...values,
            [first_boot_keys_1.SYSTEM_KEYS.status]: "IN_PROGRESS",
            [first_boot_keys_1.SYSTEM_KEYS.step]: nextState.current,
            [first_boot_keys_1.SYSTEM_KEYS.done]: JSON.stringify(nextState.done),
            [first_boot_keys_1.SYSTEM_KEYS.version]: first_boot_state_1.FIRST_BOOT_VERSION,
            ...(state.startedAt ? {} : { [first_boot_keys_1.SYSTEM_KEYS.startedAt]: now }),
        });
    });
    return (0, exports.loadState)();
};
// ------------------------------------------------------
// الخطواتُ التي تكتب تفضيلاً
// ------------------------------------------------------
const setLanguageService = (body) => commitStep("LANGUAGE", { [first_boot_keys_1.SYSTEM_KEYS.language]: body.language });
exports.setLanguageService = setLanguageService;
const setRegionService = (body) => commitStep("REGION", {
    [first_boot_keys_1.SYSTEM_KEYS.country]: body.country,
    [first_boot_keys_1.SYSTEM_KEYS.timezone]: body.timezone,
    [first_boot_keys_1.SYSTEM_KEYS.dateFormat]: body.dateFormat,
});
exports.setRegionService = setRegionService;
const setNetworkService = (body) => commitStep("NETWORK", { [first_boot_keys_1.SYSTEM_KEYS.networkMode]: body.mode });
exports.setNetworkService = setNetworkService;
const setDisplayService = (body) => commitStep("DISPLAY", {
    [first_boot_keys_1.SYSTEM_KEYS.uiScale]: body.uiScale,
    [first_boot_keys_1.SYSTEM_KEYS.density]: body.density,
    [first_boot_keys_1.SYSTEM_KEYS.windowMode]: body.windowMode,
});
exports.setDisplayService = setDisplayService;
const setPerformanceService = (body) => commitStep("PERFORMANCE", { [first_boot_keys_1.SYSTEM_KEYS.performance]: body.profile });
exports.setPerformanceService = setPerformanceService;
const setTermsService = (body) => {
    /*
     * نسخةُ الواجهة تُقارَن بنسخة الخادم: نافذةٌ بقيت مفتوحةً عبر تحديثٍ
     * غيَّر النصَّ كانت ستُرسل موافقةً على ما لم يُعرض.
     */
    if (body.version !== first_boot_state_1.TERMS_VERSION) {
        throw new app_errors_1.ConflictException(`نسخةُ الشروط تغيّرت (${body.version} ← ${first_boot_state_1.TERMS_VERSION}) — أعِد قراءتها`, error_code_enum_1.ErrorCodeEnum.SETUP_STEP_OUT_OF_ORDER);
    }
    return commitStep("TERMS", {
        [first_boot_keys_1.SYSTEM_KEYS.termsVersion]: first_boot_state_1.TERMS_VERSION,
        [first_boot_keys_1.SYSTEM_KEYS.termsAcceptedAt]: new Date().toISOString(),
        /*
         * ولا مستخدمَ بعدُ حين تُقبل الشروط — خطوةُ المدير بعدها. فيُسجَّل
         * «SETUP» ثمّ يُنسب إلى المدير حين يُنشأ، فلا يبقى السجلُّ بلا صاحب.
         */
        [first_boot_keys_1.SYSTEM_KEYS.termsAcceptedBy]: "SETUP",
    });
};
exports.setTermsService = setTermsService;
const setUpdateService = (body) => commitStep("UPDATE", {
    [first_boot_keys_1.SYSTEM_KEYS.appVersion]: body.appVersion,
    [first_boot_keys_1.SYSTEM_KEYS.updateChannel]: body.channel,
    [first_boot_keys_1.SYSTEM_KEYS.updateCheckedAt]: new Date().toISOString(),
});
exports.setUpdateService = setUpdateService;
const setDevicesService = (body) => {
    /*
     * جهازٌ مطلوبٌ ولم يُكتشف يوقف الخطوة (§37).
     *
     * ولوحةُ المفاتيح وحدها كذلك اليوم — وقيمةُ الفحص أنّه **لا يقرأ
     * قائمةً ثابتة**: إن صار في تركيبٍ ما طابعةٌ حرارية «مطلوبة»
     * بحسب إعداد المؤسسة، مرّت في هذا الشرط نفسِه بلا شيفرةٍ جديدة.
     */
    const missing = body.devices.filter((device) => device.requirement === "REQUIRED" && !device.detected);
    if (missing.length > 0) {
        throw new app_errors_1.BadRequestException(`أجهزةٌ مطلوبةٌ غيرُ متوفّرة: ${missing.map((d) => d.kind).join(", ")}`, error_code_enum_1.ErrorCodeEnum.SETUP_DEVICE_MISSING);
    }
    return commitStep("DEVICES", {
        [first_boot_keys_1.SYSTEM_KEYS.devices]: JSON.stringify(body.devices),
    });
};
exports.setDevicesService = setDevicesService;
const setPrivacyService = (body) => commitStep("PRIVACY", {
    [first_boot_keys_1.SYSTEM_KEYS.diagnostics]: body.diagnostics ? "true" : "false",
});
exports.setPrivacyService = setPrivacyService;
const setRecoveryService = (body) => commitStep("RECOVERY", { [first_boot_keys_1.SYSTEM_KEYS.recoveryPhone]: body.phone });
exports.setRecoveryService = setRecoveryService;
// ------------------------------------------------------
// المدير — الخطوةُ التي تُنشئ حساباً
// ------------------------------------------------------
/**
 * إنشاءُ مدير التركيب.
 *
 * وحرسُها ثلاثة:
 *
 * **مرّةً واحدة.** إن كانت الخطوةُ متمّةً فالإعادةُ لا تُنشئ شيئاً —
 * تُعيد الحالةَ كما هي. وهذا يقطع طريقَ إنشاءِ حساباتٍ بلا حدٍّ عبر
 * مسارٍ مفتوحٍ قبل الإتمام (§38).
 *
 * **واسمٌ موجودٌ لا يُكرَّر.** إن وُجد مستخدمٌ بالاسم نفسِه والخطوةُ
 * غيرُ متمّة، فتلك حالةُ §27 بعينها: أُنشئ الحسابُ ثمّ سقط الخادمُ قبل
 * العلامة. فتُختم الخطوةُ ولا يُنشأ ثانٍ ولا تُدهَس كلمةُ مرورٍ قائمة.
 *
 * **والدورُ قبل المستخدم.** `provisionRbac` تركّب الصلاحياتِ والأدوارَ
 * أوّلاً — مديرٌ بدورٍ بلا صلاحياتٍ يدخل إلى تطبيقٍ كلُّ أزراره مقفلة.
 */
const createAdministratorService = async (body) => {
    const { state, resubmit } = await guardStep("ADMINISTRATOR");
    if (resubmit)
        return (0, exports.loadState)();
    const adminRoleId = await (0, provision_1.provisionRbac)();
    const existing = await client_1.prisma.user.findUnique({
        where: { username: body.username },
        select: { id: true, roleId: true },
    });
    const nextState = (0, first_boot_state_1.advance)(state, "ADMINISTRATOR");
    const passwordHash = existing ? null : await bcryptjs_1.default.hash(body.password, 12);
    await client_1.prisma.$transaction(async (tx) => {
        let userId = existing?.id ?? "";
        if (!existing) {
            const created = await tx.user.create({
                data: {
                    username: body.username,
                    firstName: body.firstName,
                    lastName: body.lastName,
                    email: body.email ? body.email : null,
                    password: passwordHash,
                    roleId: adminRoleId,
                    isActive: true,
                },
                select: { id: true },
            });
            userId = created.id;
        }
        await writeMany(tx, {
            /* الموافقةُ على الشروط تُنسب الآن إلى صاحبها (§14) */
            [first_boot_keys_1.SYSTEM_KEYS.termsAcceptedBy]: userId,
            [first_boot_keys_1.SYSTEM_KEYS.status]: "IN_PROGRESS",
            [first_boot_keys_1.SYSTEM_KEYS.step]: nextState.current,
            [first_boot_keys_1.SYSTEM_KEYS.done]: JSON.stringify(nextState.done),
        });
    });
    return (0, exports.loadState)();
};
exports.createAdministratorService = createAdministratorService;
// ------------------------------------------------------
// هوية المؤسسة
// ------------------------------------------------------
/**
 * تُكتب في مفاتيح `school.*` نفسِها لا في مفاتيحَ موازية.
 *
 * فالترويسةُ والإيصالاتُ وشاشةُ الإقلاع تقرأ من هناك منذ اليوم الأوّل،
 * ومفتاحٌ ثانٍ كان سيعني نسخاً بينهما — أي اسمين للمؤسسة يفترقان عند
 * أوّل تعديلٍ من شاشة الإعدادات.
 */
const setInstitutionService = (body) => {
    const values = { "school.name_ar": body.name };
    const optional = [
        ["school.name_en", body.nameEn],
        ["school.short_name", body.shortName],
        ["school.phone", body.phone],
        ["school.email", body.email],
        ["school.address", body.address],
        ["school.logo_path", body.logoPath],
    ];
    for (const [key, value] of optional) {
        if (value !== undefined && value !== "")
            values[key] = value;
    }
    /*
     * والاسمُ المختصرُ يُشتقّ إن تُرك: الترويسةُ وشاشةُ الإقلاع تعرضانه
     * بحجمٍ كبير، وفراغُه كان يُظهر «مركز أجيال التعليمي» الافتراضيَّ
     * فوق اسمِ مؤسسةٍ أخرى.
     */
    if (!values["school.short_name"]) {
        values["school.short_name"] = body.name.split(/\s+/).slice(0, 2).join(" ");
    }
    return commitStep("INSTITUTION", values);
};
exports.setInstitutionService = setInstitutionService;
// ------------------------------------------------------
// السنة الدراسية
// ------------------------------------------------------
/**
 * السنةُ الجاريةُ — تُنشأ أو تُحدَّث، ولا تُكرَّر (§57).
 *
 * والمطابقةُ بالاسم لأنّه فريدٌ في المخطّط: إعادةُ إرسال «2026/2027»
 * تُحدّث الصفَّ نفسَه. وعَلَمُ «الجارية» يُنزع عمّا سواها في المعاملة
 * نفسِها — سنتان جاريتان أسوأُ من لا سنة (‏انظر `first-boot.verify`).
 */
const setAcademicYearService = (body) => {
    const values = {};
    return commitStep("ACADEMIC_YEAR", values, async (tx) => {
        const existing = await tx.academicYear.findUnique({
            where: { name: body.name },
            select: { id: true },
        });
        await tx.academicYear.updateMany({
            where: { isCurrent: true, ...(existing ? { NOT: { id: existing.id } } : {}) },
            data: { isCurrent: false },
        });
        if (existing) {
            await tx.academicYear.update({
                where: { id: existing.id },
                data: {
                    startDate: body.startDate,
                    endDate: body.endDate,
                    sessionsPerMonth: body.sessionsPerMonth,
                    isCurrent: true,
                    isActive: true,
                },
            });
            return;
        }
        await tx.academicYear.create({
            data: {
                name: body.name,
                startDate: body.startDate,
                endDate: body.endDate,
                sessionsPerMonth: body.sessionsPerMonth,
                isCurrent: true,
                isActive: true,
            },
        });
    });
};
exports.setAcademicYearService = setAcademicYearService;
// ======================================================
// الرجوع
// ======================================================
const goBackService = async (from) => {
    const state = await (0, exports.loadState)();
    const decision = (0, first_boot_state_1.canGoBack)(state, from);
    if (!decision.allowed) {
        throw new app_errors_1.BadRequestException("لا رجوعَ من هنا", error_code_enum_1.ErrorCodeEnum.SETUP_STEP_OUT_OF_ORDER);
    }
    /*
     * الرجوعُ يمحو علامةَ الإتمام عن الوجهة — وإلّا صارت الشاشةُ
     * «متمّةً» وهي معروضةٌ للتعديل، فيقفز المؤشّرُ إلى الأمام بمجرّد
     * إعادة قراءة الحالة ويُقذف المستخدمُ من الشاشة التي طلبها.
     *
     * وما بعدها يبقى متمّاً: من رجع ليصحّح المنطقةَ لا يُطالَب بإعادة
     * كلّ ما بعدها.
     */
    const done = state.done.filter((step) => step !== decision.target);
    await client_1.prisma.$transaction(async (tx) => {
        await writeMany(tx, {
            [first_boot_keys_1.SYSTEM_KEYS.done]: JSON.stringify(done),
            [first_boot_keys_1.SYSTEM_KEYS.step]: decision.target,
            [first_boot_keys_1.SYSTEM_KEYS.status]: "IN_PROGRESS",
        });
    });
    return { ...(await (0, exports.loadState)()), current: decision.target };
};
exports.goBackService = goBackService;
// ======================================================
// التحقّق النهائي
// ======================================================
/** استعلامٌ لا يلمس جدولاً — يقيس الاتصالَ وحده */
const pingDatabase = async () => {
    try {
        await client_1.prisma.$queryRawUnsafe("SELECT 1");
        return true;
    }
    catch {
        return false;
    }
};
/**
 * هل الجداولُ التي يقوم عليها النظام موجودةٌ ومقروءة؟
 *
 * والعدُّ لا قراءةُ `information_schema`: العدُّ يمرّ بالمخطَّط الذي
 * يولّده Prisma فعلاً، فيكشف عمودَاً ناقصاً بعد ترحيلٍ لم يُطبَّق —
 * وهو العطبُ الحقيقيّ، لا غيابُ الجدول كلِّه.
 */
const probeSchema = async () => {
    try {
        await Promise.all([
            client_1.prisma.setting.count(),
            client_1.prisma.user.count(),
            client_1.prisma.role.count(),
            client_1.prisma.permission.count(),
            client_1.prisma.academicYear.count(),
        ]);
        return true;
    }
    catch {
        return false;
    }
};
const buildSnapshot = async () => {
    const databaseReachable = await pingDatabase();
    if (!databaseReachable) {
        /*
         * القاعدةُ ساقطة ⇒ لا معنى لقياس ما بعدها: كلُّ استعلامٍ سيرمي،
         * وقائمةٌ حمراءُ كلُّها تُخفي أنّ السببَ واحد.
         */
        return {
            databaseReachable: false,
            schemaReadable: false,
            language: "",
            country: "",
            timezone: "",
            dateFormat: "",
            institutionName: "",
            activeAdministrators: 0,
            adminRoleExists: false,
            adminPermissions: 0,
            acceptedTermsVersion: "",
            currentAcademicYears: 0,
            academicYearDatesValid: false,
            devicesRecorded: false,
            appVersion: "",
            firstBootVersion: "",
        };
    }
    const schemaReadable = await probeSchema();
    const settings = await readMany([
        ...ANSWER_KEYS,
        first_boot_keys_1.SYSTEM_KEYS.version,
        "school.name_ar",
    ]);
    const [admins, adminRole, currentYears] = await Promise.all([
        client_1.prisma.user.count({ where: { isActive: true, role: { name: provision_1.ADMIN_ROLE } } }),
        client_1.prisma.role.findUnique({
            where: { name: provision_1.ADMIN_ROLE },
            select: { id: true, _count: { select: { permissions: true } } },
        }),
        client_1.prisma.academicYear.findMany({
            where: { isCurrent: true },
            select: { startDate: true, endDate: true },
        }),
    ]);
    const datesValid = currentYears.length === 1 &&
        currentYears[0].endDate > currentYears[0].startDate;
    /*
     * اسمُ المؤسسة يُقرأ **مضبوطاً** لا معروضاً: `getSchoolService` تدمج
     * الافتراضيَّ فوق الفارغ، فلو قُرئ من هناك لنجح الفحصُ على تركيبٍ لم
     * يُكتب فيه اسمٌ قطّ — والصفُّ الغائبُ هو بعينه ما نبحث عنه.
     */
    return {
        databaseReachable: true,
        schemaReadable,
        language: settings.get(first_boot_keys_1.SYSTEM_KEYS.language) ?? "",
        country: settings.get(first_boot_keys_1.SYSTEM_KEYS.country) ?? "",
        timezone: settings.get(first_boot_keys_1.SYSTEM_KEYS.timezone) ?? "",
        dateFormat: settings.get(first_boot_keys_1.SYSTEM_KEYS.dateFormat) ?? "",
        institutionName: settings.get("school.name_ar") ?? "",
        activeAdministrators: admins,
        adminRoleExists: Boolean(adminRole),
        adminPermissions: adminRole?._count.permissions ?? 0,
        acceptedTermsVersion: settings.get(first_boot_keys_1.SYSTEM_KEYS.termsVersion) ?? "",
        currentAcademicYears: currentYears.length,
        academicYearDatesValid: datesValid,
        devicesRecorded: settings.has(first_boot_keys_1.SYSTEM_KEYS.devices),
        appVersion: settings.get(first_boot_keys_1.SYSTEM_KEYS.appVersion) ?? "",
        firstBootVersion: settings.get(first_boot_keys_1.SYSTEM_KEYS.version) ?? "",
    };
};
const verifyService = async () => {
    const checks = (0, first_boot_verify_1.evaluateChecks)(await buildSnapshot());
    const ok = (0, first_boot_verify_1.allPassed)(checks);
    const state = await (0, exports.loadState)();
    /*
     * الفحصُ الناجحُ يختم خطوتَه ويرفع «فاشلة» عن التركيب.
     *
     * ورفعُ العلَم شرطُ أن يكون لـ`FAILED` مخرج: من عالج النقصَ ثمّ أعاد
     * الفحصَ لا يبقى في حالةٍ تقول إنّه فشل (§25). والفحصُ الفاشلُ لا
     * يكتب شيئاً — الكتابةُ عند الإتمام وحده.
     */
    if (ok && state.status !== "COMPLETED") {
        const next = (0, first_boot_state_1.advance)(state, "FINAL_VERIFICATION");
        await client_1.prisma.$transaction(async (tx) => {
            await writeMany(tx, {
                [first_boot_keys_1.SYSTEM_KEYS.status]: "IN_PROGRESS",
                [first_boot_keys_1.SYSTEM_KEYS.done]: JSON.stringify(next.done),
                [first_boot_keys_1.SYSTEM_KEYS.step]: next.current,
            });
        });
    }
    return { ok, checks, missing: (0, first_boot_verify_1.failedKeys)(checks) };
};
exports.verifyService = verifyService;
/**
 * الإتمام — ولا يُصدَّق طلبُ الواجهة فيه.
 *
 * الفحصُ يُعاد هنا كاملاً مهما قالت الشاشةُ قبل لحظة: بين الفحصِ
 * والضغطةِ قد تسقط القاعدةُ أو تُحذف السنةُ من نافذةٍ أخرى. وهذا هو
 * الفرقُ بين «قال المستخدمُ إنّه جاهز» و«النظامُ جاهزٌ فعلاً» (§21/§24).
 */
const completeService = async () => {
    const state = await (0, exports.loadState)();
    if (state.status === "COMPLETED")
        return (0, exports.loadState)();
    const result = await (0, exports.verifyService)();
    if (!result.ok) {
        await client_1.prisma.$transaction(async (tx) => {
            await writeMany(tx, { [first_boot_keys_1.SYSTEM_KEYS.status]: "FAILED" });
        });
        throw new app_errors_1.BadRequestException(`التحقّق النهائي فشل: ${result.missing.join(", ")}`, error_code_enum_1.ErrorCodeEnum.SETUP_VERIFICATION_FAILED);
    }
    const now = new Date().toISOString();
    await client_1.prisma.$transaction(async (tx) => {
        await writeMany(tx, {
            [first_boot_keys_1.SYSTEM_KEYS.status]: "COMPLETED",
            [first_boot_keys_1.SYSTEM_KEYS.step]: "READY",
            [first_boot_keys_1.SYSTEM_KEYS.done]: JSON.stringify(first_boot_state_1.FIRST_BOOT_STEPS),
            [first_boot_keys_1.SYSTEM_KEYS.completedAt]: now,
            [first_boot_keys_1.SYSTEM_KEYS.version]: first_boot_state_1.FIRST_BOOT_VERSION,
        });
    });
    return (0, exports.loadState)();
};
exports.completeService = completeService;
// ======================================================
// إعادةُ التهيئة — إعداداتُ النظام وحدها
// ======================================================
/**
 * تمحو **حالةَ التهيئة** لا بياناتِ المؤسسة (§59).
 *
 * والفرقُ جوهري: محوُ البيانات فعلٌ آخرُ له مساره وحرسُه
 * (`/api/maintenance/reset`). وهذه تُعيد فتحَ الشاشات فقط — ومَن
 * ناداها يجد مديرَه وسنتَه كما هما، فتمرّ الخطواتُ عليهما تصحيحاً
 * لا إنشاءً.
 */
const resetFirstBootService = async () => {
    await client_1.prisma.setting.deleteMany({
        where: {
            key: {
                in: [
                    ...STATE_KEYS,
                    first_boot_keys_1.SYSTEM_KEYS.updateCheckedAt,
                    first_boot_keys_1.SYSTEM_KEYS.termsAcceptedBy,
                ],
            },
        },
    });
    await client_1.prisma.$transaction(async (tx) => {
        await writeMany(tx, {
            [first_boot_keys_1.SYSTEM_KEYS.status]: "NOT_STARTED",
            [first_boot_keys_1.SYSTEM_KEYS.step]: first_boot_state_1.FIRST_STEP,
            [first_boot_keys_1.SYSTEM_KEYS.done]: JSON.stringify([]),
            [first_boot_keys_1.SYSTEM_KEYS.version]: first_boot_state_1.FIRST_BOOT_VERSION,
        });
    });
    return (0, exports.loadState)();
};
exports.resetFirstBootService = resetFirstBootService;
// ======================================================
// فحصُ الاتصال — تقرؤه شاشةُ الشبكة (§11)
// ======================================================
/**
 * ما يُعرض في شاشة الشبكة يُقاس هنا، ولا يُفترض شيءٌ منه (§29).
 *
 * والمصادقةُ تُقاس بوجود منظومتها لا بمحاولةِ دخول: لا حسابَ بعدُ
 * حين تُعرض هذه الشاشة، فالسؤالُ «هل الأدوارُ والصلاحياتُ قائمة؟»
 * لا «هل تقبلني كلمةُ مرور؟».
 */
const probeService = async () => {
    const database = await pingDatabase();
    const schema = database ? await probeSchema() : false;
    let auth = false;
    if (schema) {
        try {
            auth = (await client_1.prisma.permission.count()) > 0;
        }
        catch {
            auth = false;
        }
    }
    return {
        database,
        schema,
        /** «خدمةُ المصادقة» = الأدوارُ والصلاحياتُ مركَّبةٌ ومقروءة */
        auth,
        /*
         * الإنترنت **ليس شرطاً** — والقيمةُ تُعرض إخباراً لا حكماً (§11).
         * ولا يُقاس هنا: الخادمُ قد يكون على شبكةٍ لها منفذٌ والجهازُ لا،
         * فقياسُه من جانبٍ واحد يقول ما لا يعني الآخر.
         */
        internetRequired: false,
    };
};
exports.probeService = probeService;
// ======================================================
// تقدّمُ بناء المؤسسة — بعد التهيئة لا فيها (§65)
// ======================================================
/**
 * قائمةُ ما بقي — أعدادٌ حقيقيةٌ من القاعدة لا علاماتٌ محفوظة.
 *
 * ولذلك لا تكذب: مَن أضاف مادّةً من شاشة المواد يجد البندَ متمّاً
 * وإن لم يمرّ باللوحة قطّ. وعلامةٌ تُحفظ عند «اضغط تمّ» كانت ستفترق
 * عن الواقع في أوّل يوم.
 */
const institutionProgressService = async () => {
    const [stages, levels, subjects, teachers, groups, classrooms, schedules, fees, policies, students,] = await Promise.all([
        client_1.prisma.educationStage.count(),
        client_1.prisma.level.count(),
        client_1.prisma.subject.count(),
        client_1.prisma.teacher.count(),
        client_1.prisma.studyGroup.count(),
        client_1.prisma.classroom.count(),
        client_1.prisma.schedule.count(),
        client_1.prisma.tuitionFee.count(),
        client_1.prisma.settlementPolicy.count(),
        client_1.prisma.student.count(),
    ]);
    const areas = [
        { key: "stages", count: stages },
        { key: "levels", count: levels },
        { key: "subjects", count: subjects },
        { key: "teachers", count: teachers },
        { key: "groups", count: groups },
        { key: "classrooms", count: classrooms },
        { key: "schedules", count: schedules },
        { key: "fees", count: fees },
        { key: "policies", count: policies },
        { key: "students", count: students },
    ].map((area) => ({ ...area, done: area.count > 0 }));
    const doneCount = areas.filter((area) => area.done).length;
    const dismissed = (await readMany([first_boot_keys_1.SYSTEM_KEYS.onboardingDismissed])).get(first_boot_keys_1.SYSTEM_KEYS.onboardingDismissed);
    return {
        areas,
        percent: Math.round((doneCount / areas.length) * 100),
        dismissed: dismissed === "true",
    };
};
exports.institutionProgressService = institutionProgressService;
const dismissOnboardingService = async () => {
    await client_1.prisma.$transaction(async (tx) => {
        await writeMany(tx, { [first_boot_keys_1.SYSTEM_KEYS.onboardingDismissed]: "true" });
    });
    return (0, exports.institutionProgressService)();
};
exports.dismissOnboardingService = dismissOnboardingService;
//# sourceMappingURL=first-boot.service.js.map