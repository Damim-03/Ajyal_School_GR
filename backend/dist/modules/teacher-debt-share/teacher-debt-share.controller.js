"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelDebtShareController = exports.listDebtSharesController = void 0;
const api_response_1 = require("../../core/config/api-response");
const teacher_debt_share_service_1 = require("./teacher-debt-share.service");
const listDebtSharesController = async (req, res) => {
    const query = req.query;
    const { shares, pagination } = await (0, teacher_debt_share_service_1.listDebtSharesService)(query);
    return api_response_1.ApiResponse.paginated(res, shares, pagination, "Debt shares retrieved");
};
exports.listDebtSharesController = listDebtSharesController;
const cancelDebtShareController = async (req, res) => {
    const share = await (0, teacher_debt_share_service_1.cancelDebtShareService)(req.params.id, req.body, req.user.userId);
    return api_response_1.ApiResponse.success(res, { share }, "Debt share cancelled");
};
exports.cancelDebtShareController = cancelDebtShareController;
//# sourceMappingURL=teacher-debt-share.controller.js.map