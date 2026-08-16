"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteStudyGroupController = exports.updateStudyGroupController = exports.createStudyGroupController = exports.getStudyGroupController = exports.listStudyGroupsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const study_group_service_1 = require("./study-group.service");
const listStudyGroupsController = async (req, res) => {
    const query = req.query;
    const { studyGroups, pagination } = await (0, study_group_service_1.listStudyGroupsService)(query);
    return api_response_1.ApiResponse.paginated(res, studyGroups, pagination, "Study groups retrieved");
};
exports.listStudyGroupsController = listStudyGroupsController;
const getStudyGroupController = async (req, res) => {
    const studyGroup = await (0, study_group_service_1.getStudyGroupService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { studyGroup }, "Study group retrieved");
};
exports.getStudyGroupController = getStudyGroupController;
const createStudyGroupController = async (req, res) => {
    const studyGroup = await (0, study_group_service_1.createStudyGroupService)(req.body);
    return api_response_1.ApiResponse.created(res, { studyGroup }, "Study group created");
};
exports.createStudyGroupController = createStudyGroupController;
const updateStudyGroupController = async (req, res) => {
    const studyGroup = await (0, study_group_service_1.updateStudyGroupService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { studyGroup }, "Study group updated");
};
exports.updateStudyGroupController = updateStudyGroupController;
const deleteStudyGroupController = async (req, res) => {
    await (0, study_group_service_1.deleteStudyGroupService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Study group deleted");
};
exports.deleteStudyGroupController = deleteStudyGroupController;
//# sourceMappingURL=study-group.controller.js.map