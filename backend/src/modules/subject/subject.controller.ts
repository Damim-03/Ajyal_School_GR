import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listSubjectsService,
  getSubjectService,
  createSubjectService,
  updateSubjectService,
  deleteSubjectService,
} from "./subject.service";
import {
  CreateSubjectInput,
  UpdateSubjectInput,
  SubjectQueryInput,
} from "./subject.schema";

// --------------------------------------------------
// GET /api/settings/subjects
// --------------------------------------------------

export const listSubjectsController = async (req: Request, res: Response) => {
  const query = req.query as unknown as SubjectQueryInput;

  const { subjects, pagination } = await listSubjectsService(query);

  return ApiResponse.paginated(res, subjects, pagination, "Subjects retrieved");
};

// --------------------------------------------------
// GET /api/settings/subjects/:id
// --------------------------------------------------

export const getSubjectController = async (req: Request, res: Response) => {
  const subject = await getSubjectService(req.params.id as string);

  return ApiResponse.success(res, { subject }, "Subject retrieved");
};

// --------------------------------------------------
// POST /api/settings/subjects
// --------------------------------------------------

export const createSubjectController = async (req: Request, res: Response) => {
  const subject = await createSubjectService(req.body as CreateSubjectInput);

  return ApiResponse.created(res, { subject }, "Subject created");
};

// --------------------------------------------------
// PATCH /api/settings/subjects/:id
// --------------------------------------------------

export const updateSubjectController = async (req: Request, res: Response) => {
  const subject = await updateSubjectService(
    req.params.id as string,
    req.body as UpdateSubjectInput,
  );

  return ApiResponse.success(res, { subject }, "Subject updated");
};

// --------------------------------------------------
// DELETE /api/settings/subjects/:id
// --------------------------------------------------

export const deleteSubjectController = async (req: Request, res: Response) => {
  await deleteSubjectService(req.params.id as string);

  return ApiResponse.success(res, null, "Subject deleted");
};
