import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listEducationStagesService,
  getEducationStageService,
  createEducationStageService,
  updateEducationStageService,
  deleteEducationStageService,
} from "./education-stage.service";
import {
  CreateEducationStageInput,
  UpdateEducationStageInput,
  EducationStageQueryInput,
} from "./education-stage.schema";

export const listEducationStagesController = async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as EducationStageQueryInput;

  const { educationStages, pagination } =
    await listEducationStagesService(query);

  return ApiResponse.paginated(
    res,
    educationStages,
    pagination,
    "Education stages retrieved",
  );
};

export const getEducationStageController = async (
  req: Request,
  res: Response,
) => {
  const educationStage = await getEducationStageService(
    req.params.id as string,
  );

  return ApiResponse.success(
    res,
    { educationStage },
    "Education stage retrieved",
  );
};

export const createEducationStageController = async (
  req: Request,
  res: Response,
) => {
  const educationStage = await createEducationStageService(
    req.body as CreateEducationStageInput,
  );

  return ApiResponse.created(
    res,
    { educationStage },
    "Education stage created",
  );
};

export const updateEducationStageController = async (
  req: Request,
  res: Response,
) => {
  const educationStage = await updateEducationStageService(
    req.params.id as string,
    req.body as UpdateEducationStageInput,
  );

  return ApiResponse.success(res, { educationStage }, "Education stage updated");
};

export const deleteEducationStageController = async (
  req: Request,
  res: Response,
) => {
  await deleteEducationStageService(req.params.id as string);

  return ApiResponse.success(res, null, "Education stage deleted");
};
