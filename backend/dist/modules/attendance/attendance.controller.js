"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearSessionAttendanceController = exports.updateAttendanceController = exports.bulkAttendanceController = exports.createAttendanceController = exports.getAttendanceController = exports.listAttendanceController = void 0;
const api_response_1 = require("../../core/config/api-response");
const attendance_service_1 = require("./attendance.service");
const listAttendanceController = async (req, res) => {
    const query = req.query;
    const { attendances, pagination } = await (0, attendance_service_1.listAttendanceService)(query);
    return api_response_1.ApiResponse.paginated(res, attendances, pagination, "Attendance retrieved");
};
exports.listAttendanceController = listAttendanceController;
const getAttendanceController = async (req, res) => {
    const attendance = await (0, attendance_service_1.getAttendanceService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { attendance }, "Attendance retrieved");
};
exports.getAttendanceController = getAttendanceController;
const createAttendanceController = async (req, res) => {
    const attendance = await (0, attendance_service_1.createAttendanceService)(req.body);
    return api_response_1.ApiResponse.created(res, { attendance }, "Attendance recorded");
};
exports.createAttendanceController = createAttendanceController;
// POST /api/attendance/bulk — ورقة حضور الحصة كاملة
const bulkAttendanceController = async (req, res) => {
    const result = await (0, attendance_service_1.bulkAttendanceService)(req.body);
    return api_response_1.ApiResponse.success(res, result, `${result.created} created, ${result.updated} updated`);
};
exports.bulkAttendanceController = bulkAttendanceController;
const updateAttendanceController = async (req, res) => {
    const attendance = await (0, attendance_service_1.updateAttendanceService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { attendance }, "Attendance updated");
};
exports.updateAttendanceController = updateAttendanceController;
// DELETE /api/attendance/session/:sessionId
const clearSessionAttendanceController = async (req, res) => {
    const result = await (0, attendance_service_1.clearSessionAttendanceService)(req.params.sessionId);
    return api_response_1.ApiResponse.success(res, result, "Session attendance cleared");
};
exports.clearSessionAttendanceController = clearSessionAttendanceController;
//# sourceMappingURL=attendance.controller.js.map