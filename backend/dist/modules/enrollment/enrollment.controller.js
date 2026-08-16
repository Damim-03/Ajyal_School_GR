"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEnrollmentController = exports.transferEnrollmentController = exports.updateEnrollmentController = exports.createEnrollmentController = exports.getEnrollmentController = exports.listEnrollmentsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const enrollment_service_1 = require("./enrollment.service");
const listEnrollmentsController = async (req, res) => {
    const query = req.query;
    const { enrollments, pagination } = await (0, enrollment_service_1.listEnrollmentsService)(query);
    return api_response_1.ApiResponse.paginated(res, enrollments, pagination, "Enrollments retrieved");
};
exports.listEnrollmentsController = listEnrollmentsController;
const getEnrollmentController = async (req, res) => {
    const enrollment = await (0, enrollment_service_1.getEnrollmentService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { enrollment }, "Enrollment retrieved");
};
exports.getEnrollmentController = getEnrollmentController;
// POST /api/enrollments — تسجيل في عدة مواد دفعة واحدة
const createEnrollmentController = async (req, res) => {
    const enrollments = await (0, enrollment_service_1.createEnrollmentService)(req.body);
    return api_response_1.ApiResponse.created(res, { enrollments, count: enrollments.length }, `${enrollments.length} enrollment(s) created`);
};
exports.createEnrollmentController = createEnrollmentController;
const updateEnrollmentController = async (req, res) => {
    const enrollment = await (0, enrollment_service_1.updateEnrollmentService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { enrollment }, "Enrollment updated");
};
exports.updateEnrollmentController = updateEnrollmentController;
const transferEnrollmentController = async (req, res) => {
    const result = await (0, enrollment_service_1.transferEnrollmentService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, result, "Enrollment transferred");
};
exports.transferEnrollmentController = transferEnrollmentController;
const deleteEnrollmentController = async (req, res) => {
    await (0, enrollment_service_1.deleteEnrollmentService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Enrollment deleted");
};
exports.deleteEnrollmentController = deleteEnrollmentController;
//# sourceMappingURL=enrollment.controller.js.map