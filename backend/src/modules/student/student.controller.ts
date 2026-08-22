import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listStudentsService,
  getStudentService,
  getStudentEnrollmentsService,
  createStudentService,
  updateStudentService,
  deleteStudentService,
} from "./student.service";
import { getStudentStatementService } from "./student-statement.service";
import {
  CreateStudentInput,
  UpdateStudentInput,
  StudentQueryInput,
  StudentEnrollmentQueryInput,
  PutDocumentInput,
} from "./student.schema";
import {
  getStudentDocumentsService,
  putStudentDocumentService,
  deleteStudentDocumentService,
} from "./document.service";

export const listStudentsController = async (req: Request, res: Response) => {
  const query = req.query as unknown as StudentQueryInput;

  const { students, pagination } = await listStudentsService(query);

  return ApiResponse.paginated(res, students, pagination, "Students retrieved");
};

export const getStudentController = async (req: Request, res: Response) => {
  const student = await getStudentService(req.params.id as string);

  return ApiResponse.success(res, { student }, "Student retrieved");
};

// GET /api/students/:id/enrollments
export const getStudentEnrollmentsController = async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as StudentEnrollmentQueryInput;

  const enrollments = await getStudentEnrollmentsService(
    req.params.id as string,
    query,
  );

  return ApiResponse.success(res, { enrollments }, "Enrollments retrieved");
};

export const createStudentController = async (req: Request, res: Response) => {
  const student = await createStudentService(req.body as CreateStudentInput);

  return ApiResponse.created(res, { student }, "Student created");
};

export const updateStudentController = async (req: Request, res: Response) => {
  const student = await updateStudentService(
    req.params.id as string,
    req.body as UpdateStudentInput,
  );

  return ApiResponse.success(res, { student }, "Student updated");
};

export const deleteStudentController = async (req: Request, res: Response) => {
  await deleteStudentService(req.params.id as string);

  return ApiResponse.success(res, null, "Student deleted");
};

// --------------------------------------------------
// وثائق ملف الطالب
// --------------------------------------------------

// GET /api/students/:id/documents
export const getDocumentsController = async (req: Request, res: Response) => {
  const file = await getStudentDocumentsService(req.params.id as string);

  return ApiResponse.success(res, file, "Documents retrieved");
};

// PUT /api/students/:id/documents/:type
export const putDocumentController = async (req: Request, res: Response) => {
  const file = await putStudentDocumentService(
    req.params.id as string,
    req.params.type as string,
    req.body as PutDocumentInput,
    req.user?.userId,
  );

  return ApiResponse.success(res, file, "Document attached");
};

// DELETE /api/students/:id/documents/:type
export const deleteDocumentController = async (req: Request, res: Response) => {
  const file = await deleteStudentDocumentService(
    req.params.id as string,
    req.params.type as string,
  );

  return ApiResponse.success(res, file, "Document removed");
};

// GET /api/students/:id/statement
export const getStudentStatementController = async (
  req: Request,
  res: Response,
) => {
  const statement = await getStudentStatementService(
    req.params.id as string,
    (req.query as { academicYearId: string }).academicYearId,
  );

  return ApiResponse.success(res, statement, "Statement retrieved");
};
