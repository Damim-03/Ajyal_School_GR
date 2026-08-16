"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSubjectController = exports.updateSubjectController = exports.createSubjectController = exports.getSubjectController = exports.listSubjectsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const subject_service_1 = require("./subject.service");
// --------------------------------------------------
// GET /api/settings/subjects
// --------------------------------------------------
const listSubjectsController = async (req, res) => {
    const query = req.query;
    const { subjects, pagination } = await (0, subject_service_1.listSubjectsService)(query);
    return api_response_1.ApiResponse.paginated(res, subjects, pagination, "Subjects retrieved");
};
exports.listSubjectsController = listSubjectsController;
// --------------------------------------------------
// GET /api/settings/subjects/:id
// --------------------------------------------------
const getSubjectController = async (req, res) => {
    const subject = await (0, subject_service_1.getSubjectService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { subject }, "Subject retrieved");
};
exports.getSubjectController = getSubjectController;
// --------------------------------------------------
// POST /api/settings/subjects
// --------------------------------------------------
const createSubjectController = async (req, res) => {
    const subject = await (0, subject_service_1.createSubjectService)(req.body);
    return api_response_1.ApiResponse.created(res, { subject }, "Subject created");
};
exports.createSubjectController = createSubjectController;
// --------------------------------------------------
// PATCH /api/settings/subjects/:id
// --------------------------------------------------
const updateSubjectController = async (req, res) => {
    const subject = await (0, subject_service_1.updateSubjectService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { subject }, "Subject updated");
};
exports.updateSubjectController = updateSubjectController;
// --------------------------------------------------
// DELETE /api/settings/subjects/:id
// --------------------------------------------------
const deleteSubjectController = async (req, res) => {
    await (0, subject_service_1.deleteSubjectService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Subject deleted");
};
exports.deleteSubjectController = deleteSubjectController;
//# sourceMappingURL=subject.controller.js.map