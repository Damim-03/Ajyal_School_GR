import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  dashboardReportService,
  financialReportService,
  outstandingReportService,
  attendanceReportService,
  dailyAttendanceReportService,
  monthlyFeesReportService,
  sessionClearanceReportService,
  expectedSessionsReportService,
} from "./report.service";
import {
  FinancialReportQuery,
  OutstandingReportQuery,
  AttendanceReportQuery,
  DailyAttendanceReportQuery,
  MonthlyFeesReportQuery,
  SessionClearanceReportQuery,
  ExpectedSessionsReportQuery,
} from "./report.schema";

export const dashboardReportController = async (
  _req: Request,
  res: Response,
) => {
  const report = await dashboardReportService();

  return ApiResponse.success(res, report, "Dashboard retrieved");
};

export const financialReportController = async (
  req: Request,
  res: Response,
) => {
  const report = await financialReportService(
    req.query as unknown as FinancialReportQuery,
  );

  return ApiResponse.success(res, report, "Financial report retrieved");
};

export const outstandingReportController = async (
  req: Request,
  res: Response,
) => {
  const report = await outstandingReportService(
    req.query as unknown as OutstandingReportQuery,
  );

  return ApiResponse.success(res, report, "Outstanding report retrieved");
};

export const attendanceReportController = async (
  req: Request,
  res: Response,
) => {
  const report = await attendanceReportService(
    req.query as unknown as AttendanceReportQuery,
  );

  return ApiResponse.success(res, report, "Attendance report retrieved");
};

export const dailyAttendanceReportController = async (
  req: Request,
  res: Response,
) => {
  const report = await dailyAttendanceReportService(
    req.query as unknown as DailyAttendanceReportQuery,
  );

  return ApiResponse.success(res, report, "Daily attendance sheet retrieved");
};

export const monthlyFeesReportController = async (
  req: Request,
  res: Response,
) => {
  const report = await monthlyFeesReportService(
    req.query as unknown as MonthlyFeesReportQuery,
  );

  return ApiResponse.success(res, report, "Monthly fees sheet retrieved");
};

export const sessionClearanceReportController = async (
  req: Request,
  res: Response,
) => {
  const report = await sessionClearanceReportService(
    req.query as unknown as SessionClearanceReportQuery,
  );

  return ApiResponse.success(res, report, "Session clearance sheet retrieved");
};

export const expectedSessionsReportController = async (
  req: Request,
  res: Response,
) => {
  const report = await expectedSessionsReportService(
    req.query as unknown as ExpectedSessionsReportQuery,
  );

  return ApiResponse.success(res, report, "Expected sessions sheet retrieved");
};
