"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuery = exports.validateParams = exports.validate = void 0;
const http_config_1 = require("../config/http.config");
const error_code_enum_1 = require("../enums/error-code.enum");
// --------------------------------------------------
// helper: يحوّل ZodIssue[] إلى مصفوفة قابلة للقراءة
// --------------------------------------------------
const formatIssues = (issues) => issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
}));
// --------------------------------------------------
// validate — يتحقق من req.body
//
// الاستخدام:
//   router.post("/", validate(createStudentSchema), handler)
// --------------------------------------------------
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res.status(http_config_1.HTTPSTATUS.UNPROCESSABLE_ENTITY).json({
            message: "Validation failed",
            errorCode: error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR,
            errors: formatIssues(result.error.issues),
        });
    }
    req.body = result.data;
    return next();
};
exports.validate = validate;
// --------------------------------------------------
// validateParams — يتحقق من URL params
//
// مثال: router.get("/:id", validateParams(idSchema), handler)
// --------------------------------------------------
const validateParams = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
        return res.status(http_config_1.HTTPSTATUS.BAD_REQUEST).json({
            message: "Invalid URL parameters",
            errorCode: error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR,
            errors: formatIssues(result.error.issues),
        });
    }
    // cast مطلوب لأن TypeScript يتوقع ParamsDictionary
    req.params = result.data;
    return next();
};
exports.validateParams = validateParams;
// --------------------------------------------------
// validateQuery — يتحقق من query string
// --------------------------------------------------
const validateQuery = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
        return res.status(http_config_1.HTTPSTATUS.BAD_REQUEST).json({
            message: "Invalid query parameters",
            errorCode: error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR,
            errors: formatIssues(result.error.issues),
        });
    }
    // cast مطلوب لأن TypeScript يتوقع ParsedQs
    req.query = result.data;
    return next();
};
exports.validateQuery = validateQuery;
//# sourceMappingURL=validate.middleware.js.map