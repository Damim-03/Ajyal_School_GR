"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPagination = exports.getPagination = exports.ApiResponse = void 0;
const http_config_1 = require("../config/http.config");
// --------------------------------------------------
// Standardized API Response Helper
//
// الاستخدام:
//   return ApiResponse.success(res, data)
//   return ApiResponse.created(res, data)
//   return ApiResponse.error(res, "message", 400)
//   return ApiResponse.paginated(res, data, pagination)
// --------------------------------------------------
class ApiResponse {
    static success(res, data, message = "Success", statusCode = http_config_1.HTTPSTATUS.OK) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
        });
    }
    static created(res, data, message = "Created successfully") {
        return res.status(http_config_1.HTTPSTATUS.CREATED).json({
            success: true,
            message,
            data,
        });
    }
    static noContent(res) {
        return res.status(http_config_1.HTTPSTATUS.NO_CONTENT).send();
    }
    static error(res, message, statusCode = http_config_1.HTTPSTATUS.BAD_REQUEST, errorCode) {
        return res.status(statusCode).json({
            success: false,
            message,
            ...(errorCode && { errorCode }),
        });
    }
    static paginated(res, data, pagination, message = "Success") {
        return res.status(http_config_1.HTTPSTATUS.OK).json({
            success: true,
            message,
            data,
            pagination,
        });
    }
}
exports.ApiResponse = ApiResponse;
// --------------------------------------------------
// Pagination helper
// --------------------------------------------------
const getPagination = (page = 1, limit = 20) => {
    const safePage = Math.max(1, Number(page));
    const safeLimit = Math.min(100, Math.max(1, Number(limit)));
    return {
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        page: safePage,
        limit: safeLimit,
    };
};
exports.getPagination = getPagination;
const buildPagination = (total, page, limit) => ({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
});
exports.buildPagination = buildPagination;
//# sourceMappingURL=api-response.js.map