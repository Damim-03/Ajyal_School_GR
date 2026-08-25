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

import bcrypt from "bcryptjs";

import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import { ADMIN_ROLE, provisionRbac } from "../../core/rbac/provision";
import {
  BadRequestException,
  ConflictException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { SYSTEM_KEYS } from "./first-boot.keys";
import {
  advance,
  canGoBack,
  canSubmit,
  displayStep,
  FIRST_BOOT_STEPS,
  FIRST_BOOT_VERSION,
  FIRST_STEP,
  isFirstBootStep,
  progressOf,
  TERMS_VERSION,
  type FirstBootStatus,
  type FirstBootStep,
  type MachineState,
} from "./first-boot.state";
import {
  allPassed,
  evaluateChecks,
  failedKeys,
  type CheckResult,
  type VerificationSnapshot,
} from "./first-boot.verify";
import type {
  AcademicYearInput,
  AdministratorInput,
  DevicesInput,
  DisplayInput,
  InstitutionInput,
  LanguageInput,
  NetworkInput,
  PerformanceInput,
  PrivacyInput,
  RecoveryInput,
  RegionInput,
  TermsInput,
  UpdateInput,
} from "./first-boot.schema";

// ======================================================
// قراءةُ الإعدادات وكتابتُها
// ======================================================

type Tx = Prisma.TransactionClient;

const readMany = async (keys: string[]): Promise<Map<string, string>> => {
  const rows = await prisma.setting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });

  return new Map(rows.map((row) => [row.key, row.value]));
};

/** كتابةُ دفعةٍ داخل معاملةٍ قائمة — لا تفتح واحدةً من عندها */
const writeMany = async (tx: Tx, values: Record<string, string>) => {
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

const parseDone = (raw: string | undefined): FirstBootStep[] => {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    /*
     * التصفيةُ ليست حذراً زائداً: خطوةٌ حُذفت من الشيفرة في إصدارٍ
     * لاحق تبقى مكتوبةً في قاعدةِ مؤسسةٍ قديمة، و`stepIndex` لها
     * يعود ‎-1‏ فتنكسر المقارناتُ كلُّها بصمت.
     */
    return parsed.filter(
      (value): value is FirstBootStep =>
        typeof value === "string" && isFirstBootStep(value),
    );
  } catch {
    return [];
  }
};

const STATE_KEYS = [
  SYSTEM_KEYS.status,
  SYSTEM_KEYS.step,
  SYSTEM_KEYS.done,
  SYSTEM_KEYS.version,
  SYSTEM_KEYS.startedAt,
  SYSTEM_KEYS.completedAt,
  SYSTEM_KEYS.adopted,
];

const isStatus = (value: string): value is FirstBootStatus =>
  ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "FAILED"].includes(value);

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
const detectAdoptable = async (): Promise<boolean> => {
  const [admins, currentYears] = await Promise.all([
    prisma.user.count({
      where: { isActive: true, role: { name: ADMIN_ROLE } },
    }),
    prisma.academicYear.count({ where: { isCurrent: true } }),
  ]);

  return admins >= 1 && currentYears >= 1;
};

const adopt = async () => {
  const now = new Date().toISOString();

  await prisma.$transaction(async (tx) => {
    await writeMany(tx, {
      [SYSTEM_KEYS.status]: "COMPLETED",
      [SYSTEM_KEYS.step]: "READY",
      [SYSTEM_KEYS.done]: JSON.stringify(FIRST_BOOT_STEPS),
      [SYSTEM_KEYS.version]: FIRST_BOOT_VERSION,
      [SYSTEM_KEYS.startedAt]: now,
      [SYSTEM_KEYS.completedAt]: now,
      [SYSTEM_KEYS.adopted]: "true",
    });

    /*
     * تفضيلاتٌ لم تُسأل لأنّ الشاشاتِ لم تكن موجودة — تُملأ بما كان
     * التطبيقُ يسلكه فعلاً قبلها: عربيّةٌ وتوقيتُ الجزائر وشكلُ
     * تاريخٍ يوم/شهر/سنة، وهي التي كانت مكتوبةً في الشيفرة.
     */
    const defaults: Record<string, string> = {
      [SYSTEM_KEYS.language]: "ar",
      [SYSTEM_KEYS.country]: "DZ",
      [SYSTEM_KEYS.timezone]: "Africa/Algiers",
      [SYSTEM_KEYS.dateFormat]: "DD/MM/YYYY",
      [SYSTEM_KEYS.networkMode]: "LOCAL",
      [SYSTEM_KEYS.uiScale]: "DEFAULT",
      [SYSTEM_KEYS.density]: "COMFORTABLE",
      [SYSTEM_KEYS.windowMode]: "MAXIMIZED",
      [SYSTEM_KEYS.performance]: "BALANCED",
      [SYSTEM_KEYS.termsVersion]: TERMS_VERSION,
      [SYSTEM_KEYS.termsAcceptedAt]: now,
      /*
       * **لا يدّعي موافقةً لم تقع.** «ADOPTED» تقول للسجلّ: هذا
       * تركيبٌ سبق وجودَ شاشة الشروط. ولو كُتب اسمُ مستخدمٍ هنا
       * لصار السجلُّ يشهد بما لم يحدث.
       */
      [SYSTEM_KEYS.termsAcceptedBy]: "ADOPTED",
      [SYSTEM_KEYS.updateChannel]: "NONE",
      [SYSTEM_KEYS.devices]: JSON.stringify([]),
      [SYSTEM_KEYS.diagnostics]: "false",
    };

    const existing = await tx.setting.findMany({
      where: { key: { in: Object.keys(defaults) } },
      select: { key: true },
    });

    const known = new Set(existing.map((row) => row.key));

    /* ما ضُبط فعلاً لا يُدهَس: الاعترافُ يملأ الفراغَ لا يُعيد الكتابة */
    await writeMany(
      tx,
      Object.fromEntries(
        Object.entries(defaults).filter(([key]) => !known.has(key)),
      ),
    );
  });
};

export interface FirstBootState extends MachineState {
  version: string;
  startedAt: string | null;
  completedAt: string | null;
  adopted: boolean;
  progress: { index: number; total: number };
}

/**
 * الحالةُ الحاليةُ — ونقطةُ الدخول الوحيدة إليها.
 *
 * وتكتب أحياناً وهي تُقرأ: أوّلُ نداءٍ على تركيبٍ قائمٍ يختمه
 * «معترَفاً به». وذلك مرّةً واحدةً في عمر القاعدة، وبعدها قراءةٌ
 * محضة.
 */
export const loadState = async (): Promise<FirstBootState> => {
  let stored = await readMany(STATE_KEYS);

  if (!stored.has(SYSTEM_KEYS.status)) {
    if (await detectAdoptable()) {
      await adopt();
      stored = await readMany(STATE_KEYS);
    }
  }

  const rawStatus = stored.get(SYSTEM_KEYS.status) ?? "NOT_STARTED";
  const status: FirstBootStatus = isStatus(rawStatus) ? rawStatus : "NOT_STARTED";
  const done = parseDone(stored.get(SYSTEM_KEYS.done));

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
  const current = displayStep(status, done);

  return {
    status,
    current,
    done,
    version: stored.get(SYSTEM_KEYS.version) ?? FIRST_BOOT_VERSION,
    startedAt: stored.get(SYSTEM_KEYS.startedAt) ?? null,
    completedAt: stored.get(SYSTEM_KEYS.completedAt) ?? null,
    adopted: stored.get(SYSTEM_KEYS.adopted) === "true",
    progress: progressOf(current),
  };
};

/** هل النظامُ مهيَّأ؟ يقرؤها حارسُ المسارات (§62) */
export const isInitialized = async (): Promise<boolean> =>
  (await loadState()).status === "COMPLETED";

/**
 * حارسُ ما يُفتح أثناء التهيئة وحدها — كرفع الشعار.
 *
 * فذلك المسارُ يكتب ملفّاً على القرص بلا مصادقة، وهو مقبولٌ ما دامت
 * النافذةُ مفتوحةً (لا حسابَ بعدُ ليُصادَق به). ومتى أُغلقت صار رفعُ
 * الصور من مسارِه المحميّ لا من هنا.
 */
export const assertSetupOpen = async () => {
  const state = await loadState();

  if (state.status === "COMPLETED") {
    throw new ConflictException(
      "التهيئةُ الأولى مكتملة",
      ErrorCodeEnum.SETUP_ALREADY_COMPLETED,
    );
  }
};

// ======================================================
// الحالةُ المعروضة — الحالة + ما حُفظ من إجابات
// ======================================================

const ANSWER_KEYS = [
  SYSTEM_KEYS.language,
  SYSTEM_KEYS.country,
  SYSTEM_KEYS.timezone,
  SYSTEM_KEYS.dateFormat,
  SYSTEM_KEYS.networkMode,
  SYSTEM_KEYS.uiScale,
  SYSTEM_KEYS.density,
  SYSTEM_KEYS.windowMode,
  SYSTEM_KEYS.performance,
  SYSTEM_KEYS.termsVersion,
  SYSTEM_KEYS.termsAcceptedAt,
  SYSTEM_KEYS.updateChannel,
  SYSTEM_KEYS.appVersion,
  SYSTEM_KEYS.devices,
  SYSTEM_KEYS.diagnostics,
  SYSTEM_KEYS.recoveryPhone,
];

/**
 * ما أجاب به المستخدمُ سابقاً — لتعود الشاشةُ كما تركها لا فارغة.
 *
 * ولا كلمةَ مرورٍ ولا شيءَ منها هنا: ما يُكتب في خطوة المدير يذهب
 * إلى جدول المستخدمين مُعمَّى ولا يعود (§38).
 */
export const getStatusService = async () => {
  const [state, answers] = await Promise.all([loadState(), readMany(ANSWER_KEYS)]);

  const school = await readMany([
    "school.name_ar",
    "school.name_en",
    "school.short_name",
    "school.phone",
    "school.email",
    "school.address",
    "school.logo_path",
  ]);

  const currentYear = await prisma.academicYear.findFirst({
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
    steps: FIRST_BOOT_STEPS,
    termsVersion: TERMS_VERSION,
    answers: {
      language: answers.get(SYSTEM_KEYS.language) ?? "",
      country: answers.get(SYSTEM_KEYS.country) ?? "",
      timezone: answers.get(SYSTEM_KEYS.timezone) ?? "",
      dateFormat: answers.get(SYSTEM_KEYS.dateFormat) ?? "",
      networkMode: answers.get(SYSTEM_KEYS.networkMode) ?? "",
      uiScale: answers.get(SYSTEM_KEYS.uiScale) ?? "",
      density: answers.get(SYSTEM_KEYS.density) ?? "",
      windowMode: answers.get(SYSTEM_KEYS.windowMode) ?? "",
      performance: answers.get(SYSTEM_KEYS.performance) ?? "",
      termsVersion: answers.get(SYSTEM_KEYS.termsVersion) ?? "",
      termsAcceptedAt: answers.get(SYSTEM_KEYS.termsAcceptedAt) ?? "",
      updateChannel: answers.get(SYSTEM_KEYS.updateChannel) ?? "",
      appVersion: answers.get(SYSTEM_KEYS.appVersion) ?? "",
      diagnostics: answers.get(SYSTEM_KEYS.diagnostics) === "true",
      recoveryPhone: answers.get(SYSTEM_KEYS.recoveryPhone) ?? "",
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

// ======================================================
// تسجيلُ خطوة
// ======================================================

/**
 * الحارسُ الذي يمرّ به كلُّ إرسال.
 *
 * ويُقرأ الحالُ من القاعدة في كلّ مرّة لا يُخزَّن: نافذتان مفتوحتان
 * على التركيب نفسِه (وقد يقع) لا تعملان على نسختين من الحقيقة.
 */
const guardStep = async (step: FirstBootStep) => {
  const state = await loadState();
  const decision = canSubmit(state, step);

  if (!decision.allowed) {
    if (decision.reason === "COMPLETED") {
      throw new ConflictException(
        "التهيئةُ الأولى مكتملة — لا تُعاد إلّا من إعادة التهيئة",
        ErrorCodeEnum.SETUP_ALREADY_COMPLETED,
      );
    }

    throw new BadRequestException(
      `لا يمكن تنفيذ «${step}» قبل «${state.current}»`,
      ErrorCodeEnum.SETUP_STEP_OUT_OF_ORDER,
    );
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
const commitStep = async (
  step: FirstBootStep,
  values: Record<string, string>,
  extra?: (tx: Tx) => Promise<void>,
): Promise<FirstBootState> => {
  const { state } = await guardStep(step);
  const nextState = advance(state, step);
  const now = new Date().toISOString();

  await prisma.$transaction(async (tx) => {
    if (extra) await extra(tx);

    await writeMany(tx, {
      ...values,
      [SYSTEM_KEYS.status]: "IN_PROGRESS",
      [SYSTEM_KEYS.step]: nextState.current,
      [SYSTEM_KEYS.done]: JSON.stringify(nextState.done),
      [SYSTEM_KEYS.version]: FIRST_BOOT_VERSION,
      ...(state.startedAt ? {} : { [SYSTEM_KEYS.startedAt]: now }),
    });
  });

  return loadState();
};

// ------------------------------------------------------
// الخطواتُ التي تكتب تفضيلاً
// ------------------------------------------------------

export const setLanguageService = (body: LanguageInput) =>
  commitStep("LANGUAGE", { [SYSTEM_KEYS.language]: body.language });

export const setRegionService = (body: RegionInput) =>
  commitStep("REGION", {
    [SYSTEM_KEYS.country]: body.country,
    [SYSTEM_KEYS.timezone]: body.timezone,
    [SYSTEM_KEYS.dateFormat]: body.dateFormat,
  });

export const setNetworkService = (body: NetworkInput) =>
  commitStep("NETWORK", { [SYSTEM_KEYS.networkMode]: body.mode });

export const setDisplayService = (body: DisplayInput) =>
  commitStep("DISPLAY", {
    [SYSTEM_KEYS.uiScale]: body.uiScale,
    [SYSTEM_KEYS.density]: body.density,
    [SYSTEM_KEYS.windowMode]: body.windowMode,
  });

export const setPerformanceService = (body: PerformanceInput) =>
  commitStep("PERFORMANCE", { [SYSTEM_KEYS.performance]: body.profile });

export const setTermsService = (body: TermsInput) => {
  /*
   * نسخةُ الواجهة تُقارَن بنسخة الخادم: نافذةٌ بقيت مفتوحةً عبر تحديثٍ
   * غيَّر النصَّ كانت ستُرسل موافقةً على ما لم يُعرض.
   */
  if (body.version !== TERMS_VERSION) {
    throw new ConflictException(
      `نسخةُ الشروط تغيّرت (${body.version} ← ${TERMS_VERSION}) — أعِد قراءتها`,
      ErrorCodeEnum.SETUP_STEP_OUT_OF_ORDER,
    );
  }

  return commitStep("TERMS", {
    [SYSTEM_KEYS.termsVersion]: TERMS_VERSION,
    [SYSTEM_KEYS.termsAcceptedAt]: new Date().toISOString(),
    /*
     * ولا مستخدمَ بعدُ حين تُقبل الشروط — خطوةُ المدير بعدها. فيُسجَّل
     * «SETUP» ثمّ يُنسب إلى المدير حين يُنشأ، فلا يبقى السجلُّ بلا صاحب.
     */
    [SYSTEM_KEYS.termsAcceptedBy]: "SETUP",
  });
};

export const setUpdateService = (body: UpdateInput) =>
  commitStep("UPDATE", {
    [SYSTEM_KEYS.appVersion]: body.appVersion,
    [SYSTEM_KEYS.updateChannel]: body.channel,
    [SYSTEM_KEYS.updateCheckedAt]: new Date().toISOString(),
  });

export const setDevicesService = (body: DevicesInput) => {
  /*
   * جهازٌ مطلوبٌ ولم يُكتشف يوقف الخطوة (§37).
   *
   * ولوحةُ المفاتيح وحدها كذلك اليوم — وقيمةُ الفحص أنّه **لا يقرأ
   * قائمةً ثابتة**: إن صار في تركيبٍ ما طابعةٌ حرارية «مطلوبة»
   * بحسب إعداد المؤسسة، مرّت في هذا الشرط نفسِه بلا شيفرةٍ جديدة.
   */
  const missing = body.devices.filter(
    (device) => device.requirement === "REQUIRED" && !device.detected,
  );

  if (missing.length > 0) {
    throw new BadRequestException(
      `أجهزةٌ مطلوبةٌ غيرُ متوفّرة: ${missing.map((d) => d.kind).join(", ")}`,
      ErrorCodeEnum.SETUP_DEVICE_MISSING,
    );
  }

  return commitStep("DEVICES", {
    [SYSTEM_KEYS.devices]: JSON.stringify(body.devices),
  });
};

export const setPrivacyService = (body: PrivacyInput) =>
  commitStep("PRIVACY", {
    [SYSTEM_KEYS.diagnostics]: body.diagnostics ? "true" : "false",
  });

export const setRecoveryService = (body: RecoveryInput) =>
  commitStep("RECOVERY", { [SYSTEM_KEYS.recoveryPhone]: body.phone });

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
export const createAdministratorService = async (body: AdministratorInput) => {
  const { state, resubmit } = await guardStep("ADMINISTRATOR");

  if (resubmit) return loadState();

  const adminRoleId = await provisionRbac();

  const existing = await prisma.user.findUnique({
    where: { username: body.username },
    select: { id: true, roleId: true },
  });

  const nextState = advance(state, "ADMINISTRATOR");

  const passwordHash = existing ? null : await bcrypt.hash(body.password, 12);

  await prisma.$transaction(async (tx) => {
    let userId = existing?.id ?? "";

    if (!existing) {
      const created = await tx.user.create({
        data: {
          username: body.username,
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email ? body.email : null,
          password: passwordHash!,
          roleId: adminRoleId,
          isActive: true,
        },
        select: { id: true },
      });

      userId = created.id;
    }

    await writeMany(tx, {
      /* الموافقةُ على الشروط تُنسب الآن إلى صاحبها (§14) */
      [SYSTEM_KEYS.termsAcceptedBy]: userId,
      [SYSTEM_KEYS.status]: "IN_PROGRESS",
      [SYSTEM_KEYS.step]: nextState.current,
      [SYSTEM_KEYS.done]: JSON.stringify(nextState.done),
    });
  });

  return loadState();
};

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
export const setInstitutionService = (body: InstitutionInput) => {
  const values: Record<string, string> = { "school.name_ar": body.name };

  const optional: [string, string | undefined][] = [
    ["school.name_en", body.nameEn],
    ["school.short_name", body.shortName],
    ["school.phone", body.phone],
    ["school.email", body.email],
    ["school.address", body.address],
    ["school.logo_path", body.logoPath],
  ];

  for (const [key, value] of optional) {
    if (value !== undefined && value !== "") values[key] = value;
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
export const setAcademicYearService = (body: AcademicYearInput) => {
  const values: Record<string, string> = {};

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

// ======================================================
// الرجوع
// ======================================================

export const goBackService = async (from: FirstBootStep) => {
  const state = await loadState();
  const decision = canGoBack(state, from);

  if (!decision.allowed) {
    throw new BadRequestException(
      "لا رجوعَ من هنا",
      ErrorCodeEnum.SETUP_STEP_OUT_OF_ORDER,
    );
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

  await prisma.$transaction(async (tx) => {
    await writeMany(tx, {
      [SYSTEM_KEYS.done]: JSON.stringify(done),
      [SYSTEM_KEYS.step]: decision.target,
      [SYSTEM_KEYS.status]: "IN_PROGRESS",
    });
  });

  return { ...(await loadState()), current: decision.target };
};

// ======================================================
// التحقّق النهائي
// ======================================================

/** استعلامٌ لا يلمس جدولاً — يقيس الاتصالَ وحده */
const pingDatabase = async (): Promise<boolean> => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return true;
  } catch {
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
const probeSchema = async (): Promise<boolean> => {
  try {
    await Promise.all([
      prisma.setting.count(),
      prisma.user.count(),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.academicYear.count(),
    ]);

    return true;
  } catch {
    return false;
  }
};

const buildSnapshot = async (): Promise<VerificationSnapshot> => {
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
    SYSTEM_KEYS.version,
    "school.name_ar",
  ]);

  const [admins, adminRole, currentYears] = await Promise.all([
    prisma.user.count({ where: { isActive: true, role: { name: ADMIN_ROLE } } }),
    prisma.role.findUnique({
      where: { name: ADMIN_ROLE },
      select: { id: true, _count: { select: { permissions: true } } },
    }),
    prisma.academicYear.findMany({
      where: { isCurrent: true },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const datesValid =
    currentYears.length === 1 &&
    currentYears[0]!.endDate > currentYears[0]!.startDate;

  /*
   * اسمُ المؤسسة يُقرأ **مضبوطاً** لا معروضاً: `getSchoolService` تدمج
   * الافتراضيَّ فوق الفارغ، فلو قُرئ من هناك لنجح الفحصُ على تركيبٍ لم
   * يُكتب فيه اسمٌ قطّ — والصفُّ الغائبُ هو بعينه ما نبحث عنه.
   */
  return {
    databaseReachable: true,
    schemaReadable,
    language: settings.get(SYSTEM_KEYS.language) ?? "",
    country: settings.get(SYSTEM_KEYS.country) ?? "",
    timezone: settings.get(SYSTEM_KEYS.timezone) ?? "",
    dateFormat: settings.get(SYSTEM_KEYS.dateFormat) ?? "",
    institutionName: settings.get("school.name_ar") ?? "",
    activeAdministrators: admins,
    adminRoleExists: Boolean(adminRole),
    adminPermissions: adminRole?._count.permissions ?? 0,
    acceptedTermsVersion: settings.get(SYSTEM_KEYS.termsVersion) ?? "",
    currentAcademicYears: currentYears.length,
    academicYearDatesValid: datesValid,
    devicesRecorded: settings.has(SYSTEM_KEYS.devices),
    appVersion: settings.get(SYSTEM_KEYS.appVersion) ?? "",
    firstBootVersion: settings.get(SYSTEM_KEYS.version) ?? "",
  };
};

export interface VerificationResult {
  ok: boolean;
  checks: CheckResult[];
  missing: string[];
}

export const verifyService = async (): Promise<VerificationResult> => {
  const checks = evaluateChecks(await buildSnapshot());
  const ok = allPassed(checks);

  const state = await loadState();

  /*
   * الفحصُ الناجحُ يختم خطوتَه ويرفع «فاشلة» عن التركيب.
   *
   * ورفعُ العلَم شرطُ أن يكون لـ`FAILED` مخرج: من عالج النقصَ ثمّ أعاد
   * الفحصَ لا يبقى في حالةٍ تقول إنّه فشل (§25). والفحصُ الفاشلُ لا
   * يكتب شيئاً — الكتابةُ عند الإتمام وحده.
   */
  if (ok && state.status !== "COMPLETED") {
    const next = advance(state, "FINAL_VERIFICATION");

    await prisma.$transaction(async (tx) => {
      await writeMany(tx, {
        [SYSTEM_KEYS.status]: "IN_PROGRESS",
        [SYSTEM_KEYS.done]: JSON.stringify(next.done),
        [SYSTEM_KEYS.step]: next.current,
      });
    });
  }

  return { ok, checks, missing: failedKeys(checks) };
};

/**
 * الإتمام — ولا يُصدَّق طلبُ الواجهة فيه.
 *
 * الفحصُ يُعاد هنا كاملاً مهما قالت الشاشةُ قبل لحظة: بين الفحصِ
 * والضغطةِ قد تسقط القاعدةُ أو تُحذف السنةُ من نافذةٍ أخرى. وهذا هو
 * الفرقُ بين «قال المستخدمُ إنّه جاهز» و«النظامُ جاهزٌ فعلاً» (§21/§24).
 */
export const completeService = async () => {
  const state = await loadState();

  if (state.status === "COMPLETED") return loadState();

  const result = await verifyService();

  if (!result.ok) {
    await prisma.$transaction(async (tx) => {
      await writeMany(tx, { [SYSTEM_KEYS.status]: "FAILED" });
    });

    throw new BadRequestException(
      `التحقّق النهائي فشل: ${result.missing.join(", ")}`,
      ErrorCodeEnum.SETUP_VERIFICATION_FAILED,
    );
  }

  const now = new Date().toISOString();

  await prisma.$transaction(async (tx) => {
    await writeMany(tx, {
      [SYSTEM_KEYS.status]: "COMPLETED",
      [SYSTEM_KEYS.step]: "READY",
      [SYSTEM_KEYS.done]: JSON.stringify(FIRST_BOOT_STEPS),
      [SYSTEM_KEYS.completedAt]: now,
      [SYSTEM_KEYS.version]: FIRST_BOOT_VERSION,
    });
  });

  return loadState();
};

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
export const resetFirstBootService = async () => {
  await prisma.setting.deleteMany({
    where: {
      key: {
        in: [
          ...STATE_KEYS,
          SYSTEM_KEYS.updateCheckedAt,
          SYSTEM_KEYS.termsAcceptedBy,
        ],
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    await writeMany(tx, {
      [SYSTEM_KEYS.status]: "NOT_STARTED",
      [SYSTEM_KEYS.step]: FIRST_STEP,
      [SYSTEM_KEYS.done]: JSON.stringify([]),
      [SYSTEM_KEYS.version]: FIRST_BOOT_VERSION,
    });
  });

  return loadState();
};

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
export const probeService = async () => {
  const database = await pingDatabase();
  const schema = database ? await probeSchema() : false;

  let auth = false;

  if (schema) {
    try {
      auth = (await prisma.permission.count()) > 0;
    } catch {
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
export const institutionProgressService = async () => {
  const [
    stages,
    levels,
    subjects,
    teachers,
    groups,
    classrooms,
    schedules,
    fees,
    policies,
    students,
  ] = await Promise.all([
    prisma.educationStage.count(),
    prisma.level.count(),
    prisma.subject.count(),
    prisma.teacher.count(),
    prisma.studyGroup.count(),
    prisma.classroom.count(),
    prisma.schedule.count(),
    prisma.tuitionFee.count(),
    prisma.settlementPolicy.count(),
    prisma.student.count(),
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

  const dismissed = (await readMany([SYSTEM_KEYS.onboardingDismissed])).get(
    SYSTEM_KEYS.onboardingDismissed,
  );

  return {
    areas,
    percent: Math.round((doneCount / areas.length) * 100),
    dismissed: dismissed === "true",
  };
};

export const dismissOnboardingService = async () => {
  await prisma.$transaction(async (tx) => {
    await writeMany(tx, { [SYSTEM_KEYS.onboardingDismissed]: "true" });
  });

  return institutionProgressService();
};
