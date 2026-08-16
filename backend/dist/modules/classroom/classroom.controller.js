"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteClassroomController = exports.updateClassroomController = exports.createClassroomController = exports.getClassroomController = exports.listClassroomsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const classroom_service_1 = require("./classroom.service");
const listClassroomsController = async (req, res) => {
    const query = req.query;
    const { classrooms, pagination } = await (0, classroom_service_1.listClassroomsService)(query);
    return api_response_1.ApiResponse.paginated(res, classrooms, pagination, "Classrooms retrieved");
};
exports.listClassroomsController = listClassroomsController;
const getClassroomController = async (req, res) => {
    const classroom = await (0, classroom_service_1.getClassroomService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { classroom }, "Classroom retrieved");
};
exports.getClassroomController = getClassroomController;
const createClassroomController = async (req, res) => {
    const classroom = await (0, classroom_service_1.createClassroomService)(req.body);
    return api_response_1.ApiResponse.created(res, { classroom }, "Classroom created");
};
exports.createClassroomController = createClassroomController;
const updateClassroomController = async (req, res) => {
    const classroom = await (0, classroom_service_1.updateClassroomService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { classroom }, "Classroom updated");
};
exports.updateClassroomController = updateClassroomController;
const deleteClassroomController = async (req, res) => {
    await (0, classroom_service_1.deleteClassroomService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Classroom deleted");
};
exports.deleteClassroomController = deleteClassroomController;
//# sourceMappingURL=classroom.controller.js.map