import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listInvoicesService,
  getInvoiceService,
  createInvoiceService,
  generateInvoicesService,
  updateInvoiceService,
  cancelInvoiceService,
} from "./invoice.service";
import {
  CreateInvoiceInput,
  GenerateInvoicesInput,
  UpdateInvoiceInput,
  InvoiceQueryInput,
  CancelInvoiceInput,
} from "./invoice.schema";

export const listInvoicesController = async (req: Request, res: Response) => {
  const query = req.query as unknown as InvoiceQueryInput;

  const { invoices, pagination } = await listInvoicesService(query);

  return ApiResponse.paginated(res, invoices, pagination, "Invoices retrieved");
};

export const getInvoiceController = async (req: Request, res: Response) => {
  const invoice = await getInvoiceService(req.params.id as string);

  return ApiResponse.success(res, { invoice }, "Invoice retrieved");
};

export const createInvoiceController = async (req: Request, res: Response) => {
  const invoice = await createInvoiceService(
    req.body as CreateInvoiceInput,
    req.user?.userId,
  );

  return ApiResponse.created(res, { invoice }, "Invoice created");
};

// POST /api/invoices/generate — فواتير الشهر دفعة واحدة
export const generateInvoicesController = async (
  req: Request,
  res: Response,
) => {
  const result = await generateInvoicesService(
    req.body as GenerateInvoicesInput,
    req.user?.userId,
  );

  return ApiResponse.created(
    res,
    result,
    `${result.created} invoice(s) generated`,
  );
};

export const updateInvoiceController = async (req: Request, res: Response) => {
  const invoice = await updateInvoiceService(
    req.params.id as string,
    req.body as UpdateInvoiceInput,
  );

  return ApiResponse.success(res, { invoice }, "Invoice updated");
};

// POST /api/invoices/:id/cancel
export const cancelInvoiceController = async (req: Request, res: Response) => {
  const invoice = await cancelInvoiceService(
    req.params.id as string,
    req.body as CancelInvoiceInput,
    req.user!.userId,
  );

  return ApiResponse.success(res, { invoice }, "Invoice cancelled");
};
