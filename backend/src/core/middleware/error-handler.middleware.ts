import { ErrorRequestHandler, Request, Response, NextFunction } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { AppError } from "../errors/app.errors";
import { ErrorCodeEnum } from "../enums/error-code.enum";

export const errorHandler: ErrorRequestHandler = (
  error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): any => {
  // 1) JSON غير صالح في جسم الطلب
  if (error instanceof SyntaxError) {
    return res.status(HTTPSTATUS.BAD_REQUEST).json({
      message: "Invalid JSON Format. please check your request body",
      errorCode: ErrorCodeEnum.VALIDATION_ERROR,
    });
  }

  // 2) أخطاء التطبيق المعروفة (AppError وكل ما يرث منها)
  //    مثل UnauthorizedException / BadRequestException / NotFoundException
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      errorCode: error.errorCode,
    });
  }

  // 3) أي خطأ غير متوقّع → 500 عام
  console.error("Unhandled error:", error);
  return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
    message: "Internal Server Error",
    errorCode: ErrorCodeEnum.INTERNAL_SERVER_ERROR,
    error: error?.message || "Unknown Error Occurred",
  });
};
