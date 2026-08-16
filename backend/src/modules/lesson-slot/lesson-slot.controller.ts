import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listLessonSlotsService,
  getLessonSlotService,
  createLessonSlotService,
  updateLessonSlotService,
  deleteLessonSlotService,
} from "./lesson-slot.service";
import {
  CreateLessonSlotInput,
  UpdateLessonSlotInput,
  LessonSlotQueryInput,
} from "./lesson-slot.schema";

export const listLessonSlotsController = async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as LessonSlotQueryInput;

  const { lessonSlots, pagination } = await listLessonSlotsService(query);

  return ApiResponse.paginated(
    res,
    lessonSlots,
    pagination,
    "Lesson slots retrieved",
  );
};

export const getLessonSlotController = async (req: Request, res: Response) => {
  const lessonSlot = await getLessonSlotService(req.params.id as string);

  return ApiResponse.success(res, { lessonSlot }, "Lesson slot retrieved");
};

export const createLessonSlotController = async (
  req: Request,
  res: Response,
) => {
  const lessonSlot = await createLessonSlotService(
    req.body as CreateLessonSlotInput,
  );

  return ApiResponse.created(res, { lessonSlot }, "Lesson slot created");
};

export const updateLessonSlotController = async (
  req: Request,
  res: Response,
) => {
  const lessonSlot = await updateLessonSlotService(
    req.params.id as string,
    req.body as UpdateLessonSlotInput,
  );

  return ApiResponse.success(res, { lessonSlot }, "Lesson slot updated");
};

export const deleteLessonSlotController = async (
  req: Request,
  res: Response,
) => {
  await deleteLessonSlotService(req.params.id as string);

  return ApiResponse.success(res, null, "Lesson slot deleted");
};
