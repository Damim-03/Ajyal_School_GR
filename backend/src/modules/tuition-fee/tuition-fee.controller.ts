import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listTuitionFeesService,
  getTuitionFeeService,
  createTuitionFeeService,
  updateTuitionFeeService,
  deleteTuitionFeeService,
} from "./tuition-fee.service";
import {
  CreateTuitionFeeInput,
  UpdateTuitionFeeInput,
  TuitionFeeQueryInput,
} from "./tuition-fee.schema";

export const listTuitionFeesController = async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as TuitionFeeQueryInput;

  const { tuitionFees, pagination } = await listTuitionFeesService(query);

  return ApiResponse.paginated(
    res,
    tuitionFees,
    pagination,
    "Tuition fees retrieved",
  );
};

export const getTuitionFeeController = async (req: Request, res: Response) => {
  const tuitionFee = await getTuitionFeeService(req.params.id as string);

  return ApiResponse.success(res, { tuitionFee }, "Tuition fee retrieved");
};

export const createTuitionFeeController = async (
  req: Request,
  res: Response,
) => {
  const tuitionFee = await createTuitionFeeService(
    req.body as CreateTuitionFeeInput,
  );

  return ApiResponse.created(res, { tuitionFee }, "Tuition fee created");
};

export const updateTuitionFeeController = async (
  req: Request,
  res: Response,
) => {
  const tuitionFee = await updateTuitionFeeService(
    req.params.id as string,
    req.body as UpdateTuitionFeeInput,
  );

  return ApiResponse.success(res, { tuitionFee }, "Tuition fee updated");
};

export const deleteTuitionFeeController = async (
  req: Request,
  res: Response,
) => {
  await deleteTuitionFeeService(req.params.id as string);

  return ApiResponse.success(res, null, "Tuition fee deleted");
};
