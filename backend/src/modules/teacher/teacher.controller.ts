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
  getTeacherDocumentsService,
  putTeacherDocumentService,
  deleteTeacherDocumentService,
} from "./document.service";
import {
  CreateTeacherInput,
  UpdateTeacherInput,
  TeacherQueryInput,
  PutTeacherDocumentInput,
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

// --------------------------------------------------
// وثائق ملفّ الأستاذ
// --------------------------------------------------

// GET /api/teachers/:id/documents
export const getTeacherDocumentsController = async (
  req: Request,
  res: Response,
) => {
  const file = await getTeacherDocumentsService(req.params.id as string);

  return ApiResponse.success(res, file, "Documents retrieved");
};

// PUT /api/teachers/:id/documents/:type
export const putTeacherDocumentController = async (
  req: Request,
  res: Response,
) => {
  const file = await putTeacherDocumentService(
    req.params.id as string,
    req.params.type as string,
    req.body as PutTeacherDocumentInput,
    req.user?.userId,
  );

  return ApiResponse.success(res, file, "Document attached");
};

// DELETE /api/teachers/:id/documents/:type
export const deleteTeacherDocumentController = async (
  req: Request,
  res: Response,
) => {
  const file = await deleteTeacherDocumentService(
    req.params.id as string,
    req.params.type as string,
  );

  return ApiResponse.success(res, file, "Document removed");
};
