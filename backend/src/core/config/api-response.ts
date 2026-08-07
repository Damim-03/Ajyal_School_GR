import { Response } from "express";
import { HTTPSTATUS } from "../config/http.config";

// --------------------------------------------------
// Standardized API Response Helper
//
// الاستخدام:
//   return ApiResponse.success(res, data)
//   return ApiResponse.created(res, data)
//   return ApiResponse.error(res, "message", 400)
//   return ApiResponse.paginated(res, data, pagination)
// --------------------------------------------------

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    message = "Success",
    statusCode = HTTPSTATUS.OK,
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static created<T>(res: Response, data: T, message = "Created successfully") {
    return res.status(HTTPSTATUS.CREATED).json({
      success: true,
      message,
      data,
    });
  }

  static noContent(res: Response) {
    return res.status(HTTPSTATUS.NO_CONTENT).send();
  }

  static error(
    res: Response,
    message: string,
    statusCode = HTTPSTATUS.BAD_REQUEST,
    errorCode?: string,
  ) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(errorCode && { errorCode }),
    });
  }

  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
    message = "Success",
  ) {
    return res.status(HTTPSTATUS.OK).json({
      success: true,
      message,
      data,
      pagination,
    });
  }
}

// --------------------------------------------------
// Pagination helper
// --------------------------------------------------

export const getPagination = (
  page = 1,
  limit = 20,
): { skip: number; take: number; page: number; limit: number } => {
  const safePage = Math.max(1, Number(page));
  const safeLimit = Math.min(100, Math.max(1, Number(limit)));

  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
    page: safePage,
    limit: safeLimit,
  };
};

export const buildPagination = (
  total: number,
  page: number,
  limit: number,
) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
