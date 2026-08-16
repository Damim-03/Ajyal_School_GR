import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listSheetsService,
  getSheetService,
  createSheetService,
  updateSheetService,
  deleteSheetService,
} from "./attendance-sheet.service";
import {
  CreateSheetInput,
  UpdateSheetInput,
  SheetQueryInput,
} from "./attendance-sheet.schema";

export const listSheetsController = async (req: Request, res: Response) => {
  const query = req.query as unknown as SheetQueryInput;

  const { sheets, pagination } = await listSheetsService(query);

  return ApiResponse.paginated(res, sheets, pagination, "Sheets retrieved");
};

export const getSheetController = async (req: Request, res: Response) => {
  const sheet = await getSheetService(req.params.id as string);

  return ApiResponse.success(res, { sheet }, "Sheet retrieved");
};

export const createSheetController = async (req: Request, res: Response) => {
  const sheet = await createSheetService(req.body as CreateSheetInput);

  return ApiResponse.created(res, { sheet }, "Sheet created");
};

export const updateSheetController = async (req: Request, res: Response) => {
  const sheet = await updateSheetService(
    req.params.id as string,
    req.body as UpdateSheetInput,
  );

  return ApiResponse.success(res, { sheet }, "Sheet updated");
};

export const deleteSheetController = async (req: Request, res: Response) => {
  const result = await deleteSheetService(req.params.id as string);

  return ApiResponse.success(res, result, "Sheet deleted");
};
