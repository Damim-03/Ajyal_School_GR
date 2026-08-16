import { Request, Response } from "express";
import { ApiResponse } from "../../core/config/api-response";
import {
  listRolesService,
  getRoleService,
  createRoleService,
  updateRoleService,
  setRolePermissionsService,
  deleteRoleService,
  listPermissionsService,
} from "./role.service";
import {
  CreateRoleInput,
  UpdateRoleInput,
  SetRolePermissionsInput,
  RoleQueryInput,
  PermissionQueryInput,
} from "./role.schema";

export const listRolesController = async (req: Request, res: Response) => {
  const query = req.query as unknown as RoleQueryInput;

  const { roles, pagination } = await listRolesService(query);

  return ApiResponse.paginated(res, roles, pagination, "Roles retrieved");
};

export const getRoleController = async (req: Request, res: Response) => {
  const role = await getRoleService(req.params.id as string);

  return ApiResponse.success(res, { role }, "Role retrieved");
};

export const createRoleController = async (req: Request, res: Response) => {
  const role = await createRoleService(req.body as CreateRoleInput);

  return ApiResponse.created(res, { role }, "Role created");
};

export const updateRoleController = async (req: Request, res: Response) => {
  const role = await updateRoleService(
    req.params.id as string,
    req.body as UpdateRoleInput,
  );

  return ApiResponse.success(res, { role }, "Role updated");
};

// PUT /api/roles/:id/permissions
export const setRolePermissionsController = async (
  req: Request,
  res: Response,
) => {
  const role = await setRolePermissionsService(
    req.params.id as string,
    req.body as SetRolePermissionsInput,
  );

  return ApiResponse.success(res, { role }, "Permissions updated");
};

export const deleteRoleController = async (req: Request, res: Response) => {
  await deleteRoleService(req.params.id as string);

  return ApiResponse.success(res, null, "Role deleted");
};

// GET /api/permissions
export const listPermissionsController = async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as PermissionQueryInput;

  const result = await listPermissionsService(query);

  return ApiResponse.success(res, result, "Permissions retrieved");
};
