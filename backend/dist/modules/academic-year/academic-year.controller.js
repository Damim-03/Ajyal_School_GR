"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAcademicYearController = exports.updateAcademicYearController = exports.createAcademicYearController = exports.getAcademicYearController = exports.listAcademicYearsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const academic_year_service_1 = require("./academic-year.service");
const listAcademicYearsController = async (req, res) => {
    const query = req.query;
    const { academicYears, pagination } = await (0, academic_year_service_1.listAcademicYearsService)(query);
    return api_response_1.ApiResponse.paginated(res, academicYears, pagination, "Academic years retrieved");
};
exports.listAcademicYearsController = listAcademicYearsController;
const getAcademicYearController = async (req, res) => {
    const academicYear = await (0, academic_year_service_1.getAcademicYearService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { academicYear }, "Academic year retrieved");
};
exports.getAcademicYearController = getAcademicYearController;
const createAcademicYearController = async (req, res) => {
    const academicYear = await (0, academic_year_service_1.createAcademicYearService)(req.body);
    return api_response_1.ApiResponse.created(res, { academicYear }, "Academic year created");
};
exports.createAcademicYearController = createAcademicYearController;
const updateAcademicYearController = async (req, res) => {
    const academicYear = await (0, academic_year_service_1.updateAcademicYearService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { academicYear }, "Academic year updated");
};
exports.updateAcademicYearController = updateAcademicYearController;
const deleteAcademicYearController = async (req, res) => {
    await (0, academic_year_service_1.deleteAcademicYearService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Academic year deleted");
};
exports.deleteAcademicYearController = deleteAcademicYearController;
//# sourceMappingURL=academic-year.controller.js.map