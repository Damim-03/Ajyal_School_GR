import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listLevelsService,
  getLevelService,
  createLevelService,
  updateLevelService,
  deleteLevelService,
} from "./level.service";
import {
  CreateLevelInput,
  UpdateLevelInput,
  LevelQueryInput,
} from "./level.schema";

export const listLevelsController = async (req: Request, res: Response) => {
  const query = req.query as unknown as LevelQueryInput;

  const { levels, pagination } = await listLevelsService(query);

  return ApiResponse.paginated(res, levels, pagination, "Levels retrieved");
};

export const getLevelController = async (req: Request, res: Response) => {
  const level = await getLevelService(req.params.id as string);

  return ApiResponse.success(res, { level }, "Level retrieved");
};

export const createLevelController = async (req: Request, res: Response) => {
  const level = await createLevelService(req.body as CreateLevelInput);

  return ApiResponse.created(res, { level }, "Level created");
};

export const updateLevelController = async (req: Request, res: Response) => {
  const level = await updateLevelService(
    req.params.id as string,
    req.body as UpdateLevelInput,
  );

  return ApiResponse.success(res, { level }, "Level updated");
};

export const deleteLevelController = async (req: Request, res: Response) => {
  await deleteLevelService(req.params.id as string);

  return ApiResponse.success(res, null, "Level deleted");
};
