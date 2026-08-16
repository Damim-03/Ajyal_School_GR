"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetSchoolController = exports.updateSchoolController = exports.getSchoolController = void 0;
const api_response_1 = require("../../core/config/api-response");
const school_service_1 = require("./school.service");
// GET /api/settings/school
const getSchoolController = async (_req, res) => {
    const school = await (0, school_service_1.getSchoolService)();
    return api_response_1.ApiResponse.success(res, school, "School identity retrieved");
};
exports.getSchoolController = getSchoolController;
// PATCH /api/settings/school
const updateSchoolController = async (req, res) => {
    const school = await (0, school_service_1.updateSchoolService)(req.body);
    return api_response_1.ApiResponse.success(res, school, "School identity updated");
};
exports.updateSchoolController = updateSchoolController;
// POST /api/settings/school/reset
const resetSchoolController = async (req, res) => {
    const school = await (0, school_service_1.resetSchoolService)(req.body);
    return api_response_1.ApiResponse.success(res, school, "Settings reset to defaults");
};
exports.resetSchoolController = resetSchoolController;
//# sourceMappingURL=school.controller.js.map