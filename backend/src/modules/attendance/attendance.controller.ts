import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listAttendanceService,
  getAttendanceService,
  createAttendanceService,
  bulkAttendanceService,
  updateAttendanceService,
  clearSessionAttendanceService,
} from "./attendance.service";
import {
  CreateAttendanceInput,
  BulkAttendanceInput,
  UpdateAttendanceInput,
  AttendanceQueryInput,
} from "./attendance.schema";

export const listAttendanceController = async (req: Request, res: Response) => {
  const query = req.query as unknown as AttendanceQueryInput;

  const { attendances, pagination } = await listAttendanceService(query);

  return ApiResponse.paginated(
    res,
    attendances,
    pagination,
    "Attendance retrieved",
  );
};

export const getAttendanceController = async (req: Request, res: Response) => {
  const attendance = await getAttendanceService(req.params.id as string);

  return ApiResponse.success(res, { attendance }, "Attendance retrieved");
};

export const createAttendanceController = async (
  req: Request,
  res: Response,
) => {
  const attendance = await createAttendanceService(
    req.body as CreateAttendanceInput,
  );

  return ApiResponse.created(res, { attendance }, "Attendance recorded");
};

// POST /api/attendance/bulk — ورقة حضور الحصة كاملة
export const bulkAttendanceController = async (req: Request, res: Response) => {
  const result = await bulkAttendanceService(req.body as BulkAttendanceInput);

  return ApiResponse.success(
    res,
    result,
    `${result.created} created, ${result.updated} updated`,
  );
};

export const updateAttendanceController = async (
  req: Request,
  res: Response,
) => {
  const attendance = await updateAttendanceService(
    req.params.id as string,
    req.body as UpdateAttendanceInput,
  );

  return ApiResponse.success(res, { attendance }, "Attendance updated");
};

// DELETE /api/attendance/session/:sessionId
export const clearSessionAttendanceController = async (
  req: Request,
  res: Response,
) => {
  const result = await clearSessionAttendanceService(
    req.params.sessionId as string,
  );

  return ApiResponse.success(res, result, "Session attendance cleared");
};
