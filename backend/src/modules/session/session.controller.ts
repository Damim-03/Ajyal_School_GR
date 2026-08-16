import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listSessionsService,
  getSessionService,
  createSessionService,
  generateSessionsService,
  updateSessionService,
  deleteSessionService,
} from "./session.service";
import {
  CreateSessionInput,
  GenerateSessionsInput,
  UpdateSessionInput,
  SessionQueryInput,
} from "./session.schema";

export const listSessionsController = async (req: Request, res: Response) => {
  const query = req.query as unknown as SessionQueryInput;

  const { sessions, pagination } = await listSessionsService(query);

  return ApiResponse.paginated(res, sessions, pagination, "Sessions retrieved");
};

export const getSessionController = async (req: Request, res: Response) => {
  const session = await getSessionService(req.params.id as string);

  return ApiResponse.success(res, { session }, "Session retrieved");
};

export const createSessionController = async (req: Request, res: Response) => {
  const session = await createSessionService(req.body as CreateSessionInput);

  return ApiResponse.created(res, { session }, "Session created");
};

// POST /api/sessions/generate
export const generateSessionsController = async (
  req: Request,
  res: Response,
) => {
  const result = await generateSessionsService(
    req.body as GenerateSessionsInput,
  );

  return ApiResponse.created(
    res,
    result,
    `${result.created} session(s) generated`,
  );
};

export const updateSessionController = async (req: Request, res: Response) => {
  const session = await updateSessionService(
    req.params.id as string,
    req.body as UpdateSessionInput,
  );

  return ApiResponse.success(res, { session }, "Session updated");
};

export const deleteSessionController = async (req: Request, res: Response) => {
  await deleteSessionService(req.params.id as string);

  return ApiResponse.success(res, null, "Session deleted");
};
