import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listStudyGroupsService,
  getStudyGroupService,
  createStudyGroupService,
  updateStudyGroupService,
  deleteStudyGroupService,
} from "./study-group.service";
import {
  CreateStudyGroupInput,
  UpdateStudyGroupInput,
  StudyGroupQueryInput,
} from "./study-group.schema";

export const listStudyGroupsController = async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as StudyGroupQueryInput;

  const { studyGroups, pagination } = await listStudyGroupsService(query);

  return ApiResponse.paginated(
    res,
    studyGroups,
    pagination,
    "Study groups retrieved",
  );
};

export const getStudyGroupController = async (req: Request, res: Response) => {
  const studyGroup = await getStudyGroupService(req.params.id as string);

  return ApiResponse.success(res, { studyGroup }, "Study group retrieved");
};

export const createStudyGroupController = async (
  req: Request,
  res: Response,
) => {
  const studyGroup = await createStudyGroupService(
    req.body as CreateStudyGroupInput,
  );

  return ApiResponse.created(res, { studyGroup }, "Study group created");
};

export const updateStudyGroupController = async (
  req: Request,
  res: Response,
) => {
  const studyGroup = await updateStudyGroupService(
    req.params.id as string,
    req.body as UpdateStudyGroupInput,
  );

  return ApiResponse.success(res, { studyGroup }, "Study group updated");
};

export const deleteStudyGroupController = async (
  req: Request,
  res: Response,
) => {
  await deleteStudyGroupService(req.params.id as string);

  return ApiResponse.success(res, null, "Study group deleted");
};
