"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoController = exports.dismissOnboardingController = exports.institutionProgressController = exports.resetController = exports.completeController = exports.verifyController = exports.backController = exports.recoveryController = exports.privacyController = exports.academicYearController = exports.institutionController = exports.administratorController = exports.devicesController = exports.updateController = exports.termsController = exports.performanceController = exports.displayController = exports.networkController = exports.regionController = exports.languageController = exports.probeController = exports.statusController = void 0;
const api_response_1 = require("../../core/config/api-response");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const initialized_middleware_1 = require("../../core/middleware/initialized.middleware");
const first_boot_service_1 = require("./first-boot.service");
/*
 * متحكّمٌ رقيق: التحقّقُ في `validate` والقرارُ في الخدمة. وما هنا
 * تحويلُ نوعٍ وتسميةُ رسالة — كما في باقي وحدات المشروع.
 */
// GET /api/system/first-boot/status
const statusController = async (_req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.getStatusService)(), "First boot status");
exports.statusController = statusController;
// GET /api/system/first-boot/probe
const probeController = async (_req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.probeService)(), "Connectivity probe");
exports.probeController = probeController;
// POST /api/system/first-boot/language
const languageController = async (req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.setLanguageService)(req.body), "Language saved");
exports.languageController = languageController;
// POST /api/system/first-boot/region
const regionController = async (req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.setRegionService)(req.body), "Region saved");
exports.regionController = regionController;
// POST /api/system/first-boot/network
const networkController = async (req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.setNetworkService)(req.body), "Network mode saved");
exports.networkController = networkController;
// POST /api/system/first-boot/display
const displayController = async (req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.setDisplayService)(req.body), "Display preferences saved");
exports.displayController = displayController;
// POST /api/system/first-boot/performance
const performanceController = async (req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.setPerformanceService)(req.body), "Performance profile saved");
exports.performanceController = performanceController;
// POST /api/system/first-boot/terms
const termsController = async (req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.setTermsService)(req.body), "Terms accepted");
exports.termsController = termsController;
// POST /api/system/first-boot/update
const updateController = async (req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.setUpdateService)(req.body), "Update state recorded");
exports.updateController = updateController;
// POST /api/system/first-boot/devices
const devicesController = async (req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.setDevicesService)(req.body), "Devices recorded");
exports.devicesController = devicesController;
// POST /api/system/first-boot/administrator
const administratorController = async (req, res) => api_response_1.ApiResponse.created(res, await (0, first_boot_service_1.createAdministratorService)(req.body), "Administrator ready");
exports.administratorController = administratorController;
// POST /api/system/first-boot/institution
const institutionController = async (req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.setInstitutionService)(req.body), "Institution identity saved");
exports.institutionController = institutionController;
// POST /api/system/first-boot/academic-year
const academicYearController = async (req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.setAcademicYearService)(req.body), "Academic year ready");
exports.academicYearController = academicYearController;
// POST /api/system/first-boot/privacy
const privacyController = async (req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.setPrivacyService)(req.body), "Privacy preferences saved");
exports.privacyController = privacyController;
// POST /api/system/first-boot/recovery
const recoveryController = async (req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.setRecoveryService)(req.body), "Recovery contact saved");
exports.recoveryController = recoveryController;
// POST /api/system/first-boot/back
const backController = async (req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.goBackService)(req.body.from), "Stepped back");
exports.backController = backController;
// POST /api/system/first-boot/verify
const verifyController = async (_req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.verifyService)(), "Verification finished");
exports.verifyController = verifyController;
// POST /api/system/first-boot/complete
const completeController = async (_req, res) => {
    const state = await (0, first_boot_service_1.completeService)();
    /*
     * الحارسُ يحفظ «مهيَّأ» في ذاكرته ليُوفّر استعلاماً على كل طلب،
     * وهو الآن يحمل `false` من كل نداءٍ سبق هذه اللحظة. وإبطالُه هنا
     * هو ما يجعل أوّلَ طلبٍ بعد التهيئة يمرّ — بدل أن ينتظر إقلاعاً
     * جديداً للخادم.
     */
    (0, initialized_middleware_1.invalidateInitializedCache)();
    return api_response_1.ApiResponse.success(res, state, "First boot completed");
};
exports.completeController = completeController;
// POST /api/system/first-boot/reset — محميّ
const resetController = async (_req, res) => {
    const state = await (0, first_boot_service_1.resetFirstBootService)();
    (0, initialized_middleware_1.invalidateInitializedCache)();
    return api_response_1.ApiResponse.success(res, state, "First boot reset");
};
exports.resetController = resetController;
// GET /api/system/institution-progress
const institutionProgressController = async (_req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.institutionProgressService)(), "Institution setup progress");
exports.institutionProgressController = institutionProgressController;
// POST /api/system/institution-progress/dismiss
const dismissOnboardingController = async (_req, res) => api_response_1.ApiResponse.success(res, await (0, first_boot_service_1.dismissOnboardingService)(), "Onboarding panel dismissed");
exports.dismissOnboardingController = dismissOnboardingController;
/**
 * POST /api/system/first-boot/logo — شعارُ المؤسسة قبل وجود حساب.
 *
 * ويمرّ بالمُهيّئ نفسِه الذي يخدم `/api/uploads` (المجلَّد والحدُّ
 * والامتدادات)، فلا يُفتح بابٌ بقواعدَ أرخى. وحرسُه أنّ التهيئةَ
 * مفتوحة: متى اكتملت رُدّ بـ409 ولزم المسارُ المحميّ.
 */
const logoController = async (req, res) => {
    await (0, first_boot_service_1.assertSetupOpen)();
    if (!req.file) {
        throw new app_errors_1.BadRequestException("لم يُرفَق أي ملف", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    return api_response_1.ApiResponse.created(res, { path: `/uploads/${req.file.filename}` }, "تم رفع الشعار");
};
exports.logoController = logoController;
//# sourceMappingURL=first-boot.controller.js.map