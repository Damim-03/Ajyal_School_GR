"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteScheduleController = exports.updateScheduleController = exports.createScheduleController = exports.getScheduleController = exports.listSchedulesController = void 0;
const api_response_1 = require("../../core/config/api-response");
const schedule_service_1 = require("./schedule.service");
const listSchedulesController = async (req, res) => {
    const query = req.query;
    const { schedules, pagination } = await (0, schedule_service_1.listSchedulesService)(query);
    return api_response_1.ApiResponse.paginated(res, schedules, pagination, "Schedules retrieved");
};
exports.listSchedulesController = listSchedulesController;
const getScheduleController = async (req, res) => {
    const schedule = await (0, schedule_service_1.getScheduleService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { schedule }, "Schedule retrieved");
};
exports.getScheduleController = getScheduleController;
const createScheduleController = async (req, res) => {
    const schedule = await (0, schedule_service_1.createScheduleService)(req.body);
    return api_response_1.ApiResponse.created(res, { schedule }, "Schedule created");
};
exports.createScheduleController = createScheduleController;
const updateScheduleController = async (req, res) => {
    const schedule = await (0, schedule_service_1.updateScheduleService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { schedule }, "Schedule updated");
};
exports.updateScheduleController = updateScheduleController;
const deleteScheduleController = async (req, res) => {
    await (0, schedule_service_1.deleteScheduleService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Schedule deleted");
};
exports.deleteScheduleController = deleteScheduleController;
//# sourceMappingURL=schedule.controller.js.map