import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listPaymentsService,
  getPaymentService,
  createPaymentService,
  cancelPaymentService,
} from "./payment.service";
import {
  CreatePaymentInput,
  PaymentQueryInput,
  CancelPaymentInput,
} from "./payment.schema";

export const listPaymentsController = async (req: Request, res: Response) => {
  const query = req.query as unknown as PaymentQueryInput;

  const { payments, pagination } = await listPaymentsService(query);

  return ApiResponse.paginated(res, payments, pagination, "Payments retrieved");
};

export const getPaymentController = async (req: Request, res: Response) => {
  const payment = await getPaymentService(req.params.id as string);

  return ApiResponse.success(res, { payment }, "Payment retrieved");
};

export const createPaymentController = async (req: Request, res: Response) => {
  // receivedById إلزامي في الـ schema — يأتي من التوكن
  const payment = await createPaymentService(
    req.body as CreatePaymentInput,
    req.user!.userId,
  );

  return ApiResponse.created(res, { payment }, "Payment recorded");
};

// POST /api/payments/:id/cancel
export const cancelPaymentController = async (req: Request, res: Response) => {
  const payment = await cancelPaymentService(
    req.params.id as string,
    req.body as CancelPaymentInput,
    req.user!.userId,
  );

  return ApiResponse.success(res, { payment }, "Payment cancelled");
};
