import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listClassroomsService,
  getClassroomService,
  createClassroomService,
  updateClassroomService,
  deleteClassroomService,
} from "./classroom.service";
import {
  CreateClassroomInput,
  UpdateClassroomInput,
  ClassroomQueryInput,
} from "./classroom.schema";

export const listClassroomsController = async (req: Request, res: Response) => {
  const query = req.query as unknown as ClassroomQueryInput;

  const { classrooms, pagination } = await listClassroomsService(query);

  return ApiResponse.paginated(
    res,
    classrooms,
    pagination,
    "Classrooms retrieved",
  );
};

export const getClassroomController = async (req: Request, res: Response) => {
  const classroom = await getClassroomService(req.params.id as string);

  return ApiResponse.success(res, { classroom }, "Classroom retrieved");
};

export const createClassroomController = async (
  req: Request,
  res: Response,
) => {
  const classroom = await createClassroomService(
    req.body as CreateClassroomInput,
  );

  return ApiResponse.created(res, { classroom }, "Classroom created");
};

export const updateClassroomController = async (
  req: Request,
  res: Response,
) => {
  const classroom = await updateClassroomService(
    req.params.id as string,
    req.body as UpdateClassroomInput,
  );

  return ApiResponse.success(res, { classroom }, "Classroom updated");
};

export const deleteClassroomController = async (
  req: Request,
  res: Response,
) => {
  await deleteClassroomService(req.params.id as string);

  return ApiResponse.success(res, null, "Classroom deleted");
};
