export interface JwtPayload {
  userId: string;
  roleId: string;
  roleName: string;
}

export interface JwtRefreshPayload {
  userId: string;
}
