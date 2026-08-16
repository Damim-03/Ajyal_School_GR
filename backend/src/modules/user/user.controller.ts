import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listUsersService,
  getUserService,
  createUserService,
  updateUserService,
  deleteUserService,
} from "./user.service";
import {
  CreateUserInput,
  UpdateUserInput,
  UserQueryInput,
} from "./user.schema";

export const listUsersController = async (req: Request, res: Response) => {
  const query = req.query as unknown as UserQueryInput;

  const { users, pagination } = await listUsersService(query);

  return ApiResponse.paginated(res, users, pagination, "Users retrieved");
};

export const getUserController = async (req: Request, res: Response) => {
  const user = await getUserService(req.params.id as string);

  return ApiResponse.success(res, { user }, "User retrieved");
};

export const createUserController = async (req: Request, res: Response) => {
  const user = await createUserService(req.body as CreateUserInput);

  return ApiResponse.created(res, { user }, "User created");
};

export const updateUserController = async (req: Request, res: Response) => {
  const user = await updateUserService(
    req.params.id as string,
    req.body as UpdateUserInput,
    req.user!.userId,
  );

  return ApiResponse.success(res, { user }, "User updated");
};

export const deleteUserController = async (req: Request, res: Response) => {
  await deleteUserService(req.params.id as string, req.user!.userId);

  return ApiResponse.success(res, null, "User deleted");
};
