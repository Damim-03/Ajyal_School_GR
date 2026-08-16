import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listSchedulesService,
  getScheduleService,
  createScheduleService,
  updateScheduleService,
  deleteScheduleService,
} from "./schedule.service";
import {
  CreateScheduleInput,
  UpdateScheduleInput,
  ScheduleQueryInput,
} from "./schedule.schema";

export const listSchedulesController = async (req: Request, res: Response) => {
  const query = req.query as unknown as ScheduleQueryInput;

  const { schedules, pagination } = await listSchedulesService(query);

  return ApiResponse.paginated(
    res,
    schedules,
    pagination,
    "Schedules retrieved",
  );
};

export const getScheduleController = async (req: Request, res: Response) => {
  const schedule = await getScheduleService(req.params.id as string);

  return ApiResponse.success(res, { schedule }, "Schedule retrieved");
};

export const createScheduleController = async (req: Request, res: Response) => {
  const schedule = await createScheduleService(req.body as CreateScheduleInput);

  return ApiResponse.created(res, { schedule }, "Schedule created");
};

export const updateScheduleController = async (req: Request, res: Response) => {
  const schedule = await updateScheduleService(
    req.params.id as string,
    req.body as UpdateScheduleInput,
  );

  return ApiResponse.success(res, { schedule }, "Schedule updated");
};

export const deleteScheduleController = async (req: Request, res: Response) => {
  await deleteScheduleService(req.params.id as string);

  return ApiResponse.success(res, null, "Schedule deleted");
};
