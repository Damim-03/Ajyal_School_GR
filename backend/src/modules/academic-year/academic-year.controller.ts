import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listAcademicYearsService,
  getAcademicYearService,
  createAcademicYearService,
  updateAcademicYearService,
  deleteAcademicYearService,
} from "./academic-year.service";
import {
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
  AcademicYearQueryInput,
} from "./academic-year.schema";

export const listAcademicYearsController = async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as AcademicYearQueryInput;

  const { academicYears, pagination } = await listAcademicYearsService(query);

  return ApiResponse.paginated(
    res,
    academicYears,
    pagination,
    "Academic years retrieved",
  );
};

export const getAcademicYearController = async (
  req: Request,
  res: Response,
) => {
  const academicYear = await getAcademicYearService(req.params.id as string);

  return ApiResponse.success(res, { academicYear }, "Academic year retrieved");
};

export const createAcademicYearController = async (
  req: Request,
  res: Response,
) => {
  const academicYear = await createAcademicYearService(
    req.body as CreateAcademicYearInput,
  );

  return ApiResponse.created(res, { academicYear }, "Academic year created");
};

export const updateAcademicYearController = async (
  req: Request,
  res: Response,
) => {
  const academicYear = await updateAcademicYearService(
    req.params.id as string,
    req.body as UpdateAcademicYearInput,
  );

  return ApiResponse.success(res, { academicYear }, "Academic year updated");
};

export const deleteAcademicYearController = async (
  req: Request,
  res: Response,
) => {
  await deleteAcademicYearService(req.params.id as string);

  return ApiResponse.success(res, null, "Academic year deleted");
};
