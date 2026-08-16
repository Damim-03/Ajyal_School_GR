"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserController = exports.updateUserController = exports.createUserController = exports.getUserController = exports.listUsersController = void 0;
const api_response_1 = require("../../core/config/api-response");
const user_service_1 = require("./user.service");
const listUsersController = async (req, res) => {
    const query = req.query;
    const { users, pagination } = await (0, user_service_1.listUsersService)(query);
    return api_response_1.ApiResponse.paginated(res, users, pagination, "Users retrieved");
};
exports.listUsersController = listUsersController;
const getUserController = async (req, res) => {
    const user = await (0, user_service_1.getUserService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { user }, "User retrieved");
};
exports.getUserController = getUserController;
const createUserController = async (req, res) => {
    const user = await (0, user_service_1.createUserService)(req.body);
    return api_response_1.ApiResponse.created(res, { user }, "User created");
};
exports.createUserController = createUserController;
const updateUserController = async (req, res) => {
    const user = await (0, user_service_1.updateUserService)(req.params.id, req.body, req.user.userId);
    return api_response_1.ApiResponse.success(res, { user }, "User updated");
};
exports.updateUserController = updateUserController;
const deleteUserController = async (req, res) => {
    await (0, user_service_1.deleteUserService)(req.params.id, req.user.userId);
    return api_response_1.ApiResponse.success(res, null, "User deleted");
};
exports.deleteUserController = deleteUserController;
//# sourceMappingURL=user.controller.js.map