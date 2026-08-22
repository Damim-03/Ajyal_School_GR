import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listEnrollmentsService,
  getEnrollmentService,
  createEnrollmentService,
  updateEnrollmentService,
  transferEnrollmentService,
  cancelPendingTransferService,
  deleteEnrollmentService,
} from "./enrollment.service";
import {
  CreateEnrollmentInput,
  UpdateEnrollmentInput,
  TransferEnrollmentInput,
  EnrollmentQueryInput,
} from "./enrollment.schema";

export const listEnrollmentsController = async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as EnrollmentQueryInput;

  const { enrollments, pagination } = await listEnrollmentsService(query);

  return ApiResponse.paginated(
    res,
    enrollments,
    pagination,
    "Enrollments retrieved",
  );
};

export const getEnrollmentController = async (req: Request, res: Response) => {
  const enrollment = await getEnrollmentService(req.params.id as string);

  return ApiResponse.success(res, { enrollment }, "Enrollment retrieved");
};

// POST /api/enrollments — تسجيل في عدة مواد دفعة واحدة
export const createEnrollmentController = async (
  req: Request,
  res: Response,
) => {
  const enrollments = await createEnrollmentService(
    req.body as CreateEnrollmentInput,
  );

  return ApiResponse.created(
    res,
    { enrollments, count: enrollments.length },
    `${enrollments.length} enrollment(s) created`,
  );
};

export const updateEnrollmentController = async (
  req: Request,
  res: Response,
) => {
  const enrollment = await updateEnrollmentService(
    req.params.id as string,
    req.body as UpdateEnrollmentInput,
  );

  return ApiResponse.success(res, { enrollment }, "Enrollment updated");
};

export const transferEnrollmentController = async (
  req: Request,
  res: Response,
) => {
  const result = await transferEnrollmentService(
    req.params.id as string,
    req.body as TransferEnrollmentInput,
  );

  return ApiResponse.success(res, result, "Enrollment transferred");
};

// PATCH /api/enrollments/:id/transfer/cancel
export const cancelPendingTransferController = async (
  req: Request,
  res: Response,
) => {
  const enrollment = await cancelPendingTransferService(req.params.id as string);

  return ApiResponse.success(res, { enrollment }, "Pending transfer cancelled");
};

export const deleteEnrollmentController = async (
  req: Request,
  res: Response,
) => {
  await deleteEnrollmentService(req.params.id as string);

  return ApiResponse.success(res, null, "Enrollment deleted");
};
