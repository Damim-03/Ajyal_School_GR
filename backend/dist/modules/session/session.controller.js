"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSessionController = exports.updateSessionController = exports.generateSessionsController = exports.createSessionController = exports.getSessionController = exports.listSessionsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const session_service_1 = require("./session.service");
const listSessionsController = async (req, res) => {
    const query = req.query;
    const { sessions, pagination } = await (0, session_service_1.listSessionsService)(query);
    return api_response_1.ApiResponse.paginated(res, sessions, pagination, "Sessions retrieved");
};
exports.listSessionsController = listSessionsController;
const getSessionController = async (req, res) => {
    const session = await (0, session_service_1.getSessionService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { session }, "Session retrieved");
};
exports.getSessionController = getSessionController;
const createSessionController = async (req, res) => {
    const session = await (0, session_service_1.createSessionService)(req.body);
    return api_response_1.ApiResponse.created(res, { session }, "Session created");
};
exports.createSessionController = createSessionController;
// POST /api/sessions/generate
const generateSessionsController = async (req, res) => {
    const result = await (0, session_service_1.generateSessionsService)(req.body);
    return api_response_1.ApiResponse.created(res, result, `${result.created} session(s) generated`);
};
exports.generateSessionsController = generateSessionsController;
const updateSessionController = async (req, res) => {
    const session = await (0, session_service_1.updateSessionService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { session }, "Session updated");
};
exports.updateSessionController = updateSessionController;
const deleteSessionController = async (req, res) => {
    await (0, session_service_1.deleteSessionService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Session deleted");
};
exports.deleteSessionController = deleteSessionController;
//# sourceMappingURL=session.controller.js.map