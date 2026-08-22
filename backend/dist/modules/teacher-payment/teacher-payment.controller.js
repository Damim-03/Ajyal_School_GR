"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelTeacherPaymentController = exports.payTeacherController = exports.getTeacherPaymentController = exports.listTeacherPaymentsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const teacher_payment_service_1 = require("./teacher-payment.service");
const listTeacherPaymentsController = async (req, res) => {
    const query = req.query;
    const { payments, pagination } = await (0, teacher_payment_service_1.listTeacherPaymentsService)(query);
    return api_response_1.ApiResponse.paginated(res, payments, pagination, "Teacher payments retrieved");
};
exports.listTeacherPaymentsController = listTeacherPaymentsController;
const getTeacherPaymentController = async (req, res) => {
    const payment = await (0, teacher_payment_service_1.getTeacherPaymentService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { payment }, "Teacher payment retrieved");
};
exports.getTeacherPaymentController = getTeacherPaymentController;
const payTeacherController = async (req, res) => {
    const payment = await (0, teacher_payment_service_1.payTeacherService)(req.body, req.user.userId);
    return api_response_1.ApiResponse.created(res, { payment }, "Teacher paid");
};
exports.payTeacherController = payTeacherController;
const cancelTeacherPaymentController = async (req, res) => {
    const payment = await (0, teacher_payment_service_1.cancelTeacherPaymentService)(req.params.id, req.body, req.user.userId);
    return api_response_1.ApiResponse.success(res, { payment }, "Teacher payment cancelled");
};
exports.cancelTeacherPaymentController = cancelTeacherPaymentController;
//# sourceMappingURL=teacher-payment.controller.js.map