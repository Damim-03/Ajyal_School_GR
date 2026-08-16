import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listTeachingAssignmentsService,
  getTeachingAssignmentService,
  createTeachingAssignmentService,
  updateTeachingAssignmentService,
  deleteTeachingAssignmentService,
} from "./teaching-assignment.service";
import {
  CreateTeachingAssignmentInput,
  UpdateTeachingAssignmentInput,
  TeachingAssignmentQueryInput,
} from "./teaching-assignment.schema";

export const listTeachingAssignmentsController = async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as TeachingAssignmentQueryInput;

  const { teachingAssignments, pagination } =
    await listTeachingAssignmentsService(query);

  return ApiResponse.paginated(
    res,
    teachingAssignments,
    pagination,
    "Teaching assignments retrieved",
  );
};

export const getTeachingAssignmentController = async (
  req: Request,
  res: Response,
) => {
  const teachingAssignment = await getTeachingAssignmentService(
    req.params.id as string,
  );

  return ApiResponse.success(
    res,
    { teachingAssignment },
    "Teaching assignment retrieved",
  );
};

export const createTeachingAssignmentController = async (
  req: Request,
  res: Response,
) => {
  const teachingAssignment = await createTeachingAssignmentService(
    req.body as CreateTeachingAssignmentInput,
  );

  return ApiResponse.created(
    res,
    { teachingAssignment },
    "Teaching assignment created",
  );
};

export const updateTeachingAssignmentController = async (
  req: Request,
  res: Response,
) => {
  const teachingAssignment = await updateTeachingAssignmentService(
    req.params.id as string,
    req.body as UpdateTeachingAssignmentInput,
  );

  return ApiResponse.success(
    res,
    { teachingAssignment },
    "Teaching assignment updated",
  );
};

export const deleteTeachingAssignmentController = async (
  req: Request,
  res: Response,
) => {
  await deleteTeachingAssignmentService(req.params.id as string);

  return ApiResponse.success(res, null, "Teaching assignment deleted");
};
