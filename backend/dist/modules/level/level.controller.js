"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLevelController = exports.updateLevelController = exports.createLevelController = exports.getLevelController = exports.listLevelsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const level_service_1 = require("./level.service");
const listLevelsController = async (req, res) => {
    const query = req.query;
    const { levels, pagination } = await (0, level_service_1.listLevelsService)(query);
    return api_response_1.ApiResponse.paginated(res, levels, pagination, "Levels retrieved");
};
exports.listLevelsController = listLevelsController;
const getLevelController = async (req, res) => {
    const level = await (0, level_service_1.getLevelService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { level }, "Level retrieved");
};
exports.getLevelController = getLevelController;
const createLevelController = async (req, res) => {
    const level = await (0, level_service_1.createLevelService)(req.body);
    return api_response_1.ApiResponse.created(res, { level }, "Level created");
};
exports.createLevelController = createLevelController;
const updateLevelController = async (req, res) => {
    const level = await (0, level_service_1.updateLevelService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { level }, "Level updated");
};
exports.updateLevelController = updateLevelController;
const deleteLevelController = async (req, res) => {
    await (0, level_service_1.deleteLevelService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Level deleted");
};
exports.deleteLevelController = deleteLevelController;
//# sourceMappingURL=level.controller.js.map