"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTeacherDocumentController = exports.putTeacherDocumentController = exports.getTeacherDocumentsController = exports.getTeacherStatementController = exports.deleteTeacherController = exports.updateTeacherController = exports.createTeacherController = exports.getTeacherController = exports.listTeachersController = void 0;
const api_response_1 = require("../../core/config/api-response");
const teacher_service_1 = require("./teacher.service");
const teacher_statement_service_1 = require("./teacher-statement.service");
const document_service_1 = require("./document.service");
const listTeachersController = async (req, res) => {
    const query = req.query;
    const { teachers, pagination } = await (0, teacher_service_1.listTeachersService)(query);
    return api_response_1.ApiResponse.paginated(res, teachers, pagination, "Teachers retrieved");
};
exports.listTeachersController = listTeachersController;
const getTeacherController = async (req, res) => {
    const teacher = await (0, teacher_service_1.getTeacherService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { teacher }, "Teacher retrieved");
};
exports.getTeacherController = getTeacherController;
const createTeacherController = async (req, res) => {
    const teacher = await (0, teacher_service_1.createTeacherService)(req.body);
    return api_response_1.ApiResponse.created(res, { teacher }, "Teacher created");
};
exports.createTeacherController = createTeacherController;
const updateTeacherController = async (req, res) => {
    const teacher = await (0, teacher_service_1.updateTeacherService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { teacher }, "Teacher updated");
};
exports.updateTeacherController = updateTeacherController;
const deleteTeacherController = async (req, res) => {
    await (0, teacher_service_1.deleteTeacherService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Teacher deleted");
};
exports.deleteTeacherController = deleteTeacherController;
// GET /api/teachers/:id/statement
const getTeacherStatementController = async (req, res) => {
    const statement = await (0, teacher_statement_service_1.getTeacherStatementService)(req.params.id, req.query.academicYearId);
    return api_response_1.ApiResponse.success(res, statement, "Statement retrieved");
};
exports.getTeacherStatementController = getTeacherStatementController;
// --------------------------------------------------
// وثائق ملفّ الأستاذ
// --------------------------------------------------
// GET /api/teachers/:id/documents
const getTeacherDocumentsController = async (req, res) => {
    const file = await (0, document_service_1.getTeacherDocumentsService)(req.params.id);
    return api_response_1.ApiResponse.success(res, file, "Documents retrieved");
};
exports.getTeacherDocumentsController = getTeacherDocumentsController;
// PUT /api/teachers/:id/documents/:type
const putTeacherDocumentController = async (req, res) => {
    const file = await (0, document_service_1.putTeacherDocumentService)(req.params.id, req.params.type, req.body, req.user?.userId);
    return api_response_1.ApiResponse.success(res, file, "Document attached");
};
exports.putTeacherDocumentController = putTeacherDocumentController;
// DELETE /api/teachers/:id/documents/:type
const deleteTeacherDocumentController = async (req, res) => {
    const file = await (0, document_service_1.deleteTeacherDocumentService)(req.params.id, req.params.type);
    return api_response_1.ApiResponse.success(res, file, "Document removed");
};
exports.deleteTeacherDocumentController = deleteTeacherDocumentController;
//# sourceMappingURL=teacher.controller.js.map