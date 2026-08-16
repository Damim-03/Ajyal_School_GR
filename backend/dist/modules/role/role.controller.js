"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPermissionsController = exports.deleteRoleController = exports.setRolePermissionsController = exports.updateRoleController = exports.createRoleController = exports.getRoleController = exports.listRolesController = void 0;
const api_response_1 = require("../../core/config/api-response");
const role_service_1 = require("./role.service");
const listRolesController = async (req, res) => {
    const query = req.query;
    const { roles, pagination } = await (0, role_service_1.listRolesService)(query);
    return api_response_1.ApiResponse.paginated(res, roles, pagination, "Roles retrieved");
};
exports.listRolesController = listRolesController;
const getRoleController = async (req, res) => {
    const role = await (0, role_service_1.getRoleService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { role }, "Role retrieved");
};
exports.getRoleController = getRoleController;
const createRoleController = async (req, res) => {
    const role = await (0, role_service_1.createRoleService)(req.body);
    return api_response_1.ApiResponse.created(res, { role }, "Role created");
};
exports.createRoleController = createRoleController;
const updateRoleController = async (req, res) => {
    const role = await (0, role_service_1.updateRoleService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { role }, "Role updated");
};
exports.updateRoleController = updateRoleController;
// PUT /api/roles/:id/permissions
const setRolePermissionsController = async (req, res) => {
    const role = await (0, role_service_1.setRolePermissionsService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { role }, "Permissions updated");
};
exports.setRolePermissionsController = setRolePermissionsController;
const deleteRoleController = async (req, res) => {
    await (0, role_service_1.deleteRoleService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Role deleted");
};
exports.deleteRoleController = deleteRoleController;
// GET /api/permissions
const listPermissionsController = async (req, res) => {
    const query = req.query;
    const result = await (0, role_service_1.listPermissionsService)(query);
    return api_response_1.ApiResponse.success(res, result, "Permissions retrieved");
};
exports.listPermissionsController = listPermissionsController;
//# sourceMappingURL=role.controller.js.map