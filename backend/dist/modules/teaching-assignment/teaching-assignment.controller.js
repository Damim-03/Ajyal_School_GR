"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTeachingAssignmentController = exports.updateTeachingAssignmentController = exports.createTeachingAssignmentController = exports.getTeachingAssignmentController = exports.listTeachingAssignmentsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const teaching_assignment_service_1 = require("./teaching-assignment.service");
const listTeachingAssignmentsController = async (req, res) => {
    const query = req.query;
    const { teachingAssignments, pagination } = await (0, teaching_assignment_service_1.listTeachingAssignmentsService)(query);
    return api_response_1.ApiResponse.paginated(res, teachingAssignments, pagination, "Teaching assignments retrieved");
};
exports.listTeachingAssignmentsController = listTeachingAssignmentsController;
const getTeachingAssignmentController = async (req, res) => {
    const teachingAssignment = await (0, teaching_assignment_service_1.getTeachingAssignmentService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { teachingAssignment }, "Teaching assignment retrieved");
};
exports.getTeachingAssignmentController = getTeachingAssignmentController;
const createTeachingAssignmentController = async (req, res) => {
    const teachingAssignment = await (0, teaching_assignment_service_1.createTeachingAssignmentService)(req.body);
    return api_response_1.ApiResponse.created(res, { teachingAssignment }, "Teaching assignment created");
};
exports.createTeachingAssignmentController = createTeachingAssignmentController;
const updateTeachingAssignmentController = async (req, res) => {
    const teachingAssignment = await (0, teaching_assignment_service_1.updateTeachingAssignmentService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { teachingAssignment }, "Teaching assignment updated");
};
exports.updateTeachingAssignmentController = updateTeachingAssignmentController;
const deleteTeachingAssignmentController = async (req, res) => {
    await (0, teaching_assignment_service_1.deleteTeachingAssignmentService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Teaching assignment deleted");
};
exports.deleteTeachingAssignmentController = deleteTeachingAssignmentController;
//# sourceMappingURL=teaching-assignment.controller.js.map