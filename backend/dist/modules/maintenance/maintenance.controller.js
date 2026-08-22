"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetController = exports.restoreController = exports.deleteBackupController = exports.downloadBackupController = exports.listBackupsController = exports.backupController = exports.overviewController = void 0;
const api_response_1 = require("../../core/config/api-response");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const maintenance_service_1 = require("./maintenance.service");
// GET /api/maintenance
const overviewController = async (_req, res) => {
    return api_response_1.ApiResponse.success(res, await (0, maintenance_service_1.overviewService)(), "Maintenance overview");
};
exports.overviewController = overviewController;
// POST /api/maintenance/backup
const backupController = async (_req, res) => {
    return api_response_1.ApiResponse.created(res, await (0, maintenance_service_1.backupService)(), "Backup created");
};
exports.backupController = backupController;
// GET /api/maintenance/backups
const listBackupsController = async (_req, res) => {
    return api_response_1.ApiResponse.success(res, await (0, maintenance_service_1.listBackupsService)(), "Backups");
};
exports.listBackupsController = listBackupsController;
/*
 * التنزيل يخرج من `res` مباشرةً لا عبر `ApiResponse`.
 *
 * الأرشيفُ ثنائيّ، ولفُّه في JSON يُضخّمه الثلث ويُجبر الواجهة على
 * فكّ base64 في الذاكرة. فيُرسل كما هو بترويسةٍ تحمل اسمه.
 */
// GET /api/maintenance/backups/:name/download
const downloadBackupController = async (req, res) => {
    const { name, buffer } = await (0, maintenance_service_1.readBackupService)(req.params.name);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    return res.send(buffer);
};
exports.downloadBackupController = downloadBackupController;
// DELETE /api/maintenance/backups/:name
const deleteBackupController = async (req, res) => {
    const result = await (0, maintenance_service_1.deleteBackupService)(req.params.name);
    return api_response_1.ApiResponse.success(res, result, "Backup deleted");
};
exports.deleteBackupController = deleteBackupController;
/**
 * الاستعادة من ملفٍّ مرفوع أو من نسخةٍ محفوظة باسمها.
 *
 * والثانيةُ هي الغالبة: النسخُ على الجهاز نفسه، فرفعُها إلى الخادم
 * الذي كتبها عبثٌ ينقل عشرات الميغا بلا سبب. والرفعُ يبقى لمن جاء
 * بنسخةٍ من قرصٍ خارجيّ أو من جهازٍ آخر.
 */
// POST /api/maintenance/restore
const restoreController = async (req, res) => {
    const name = req.body?.name;
    if (!req.file && !name) {
        throw new app_errors_1.BadRequestException("اختر نسخةً محفوظة أو ارفع ملفَّ نسخة", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    const result = await (0, maintenance_service_1.restoreService)(req.file ? req.file.buffer : { name: name });
    return api_response_1.ApiResponse.success(res, result, "Restored");
};
exports.restoreController = restoreController;
// POST /api/maintenance/reset
const resetController = async (req, res) => {
    const body = req.body;
    return api_response_1.ApiResponse.success(res, await (0, maintenance_service_1.resetService)(body), "Reset done");
};
exports.resetController = resetController;
//# sourceMappingURL=maintenance.controller.js.map