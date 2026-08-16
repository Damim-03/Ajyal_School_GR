"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelReceiptController = exports.reprintReceiptController = exports.printReceiptController = exports.getReceiptController = exports.listReceiptsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const receipt_service_1 = require("./receipt.service");
const listReceiptsController = async (req, res) => {
    const query = req.query;
    const { receipts, pagination } = await (0, receipt_service_1.listReceiptsService)(query);
    return api_response_1.ApiResponse.paginated(res, receipts, pagination, "Receipts retrieved");
};
exports.listReceiptsController = listReceiptsController;
const getReceiptController = async (req, res) => {
    const receipt = await (0, receipt_service_1.getReceiptService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { receipt }, "Receipt retrieved");
};
exports.getReceiptController = getReceiptController;
// POST /api/receipts/:id/print
const printReceiptController = async (req, res) => {
    const receipt = await (0, receipt_service_1.printReceiptService)(req.params.id, req.user.userId, false);
    return api_response_1.ApiResponse.success(res, { receipt }, "Receipt marked as printed");
};
exports.printReceiptController = printReceiptController;
// POST /api/receipts/:id/reprint
const reprintReceiptController = async (req, res) => {
    const receipt = await (0, receipt_service_1.printReceiptService)(req.params.id, req.user.userId, true);
    return api_response_1.ApiResponse.success(res, { receipt }, "Receipt reprinted");
};
exports.reprintReceiptController = reprintReceiptController;
// POST /api/receipts/:id/cancel
const cancelReceiptController = async (req, res) => {
    const receipt = await (0, receipt_service_1.cancelReceiptService)(req.params.id, req.body, req.user.userId);
    return api_response_1.ApiResponse.success(res, { receipt }, "Receipt cancelled");
};
exports.cancelReceiptController = cancelReceiptController;
//# sourceMappingURL=receipt.controller.js.map