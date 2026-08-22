import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listTeachersService,
  getTeacherService,
  createTeacherService,
  updateTeacherService,
  deleteTeacherService,
} from "./teacher.service";
import { getTeacherStatementService } from "./teacher-statement.service";
import {
  CreateTeacherInput,
  UpdateTeacherInput,
  TeacherQueryInput,
} from "./teacher.schema";

export const listTeachersController = async (req: Request, res: Response) => {
  const query = req.query as unknown as TeacherQueryInput;

  const { teachers, pagination } = await listTeachersService(query);

  return ApiResponse.paginated(res, teachers, pagination, "Teachers retrieved");
};

export const getTeacherController = async (req: Request, res: Response) => {
  const teacher = await getTeacherService(req.params.id as string);

  return ApiResponse.success(res, { teacher }, "Teacher retrieved");
};

export const createTeacherController = async (req: Request, res: Response) => {
  const teacher = await createTeacherService(req.body as CreateTeacherInput);

  return ApiResponse.created(res, { teacher }, "Teacher created");
};

export const updateTeacherController = async (req: Request, res: Response) => {
  const teacher = await updateTeacherService(
    req.params.id as string,
    req.body as UpdateTeacherInput,
  );

  return ApiResponse.success(res, { teacher }, "Teacher updated");
};

export const deleteTeacherController = async (req: Request, res: Response) => {
  await deleteTeacherService(req.params.id as string);

  return ApiResponse.success(res, null, "Teacher deleted");
};

// GET /api/teachers/:id/statement
export const getTeacherStatementController = async (
  req: Request,
  res: Response,
) => {
  const statement = await getTeacherStatementService(
    req.params.id as string,
    (req.query as { academicYearId: string }).academicYearId,
  );

  return ApiResponse.success(res, statement, "Statement retrieved");
};
