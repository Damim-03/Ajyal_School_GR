import { Request, Response } from "express";

import { ApiResponse } from "../../core/config/api-response";
import { BadRequestException } from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { invalidateInitializedCache } from "../../core/middleware/initialized.middleware";
import {
  assertSetupOpen,
  completeService,
  createAdministratorService,
  dismissOnboardingService,
  getStatusService,
  goBackService,
  institutionProgressService,
  probeService,
  resetFirstBootService,
  setAcademicYearService,
  setDevicesService,
  setDisplayService,
  setInstitutionService,
  setLanguageService,
  setNetworkService,
  setPerformanceService,
  setPrivacyService,
  setRecoveryService,
  setRegionService,
  setTermsService,
  setUpdateService,
  verifyService,
} from "./first-boot.service";
import type {
  AcademicYearInput,
  AdministratorInput,
  BackInput,
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

/*
 * متحكّمٌ رقيق: التحقّقُ في `validate` والقرارُ في الخدمة. وما هنا
 * تحويلُ نوعٍ وتسميةُ رسالة — كما في باقي وحدات المشروع.
 */

// GET /api/system/first-boot/status
export const statusController = async (_req: Request, res: Response) =>
  ApiResponse.success(res, await getStatusService(), "First boot status");

// GET /api/system/first-boot/probe
export const probeController = async (_req: Request, res: Response) =>
  ApiResponse.success(res, await probeService(), "Connectivity probe");

// POST /api/system/first-boot/language
export const languageController = async (req: Request, res: Response) =>
  ApiResponse.success(
    res,
    await setLanguageService(req.body as LanguageInput),
    "Language saved",
  );

// POST /api/system/first-boot/region
export const regionController = async (req: Request, res: Response) =>
  ApiResponse.success(
    res,
    await setRegionService(req.body as RegionInput),
    "Region saved",
  );

// POST /api/system/first-boot/network
export const networkController = async (req: Request, res: Response) =>
  ApiResponse.success(
    res,
    await setNetworkService(req.body as NetworkInput),
    "Network mode saved",
  );

// POST /api/system/first-boot/display
export const displayController = async (req: Request, res: Response) =>
  ApiResponse.success(
    res,
    await setDisplayService(req.body as DisplayInput),
    "Display preferences saved",
  );

// POST /api/system/first-boot/performance
export const performanceController = async (req: Request, res: Response) =>
  ApiResponse.success(
    res,
    await setPerformanceService(req.body as PerformanceInput),
    "Performance profile saved",
  );

// POST /api/system/first-boot/terms
export const termsController = async (req: Request, res: Response) =>
  ApiResponse.success(
    res,
    await setTermsService(req.body as TermsInput),
    "Terms accepted",
  );

// POST /api/system/first-boot/update
export const updateController = async (req: Request, res: Response) =>
  ApiResponse.success(
    res,
    await setUpdateService(req.body as UpdateInput),
    "Update state recorded",
  );

// POST /api/system/first-boot/devices
export const devicesController = async (req: Request, res: Response) =>
  ApiResponse.success(
    res,
    await setDevicesService(req.body as DevicesInput),
    "Devices recorded",
  );

// POST /api/system/first-boot/administrator
export const administratorController = async (req: Request, res: Response) =>
  ApiResponse.created(
    res,
    await createAdministratorService(req.body as AdministratorInput),
    "Administrator ready",
  );

// POST /api/system/first-boot/institution
export const institutionController = async (req: Request, res: Response) =>
  ApiResponse.success(
    res,
    await setInstitutionService(req.body as InstitutionInput),
    "Institution identity saved",
  );

// POST /api/system/first-boot/academic-year
export const academicYearController = async (req: Request, res: Response) =>
  ApiResponse.success(
    res,
    await setAcademicYearService(req.body as AcademicYearInput),
    "Academic year ready",
  );

// POST /api/system/first-boot/privacy
export const privacyController = async (req: Request, res: Response) =>
  ApiResponse.success(
    res,
    await setPrivacyService(req.body as PrivacyInput),
    "Privacy preferences saved",
  );

// POST /api/system/first-boot/recovery
export const recoveryController = async (req: Request, res: Response) =>
  ApiResponse.success(
    res,
    await setRecoveryService(req.body as RecoveryInput),
    "Recovery contact saved",
  );

// POST /api/system/first-boot/back
export const backController = async (req: Request, res: Response) =>
  ApiResponse.success(
    res,
    await goBackService((req.body as BackInput).from),
    "Stepped back",
  );

// POST /api/system/first-boot/verify
export const verifyController = async (_req: Request, res: Response) =>
  ApiResponse.success(res, await verifyService(), "Verification finished");

// POST /api/system/first-boot/complete
export const completeController = async (_req: Request, res: Response) => {
  const state = await completeService();

  /*
   * الحارسُ يحفظ «مهيَّأ» في ذاكرته ليُوفّر استعلاماً على كل طلب،
   * وهو الآن يحمل `false` من كل نداءٍ سبق هذه اللحظة. وإبطالُه هنا
   * هو ما يجعل أوّلَ طلبٍ بعد التهيئة يمرّ — بدل أن ينتظر إقلاعاً
   * جديداً للخادم.
   */
  invalidateInitializedCache();

  return ApiResponse.success(res, state, "First boot completed");
};

// POST /api/system/first-boot/reset — محميّ
export const resetController = async (_req: Request, res: Response) => {
  const state = await resetFirstBootService();

  invalidateInitializedCache();

  return ApiResponse.success(res, state, "First boot reset");
};

// GET /api/system/institution-progress
export const institutionProgressController = async (
  _req: Request,
  res: Response,
) =>
  ApiResponse.success(
    res,
    await institutionProgressService(),
    "Institution setup progress",
  );

// POST /api/system/institution-progress/dismiss
export const dismissOnboardingController = async (
  _req: Request,
  res: Response,
) =>
  ApiResponse.success(
    res,
    await dismissOnboardingService(),
    "Onboarding panel dismissed",
  );

/**
 * POST /api/system/first-boot/logo — شعارُ المؤسسة قبل وجود حساب.
 *
 * ويمرّ بالمُهيّئ نفسِه الذي يخدم `/api/uploads` (المجلَّد والحدُّ
 * والامتدادات)، فلا يُفتح بابٌ بقواعدَ أرخى. وحرسُه أنّ التهيئةَ
 * مفتوحة: متى اكتملت رُدّ بـ409 ولزم المسارُ المحميّ.
 */
export const logoController = async (req: Request, res: Response) => {
  await assertSetupOpen();

  if (!req.file) {
    throw new BadRequestException(
      "لم يُرفَق أي ملف",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  return ApiResponse.created(
    res,
    { path: `/uploads/${req.file.filename}` },
    "تم رفع الشعار",
  );
};
