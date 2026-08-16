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

  // 2) أخطاء رفع الملفات — خطأ المستخدم لا خطأ الخادم
  //    multer يرمي MulterError عند تجاوز الحجم، وError عادياً من fileFilter.
  //    بلا هذا الفرع يتلقّى المستخدم 500 غامضاً بدل «الملف كبير».
  if (error?.name === "MulterError" || error?.storageErrors) {
    return res.status(HTTPSTATUS.BAD_REQUEST).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "حجم الملف يتجاوز 3 ميغابايت"
          : error.message || "تعذّر رفع الملف",
      errorCode: ErrorCodeEnum.VALIDATION_ERROR,
    });
  }

  // 3) أخطاء التطبيق المعروفة (AppError وكل ما يرث منها)
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
