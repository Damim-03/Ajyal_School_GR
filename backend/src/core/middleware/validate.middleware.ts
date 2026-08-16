import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodIssue } from "zod";
import { HTTPSTATUS } from "../config/http.config";
import { ErrorCodeEnum } from "../enums/error-code.enum";

// --------------------------------------------------
// helper: يحوّل ZodIssue[] إلى مصفوفة قابلة للقراءة
// --------------------------------------------------

const formatIssues = (issues: ZodIssue[]) =>
  issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

// --------------------------------------------------
// validate — يتحقق من req.body
//
// الاستخدام:
//   router.post("/", validate(createStudentSchema), handler)
// --------------------------------------------------

export const validate =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(HTTPSTATUS.UNPROCESSABLE_ENTITY).json({
        message: "Validation failed",
        errorCode: ErrorCodeEnum.VALIDATION_ERROR,
        errors: formatIssues(result.error.issues),
      });
    }

    req.body = result.data;
    return next();
  };

// --------------------------------------------------
// validateParams — يتحقق من URL params
//
// مثال: router.get("/:id", validateParams(idSchema), handler)
// --------------------------------------------------

export const validateParams =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      return res.status(HTTPSTATUS.BAD_REQUEST).json({
        message: "Invalid URL parameters",
        errorCode: ErrorCodeEnum.VALIDATION_ERROR,
        errors: formatIssues(result.error.issues),
      });
    }

    // cast مطلوب لأن TypeScript يتوقع ParamsDictionary
    req.params = result.data as Record<string, string>;
    return next();
  };

// --------------------------------------------------
// validateQuery — يتحقق من query string
//
// ⚠️ في Express 5 صار req.query خاصية getter فقط (بلا setter)،
//    فالإسناد المباشر `req.query = ...` يرمي TypeError.
//    الحل: نعرّف خاصية own على الـ request تحجب الـ getter الموروث.
// --------------------------------------------------

export const validateQuery =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(HTTPSTATUS.BAD_REQUEST).json({
        message: "Invalid query parameters",
        errorCode: ErrorCodeEnum.VALIDATION_ERROR,
        errors: formatIssues(result.error.issues),
      });
    }

    Object.defineProperty(req, "query", {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });

    return next();
  };
