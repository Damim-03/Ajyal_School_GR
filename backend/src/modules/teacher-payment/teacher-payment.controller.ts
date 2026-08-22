import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  payTeacherService,
  listTeacherPaymentsService,
  getTeacherPaymentService,
  cancelTeacherPaymentService,
} from "./teacher-payment.service";
import {
  PayTeacherInput,
  TeacherPaymentQueryInput,
  CancelTeacherPaymentInput,
} from "./teacher-payment.schema";

export const listTeacherPaymentsController = async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as TeacherPaymentQueryInput;

  const { payments, pagination } = await listTeacherPaymentsService(query);

  return ApiResponse.paginated(res, payments, pagination, "Teacher payments retrieved");
};

export const getTeacherPaymentController = async (req: Request, res: Response) => {
  const payment = await getTeacherPaymentService(req.params.id as string);

  return ApiResponse.success(res, { payment }, "Teacher payment retrieved");
};

export const payTeacherController = async (req: Request, res: Response) => {
  const payment = await payTeacherService(
    req.body as PayTeacherInput,
    req.user!.userId,
  );

  return ApiResponse.created(res, { payment }, "Teacher paid");
};

export const cancelTeacherPaymentController = async (
  req: Request,
  res: Response,
) => {
  const payment = await cancelTeacherPaymentService(
    req.params.id as string,
    req.body as CancelTeacherPaymentInput,
    req.user!.userId,
  );

  return ApiResponse.success(res, { payment }, "Teacher payment cancelled");
};
