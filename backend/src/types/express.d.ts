declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        roleId: string;
        roleName: string;
      };
    }
  }
}

export {};
