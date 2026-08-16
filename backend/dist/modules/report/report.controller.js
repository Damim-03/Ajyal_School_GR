"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expectedSessionsReportController = exports.sessionClearanceReportController = exports.monthlyFeesReportController = exports.dailyAttendanceReportController = exports.attendanceReportController = exports.outstandingReportController = exports.financialReportController = exports.dashboardReportController = void 0;
const api_response_1 = require("../../core/config/api-response");
const report_service_1 = require("./report.service");
const dashboardReportController = async (_req, res) => {
    const report = await (0, report_service_1.dashboardReportService)();
    return api_response_1.ApiResponse.success(res, report, "Dashboard retrieved");
};
exports.dashboardReportController = dashboardReportController;
const financialReportController = async (req, res) => {
    const report = await (0, report_service_1.financialReportService)(req.query);
    return api_response_1.ApiResponse.success(res, report, "Financial report retrieved");
};
exports.financialReportController = financialReportController;
const outstandingReportController = async (req, res) => {
    const report = await (0, report_service_1.outstandingReportService)(req.query);
    return api_response_1.ApiResponse.success(res, report, "Outstanding report retrieved");
};
exports.outstandingReportController = outstandingReportController;
const attendanceReportController = async (req, res) => {
    const report = await (0, report_service_1.attendanceReportService)(req.query);
    return api_response_1.ApiResponse.success(res, report, "Attendance report retrieved");
};
exports.attendanceReportController = attendanceReportController;
const dailyAttendanceReportController = async (req, res) => {
    const report = await (0, report_service_1.dailyAttendanceReportService)(req.query);
    return api_response_1.ApiResponse.success(res, report, "Daily attendance sheet retrieved");
};
exports.dailyAttendanceReportController = dailyAttendanceReportController;
const monthlyFeesReportController = async (req, res) => {
    const report = await (0, report_service_1.monthlyFeesReportService)(req.query);
    return api_response_1.ApiResponse.success(res, report, "Monthly fees sheet retrieved");
};
exports.monthlyFeesReportController = monthlyFeesReportController;
const sessionClearanceReportController = async (req, res) => {
    const report = await (0, report_service_1.sessionClearanceReportService)(req.query);
    return api_response_1.ApiResponse.success(res, report, "Session clearance sheet retrieved");
};
exports.sessionClearanceReportController = sessionClearanceReportController;
const expectedSessionsReportController = async (req, res) => {
    const report = await (0, report_service_1.expectedSessionsReportService)(req.query);
    return api_response_1.ApiResponse.success(res, report, "Expected sessions sheet retrieved");
};
exports.expectedSessionsReportController = expectedSessionsReportController;
//# sourceMappingURL=report.controller.js.map