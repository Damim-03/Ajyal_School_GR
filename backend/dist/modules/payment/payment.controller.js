"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelPaymentController = exports.createPaymentController = exports.getPaymentController = exports.listPaymentsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const payment_service_1 = require("./payment.service");
const listPaymentsController = async (req, res) => {
    const query = req.query;
    const { payments, pagination } = await (0, payment_service_1.listPaymentsService)(query);
    return api_response_1.ApiResponse.paginated(res, payments, pagination, "Payments retrieved");
};
exports.listPaymentsController = listPaymentsController;
const getPaymentController = async (req, res) => {
    const payment = await (0, payment_service_1.getPaymentService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { payment }, "Payment retrieved");
};
exports.getPaymentController = getPaymentController;
const createPaymentController = async (req, res) => {
    // receivedById إلزامي في الـ schema — يأتي من التوكن
    const payment = await (0, payment_service_1.createPaymentService)(req.body, req.user.userId);
    return api_response_1.ApiResponse.created(res, { payment }, "Payment recorded");
};
exports.createPaymentController = createPaymentController;
// POST /api/payments/:id/cancel
const cancelPaymentController = async (req, res) => {
    const payment = await (0, payment_service_1.cancelPaymentService)(req.params.id, req.body, req.user.userId);
    return api_response_1.ApiResponse.success(res, { payment }, "Payment cancelled");
};
exports.cancelPaymentController = cancelPaymentController;
//# sourceMappingURL=payment.controller.js.map