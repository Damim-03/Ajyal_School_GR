import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listSettlementPoliciesService,
  getSettlementPolicyService,
  createSettlementPolicyService,
  updateSettlementPolicyService,
  deleteSettlementPolicyService,
} from "./settlement-policy.service";
import {
  CreateSettlementPolicyInput,
  UpdateSettlementPolicyInput,
  SettlementPolicyQueryInput,
} from "./settlement-policy.schema";

export const listSettlementPoliciesController = async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as SettlementPolicyQueryInput;

  const { settlementPolicies, pagination } =
    await listSettlementPoliciesService(query);

  return ApiResponse.paginated(
    res,
    settlementPolicies,
    pagination,
    "Settlement policies retrieved",
  );
};

export const getSettlementPolicyController = async (
  req: Request,
  res: Response,
) => {
  const settlementPolicy = await getSettlementPolicyService(
    req.params.id as string,
  );

  return ApiResponse.success(
    res,
    { settlementPolicy },
    "Settlement policy retrieved",
  );
};

export const createSettlementPolicyController = async (
  req: Request,
  res: Response,
) => {
  const settlementPolicy = await createSettlementPolicyService(
    req.body as CreateSettlementPolicyInput,
    req.user?.userId,
  );

  return ApiResponse.created(
    res,
    { settlementPolicy },
    "Settlement policy created",
  );
};

export const updateSettlementPolicyController = async (
  req: Request,
  res: Response,
) => {
  const settlementPolicy = await updateSettlementPolicyService(
    req.params.id as string,
    req.body as UpdateSettlementPolicyInput,
    req.user?.userId,
  );

  return ApiResponse.success(
    res,
    { settlementPolicy },
    "Settlement policy updated",
  );
};

export const deleteSettlementPolicyController = async (
  req: Request,
  res: Response,
) => {
  await deleteSettlementPolicyService(req.params.id as string, req.user?.userId);

  return ApiResponse.success(res, null, "Settlement policy deleted");
};
