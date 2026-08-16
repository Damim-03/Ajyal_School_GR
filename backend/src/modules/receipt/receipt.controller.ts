import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listReceiptsService,
  getReceiptService,
  printReceiptService,
  cancelReceiptService,
} from "./receipt.service";
import { ReceiptQueryInput, CancelReceiptInput } from "./receipt.schema";

export const listReceiptsController = async (req: Request, res: Response) => {
  const query = req.query as unknown as ReceiptQueryInput;

  const { receipts, pagination } = await listReceiptsService(query);

  return ApiResponse.paginated(res, receipts, pagination, "Receipts retrieved");
};

export const getReceiptController = async (req: Request, res: Response) => {
  const receipt = await getReceiptService(req.params.id as string);

  return ApiResponse.success(res, { receipt }, "Receipt retrieved");
};

// POST /api/receipts/:id/print
export const printReceiptController = async (req: Request, res: Response) => {
  const receipt = await printReceiptService(
    req.params.id as string,
    req.user!.userId,
    false,
  );

  return ApiResponse.success(res, { receipt }, "Receipt marked as printed");
};

// POST /api/receipts/:id/reprint
export const reprintReceiptController = async (req: Request, res: Response) => {
  const receipt = await printReceiptService(
    req.params.id as string,
    req.user!.userId,
    true,
  );

  return ApiResponse.success(res, { receipt }, "Receipt reprinted");
};

// POST /api/receipts/:id/cancel
export const cancelReceiptController = async (req: Request, res: Response) => {
  const receipt = await cancelReceiptService(
    req.params.id as string,
    req.body as CancelReceiptInput,
    req.user!.userId,
  );

  return ApiResponse.success(res, { receipt }, "Receipt cancelled");
};
