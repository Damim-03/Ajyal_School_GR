import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  getSchoolService,
  updateSchoolService,
  resetSchoolService,
} from "./school.service";
import type { UpdateSchoolInput, ResetSchoolInput } from "./school.schema";

// GET /api/settings/school
export const getSchoolController = async (_req: Request, res: Response) => {
  const school = await getSchoolService();

  return ApiResponse.success(res, school, "School identity retrieved");
};

// PATCH /api/settings/school
export const updateSchoolController = async (req: Request, res: Response) => {
  const school = await updateSchoolService(req.body as UpdateSchoolInput);

  return ApiResponse.success(res, school, "School identity updated");
};

// POST /api/settings/school/reset
export const resetSchoolController = async (req: Request, res: Response) => {
  const school = await resetSchoolService(req.body as ResetSchoolInput);

  return ApiResponse.success(res, school, "Settings reset to defaults");
};
