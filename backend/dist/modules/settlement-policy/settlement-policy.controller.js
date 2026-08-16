"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSettlementPolicyController = exports.updateSettlementPolicyController = exports.createSettlementPolicyController = exports.getSettlementPolicyController = exports.listSettlementPoliciesController = void 0;
const api_response_1 = require("../../core/config/api-response");
const settlement_policy_service_1 = require("./settlement-policy.service");
const listSettlementPoliciesController = async (req, res) => {
    const query = req.query;
    const { settlementPolicies, pagination } = await (0, settlement_policy_service_1.listSettlementPoliciesService)(query);
    return api_response_1.ApiResponse.paginated(res, settlementPolicies, pagination, "Settlement policies retrieved");
};
exports.listSettlementPoliciesController = listSettlementPoliciesController;
const getSettlementPolicyController = async (req, res) => {
    const settlementPolicy = await (0, settlement_policy_service_1.getSettlementPolicyService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { settlementPolicy }, "Settlement policy retrieved");
};
exports.getSettlementPolicyController = getSettlementPolicyController;
const createSettlementPolicyController = async (req, res) => {
    const settlementPolicy = await (0, settlement_policy_service_1.createSettlementPolicyService)(req.body, req.user?.userId);
    return api_response_1.ApiResponse.created(res, { settlementPolicy }, "Settlement policy created");
};
exports.createSettlementPolicyController = createSettlementPolicyController;
const updateSettlementPolicyController = async (req, res) => {
    const settlementPolicy = await (0, settlement_policy_service_1.updateSettlementPolicyService)(req.params.id, req.body, req.user?.userId);
    return api_response_1.ApiResponse.success(res, { settlementPolicy }, "Settlement policy updated");
};
exports.updateSettlementPolicyController = updateSettlementPolicyController;
const deleteSettlementPolicyController = async (req, res) => {
    await (0, settlement_policy_service_1.deleteSettlementPolicyService)(req.params.id, req.user?.userId);
    return api_response_1.ApiResponse.success(res, null, "Settlement policy deleted");
};
exports.deleteSettlementPolicyController = deleteSettlementPolicyController;
//# sourceMappingURL=settlement-policy.controller.js.map