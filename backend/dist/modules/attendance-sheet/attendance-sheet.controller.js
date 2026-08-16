"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSheetController = exports.updateSheetController = exports.createSheetController = exports.getSheetController = exports.listSheetsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const attendance_sheet_service_1 = require("./attendance-sheet.service");
const listSheetsController = async (req, res) => {
    const query = req.query;
    const { sheets, pagination } = await (0, attendance_sheet_service_1.listSheetsService)(query);
    return api_response_1.ApiResponse.paginated(res, sheets, pagination, "Sheets retrieved");
};
exports.listSheetsController = listSheetsController;
const getSheetController = async (req, res) => {
    const sheet = await (0, attendance_sheet_service_1.getSheetService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { sheet }, "Sheet retrieved");
};
exports.getSheetController = getSheetController;
const createSheetController = async (req, res) => {
    const sheet = await (0, attendance_sheet_service_1.createSheetService)(req.body);
    return api_response_1.ApiResponse.created(res, { sheet }, "Sheet created");
};
exports.createSheetController = createSheetController;
const updateSheetController = async (req, res) => {
    const sheet = await (0, attendance_sheet_service_1.updateSheetService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { sheet }, "Sheet updated");
};
exports.updateSheetController = updateSheetController;
const deleteSheetController = async (req, res) => {
    const result = await (0, attendance_sheet_service_1.deleteSheetService)(req.params.id);
    return api_response_1.ApiResponse.success(res, result, "Sheet deleted");
};
exports.deleteSheetController = deleteSheetController;
//# sourceMappingURL=attendance-sheet.controller.js.map