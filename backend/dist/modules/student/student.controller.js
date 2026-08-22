"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentStatementController = exports.deleteDocumentController = exports.putDocumentController = exports.getDocumentsController = exports.deleteStudentController = exports.updateStudentController = exports.createStudentController = exports.getStudentEnrollmentsController = exports.getStudentController = exports.listStudentsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const student_service_1 = require("./student.service");
const student_statement_service_1 = require("./student-statement.service");
const document_service_1 = require("./document.service");
const listStudentsController = async (req, res) => {
    const query = req.query;
    const { students, pagination } = await (0, student_service_1.listStudentsService)(query);
    return api_response_1.ApiResponse.paginated(res, students, pagination, "Students retrieved");
};
exports.listStudentsController = listStudentsController;
const getStudentController = async (req, res) => {
    const student = await (0, student_service_1.getStudentService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { student }, "Student retrieved");
};
exports.getStudentController = getStudentController;
// GET /api/students/:id/enrollments
const getStudentEnrollmentsController = async (req, res) => {
    const query = req.query;
    const enrollments = await (0, student_service_1.getStudentEnrollmentsService)(req.params.id, query);
    return api_response_1.ApiResponse.success(res, { enrollments }, "Enrollments retrieved");
};
exports.getStudentEnrollmentsController = getStudentEnrollmentsController;
const createStudentController = async (req, res) => {
    const student = await (0, student_service_1.createStudentService)(req.body);
    return api_response_1.ApiResponse.created(res, { student }, "Student created");
};
exports.createStudentController = createStudentController;
const updateStudentController = async (req, res) => {
    const student = await (0, student_service_1.updateStudentService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { student }, "Student updated");
};
exports.updateStudentController = updateStudentController;
const deleteStudentController = async (req, res) => {
    await (0, student_service_1.deleteStudentService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Student deleted");
};
exports.deleteStudentController = deleteStudentController;
// --------------------------------------------------
// وثائق ملف الطالب
// --------------------------------------------------
// GET /api/students/:id/documents
const getDocumentsController = async (req, res) => {
    const file = await (0, document_service_1.getStudentDocumentsService)(req.params.id);
    return api_response_1.ApiResponse.success(res, file, "Documents retrieved");
};
exports.getDocumentsController = getDocumentsController;
// PUT /api/students/:id/documents/:type
const putDocumentController = async (req, res) => {
    const file = await (0, document_service_1.putStudentDocumentService)(req.params.id, req.params.type, req.body, req.user?.userId);
    return api_response_1.ApiResponse.success(res, file, "Document attached");
};
exports.putDocumentController = putDocumentController;
// DELETE /api/students/:id/documents/:type
const deleteDocumentController = async (req, res) => {
    const file = await (0, document_service_1.deleteStudentDocumentService)(req.params.id, req.params.type);
    return api_response_1.ApiResponse.success(res, file, "Document removed");
};
exports.deleteDocumentController = deleteDocumentController;
// GET /api/students/:id/statement
const getStudentStatementController = async (req, res) => {
    const statement = await (0, student_statement_service_1.getStudentStatementService)(req.params.id, req.query.academicYearId);
    return api_response_1.ApiResponse.success(res, statement, "Statement retrieved");
};
exports.getStudentStatementController = getStudentStatementController;
//# sourceMappingURL=student.controller.js.map