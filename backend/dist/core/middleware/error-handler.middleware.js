"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const http_config_1 = require("../config/http.config");
const app_errors_1 = require("../errors/app.errors");
const error_code_enum_1 = require("../enums/error-code.enum");
const errorHandler = (error, _req, res, _next) => {
    // 1) JSON غير صالح في جسم الطلب
    if (error instanceof SyntaxError) {
        return res.status(http_config_1.HTTPSTATUS.BAD_REQUEST).json({
            message: "Invalid JSON Format. please check your request body",
            errorCode: error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR,
        });
    }
    // 2) أخطاء رفع الملفات — خطأ المستخدم لا خطأ الخادم
    //    multer يرمي MulterError عند تجاوز الحجم، وError عادياً من fileFilter.
    //    بلا هذا الفرع يتلقّى المستخدم 500 غامضاً بدل «الملف كبير».
    if (error?.name === "MulterError" || error?.storageErrors) {
        return res.status(http_config_1.HTTPSTATUS.BAD_REQUEST).json({
            message: error.code === "LIMIT_FILE_SIZE"
                ? "حجم الملف يتجاوز 3 ميغابايت"
                : error.message || "تعذّر رفع الملف",
            errorCode: error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR,
        });
    }
    // 3) أخطاء التطبيق المعروفة (AppError وكل ما يرث منها)
    //    مثل UnauthorizedException / BadRequestException / NotFoundException
    if (error instanceof app_errors_1.AppError) {
        return res.status(error.statusCode).json({
            message: error.message,
            errorCode: error.errorCode,
        });
    }
    // 3) أي خطأ غير متوقّع → 500 عام
    console.error("Unhandled error:", error);
    return res.status(http_config_1.HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errorCode: error_code_enum_1.ErrorCodeEnum.INTERNAL_SERVER_ERROR,
        error: error?.message || "Unknown Error Occurred",
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error-handler.middleware.js.map