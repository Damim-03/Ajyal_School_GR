import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listDebtSharesService,
  cancelDebtShareService,
} from "./teacher-debt-share.service";
import { DebtShareQueryInput, CancelDebtShareInput } from "./teacher-debt-share.schema";

export const listDebtSharesController = async (req: Request, res: Response) => {
  const query = req.query as unknown as DebtShareQueryInput;

  const { shares, pagination } = await listDebtSharesService(query);

  return ApiResponse.paginated(res, shares, pagination, "Debt shares retrieved");
};

export const cancelDebtShareController = async (req: Request, res: Response) => {
  const share = await cancelDebtShareService(
    req.params.id as string,
    req.body as CancelDebtShareInput,
    req.user!.userId,
  );

  return ApiResponse.success(res, { share }, "Debt share cancelled");
};
