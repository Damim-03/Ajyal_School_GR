import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  computeSettlementService,
  listSettlementsService,
  getSettlementService,
  confirmSettlementService,
  paySettlementService,
  cancelSettlementService,
  attachSettlementDocumentService,
  removeSettlementDocumentService,
} from "./settlement.service";
import {
  settlementEstimateService,
  dailyClearanceService,
} from "./settlement.report.service";
import {
  ComputeSettlementInput,
  ConfirmSettlementInput,
  CancelSettlementInput,
  SettlementQueryInput,
  AttachDocumentInput,
  EstimateQueryInput,
  DailyClearanceQueryInput,
} from "./settlement.schema";

export const listSettlementsController = async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as SettlementQueryInput;

  const { settlements, pagination } = await listSettlementsService(query);

  return ApiResponse.paginated(
    res,
    settlements,
    pagination,
    "Settlements retrieved",
  );
};

export const getSettlementController = async (req: Request, res: Response) => {
  const settlement = await getSettlementService(req.params.id as string);

  return ApiResponse.success(res, { settlement }, "Settlement retrieved");
};

export const computeSettlementController = async (
  req: Request,
  res: Response,
) => {
  const settlement = await computeSettlementService(
    req.body as ComputeSettlementInput,
    req.user?.userId,
  );

  return ApiResponse.created(res, { settlement }, "Settlement computed");
};

export const confirmSettlementController = async (
  req: Request,
  res: Response,
) => {
  const settlement = await confirmSettlementService(
    req.params.id as string,
    req.body as ConfirmSettlementInput,
    req.user!.userId,
  );

  return ApiResponse.success(res, { settlement }, "Settlement confirmed");
};

export const paySettlementController = async (req: Request, res: Response) => {
  const settlement = await paySettlementService(
    req.params.id as string,
    req.user!.userId,
  );

  return ApiResponse.success(res, { settlement }, "Settlement marked paid");
};

export const cancelSettlementController = async (
  req: Request,
  res: Response,
) => {
  const settlement = await cancelSettlementService(
    req.params.id as string,
    req.body as CancelSettlementInput,
    req.user!.userId,
  );

  return ApiResponse.success(res, { settlement }, "Settlement cancelled");
};

// --------------------------------------------------
// الأوراق الموقَّعة
// --------------------------------------------------

export const attachSettlementDocumentController = async (
  req: Request,
  res: Response,
) => {
  const document = await attachSettlementDocumentService(
    req.params.id as string,
    req.body as AttachDocumentInput,
    req.user!.userId,
  );

  return ApiResponse.created(res, { document }, "Document attached");
};

export const removeSettlementDocumentController = async (
  req: Request,
  res: Response,
) => {
  const removed = await removeSettlementDocumentService(
    req.params.documentId as string,
  );

  return ApiResponse.success(res, removed, "Document removed");
};

// --------------------------------------------------
// الكشفان
// --------------------------------------------------

export const settlementEstimateController = async (
  req: Request,
  res: Response,
) => {
  const estimate = await settlementEstimateService(
    req.query as unknown as EstimateQueryInput,
  );

  return ApiResponse.success(res, estimate, "Settlement estimate retrieved");
};

export const dailyClearanceController = async (
  req: Request,
  res: Response,
) => {
  const report = await dailyClearanceService(
    req.query as unknown as DailyClearanceQueryInput,
  );

  return ApiResponse.success(res, report, "Daily clearance retrieved");
};
