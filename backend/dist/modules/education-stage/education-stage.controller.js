"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEducationStageController = exports.updateEducationStageController = exports.createEducationStageController = exports.getEducationStageController = exports.listEducationStagesController = void 0;
const api_response_1 = require("../../core/config/api-response");
const education_stage_service_1 = require("./education-stage.service");
const listEducationStagesController = async (req, res) => {
    const query = req.query;
    const { educationStages, pagination } = await (0, education_stage_service_1.listEducationStagesService)(query);
    return api_response_1.ApiResponse.paginated(res, educationStages, pagination, "Education stages retrieved");
};
exports.listEducationStagesController = listEducationStagesController;
const getEducationStageController = async (req, res) => {
    const educationStage = await (0, education_stage_service_1.getEducationStageService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { educationStage }, "Education stage retrieved");
};
exports.getEducationStageController = getEducationStageController;
const createEducationStageController = async (req, res) => {
    const educationStage = await (0, education_stage_service_1.createEducationStageService)(req.body);
    return api_response_1.ApiResponse.created(res, { educationStage }, "Education stage created");
};
exports.createEducationStageController = createEducationStageController;
const updateEducationStageController = async (req, res) => {
    const educationStage = await (0, education_stage_service_1.updateEducationStageService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { educationStage }, "Education stage updated");
};
exports.updateEducationStageController = updateEducationStageController;
const deleteEducationStageController = async (req, res) => {
    await (0, education_stage_service_1.deleteEducationStageService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Education stage deleted");
};
exports.deleteEducationStageController = deleteEducationStageController;
//# sourceMappingURL=education-stage.controller.js.map