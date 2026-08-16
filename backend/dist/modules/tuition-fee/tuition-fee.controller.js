"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTuitionFeeController = exports.updateTuitionFeeController = exports.createTuitionFeeController = exports.getTuitionFeeController = exports.listTuitionFeesController = void 0;
const api_response_1 = require("../../core/config/api-response");
const tuition_fee_service_1 = require("./tuition-fee.service");
const listTuitionFeesController = async (req, res) => {
    const query = req.query;
    const { tuitionFees, pagination } = await (0, tuition_fee_service_1.listTuitionFeesService)(query);
    return api_response_1.ApiResponse.paginated(res, tuitionFees, pagination, "Tuition fees retrieved");
};
exports.listTuitionFeesController = listTuitionFeesController;
const getTuitionFeeController = async (req, res) => {
    const tuitionFee = await (0, tuition_fee_service_1.getTuitionFeeService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { tuitionFee }, "Tuition fee retrieved");
};
exports.getTuitionFeeController = getTuitionFeeController;
const createTuitionFeeController = async (req, res) => {
    const tuitionFee = await (0, tuition_fee_service_1.createTuitionFeeService)(req.body);
    return api_response_1.ApiResponse.created(res, { tuitionFee }, "Tuition fee created");
};
exports.createTuitionFeeController = createTuitionFeeController;
const updateTuitionFeeController = async (req, res) => {
    const tuitionFee = await (0, tuition_fee_service_1.updateTuitionFeeService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { tuitionFee }, "Tuition fee updated");
};
exports.updateTuitionFeeController = updateTuitionFeeController;
const deleteTuitionFeeController = async (req, res) => {
    await (0, tuition_fee_service_1.deleteTuitionFeeService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Tuition fee deleted");
};
exports.deleteTuitionFeeController = deleteTuitionFeeController;
//# sourceMappingURL=tuition-fee.controller.js.map