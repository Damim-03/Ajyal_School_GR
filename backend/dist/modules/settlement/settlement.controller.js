"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyClearanceController = exports.settlementEstimateController = exports.cancelSettlementController = exports.paySettlementController = exports.confirmSettlementController = exports.computeSettlementController = exports.getSettlementController = exports.listSettlementsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const settlement_service_1 = require("./settlement.service");
const settlement_report_service_1 = require("./settlement.report.service");
const listSettlementsController = async (req, res) => {
    const query = req.query;
    const { settlements, pagination } = await (0, settlement_service_1.listSettlementsService)(query);
    return api_response_1.ApiResponse.paginated(res, settlements, pagination, "Settlements retrieved");
};
exports.listSettlementsController = listSettlementsController;
const getSettlementController = async (req, res) => {
    const settlement = await (0, settlement_service_1.getSettlementService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { settlement }, "Settlement retrieved");
};
exports.getSettlementController = getSettlementController;
const computeSettlementController = async (req, res) => {
    const settlement = await (0, settlement_service_1.computeSettlementService)(req.body, req.user?.userId);
    return api_response_1.ApiResponse.created(res, { settlement }, "Settlement computed");
};
exports.computeSettlementController = computeSettlementController;
const confirmSettlementController = async (req, res) => {
    const settlement = await (0, settlement_service_1.confirmSettlementService)(req.params.id, req.body, req.user.userId);
    return api_response_1.ApiResponse.success(res, { settlement }, "Settlement confirmed");
};
exports.confirmSettlementController = confirmSettlementController;
const paySettlementController = async (req, res) => {
    const settlement = await (0, settlement_service_1.paySettlementService)(req.params.id, req.user.userId);
    return api_response_1.ApiResponse.success(res, { settlement }, "Settlement marked paid");
};
exports.paySettlementController = paySettlementController;
const cancelSettlementController = async (req, res) => {
    const settlement = await (0, settlement_service_1.cancelSettlementService)(req.params.id, req.body, req.user.userId);
    return api_response_1.ApiResponse.success(res, { settlement }, "Settlement cancelled");
};
exports.cancelSettlementController = cancelSettlementController;
// --------------------------------------------------
// الكشفان
// --------------------------------------------------
const settlementEstimateController = async (req, res) => {
    const estimate = await (0, settlement_report_service_1.settlementEstimateService)(req.query);
    return api_response_1.ApiResponse.success(res, estimate, "Settlement estimate retrieved");
};
exports.settlementEstimateController = settlementEstimateController;
const dailyClearanceController = async (req, res) => {
    const report = await (0, settlement_report_service_1.dailyClearanceService)(req.query);
    return api_response_1.ApiResponse.success(res, report, "Daily clearance retrieved");
};
exports.dailyClearanceController = dailyClearanceController;
//# sourceMappingURL=settlement.controller.js.map