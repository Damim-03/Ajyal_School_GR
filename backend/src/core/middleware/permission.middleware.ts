import { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma/client";
import { HTTPSTATUS } from "../config/http.config";

// --------------------------------------------------
// Permission Middleware — RBAC ديناميكي من قاعدة البيانات
//
// الفرق عن النظام القديم (roleGuard):
//   القديم: permissions مخزنة في ملف TypeScript ثابت
//   الجديد: permissions مخزنة في DB (RolePermission table)
//           ويمكن تعديلها بدون تغيير الكود
//
// الاستخدام:
//   router.get("/", authMiddleware, requirePermission("student.view"), handler)
//   router.post("/", authMiddleware, requirePermission("student.create"), handler)
// --------------------------------------------------

export const requirePermission =
  (permissionName: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(HTTPSTATUS.UNAUTHORIZED).json({
        message: "Unauthorized",
      });
    }

    // --------------------------------------------------
    // نجلب صلاحيات الـ role مباشرة من DB
    // --------------------------------------------------

    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        roleId: req.user.roleId,
        permission: {
          name: permissionName,
        },
      },
      select: { id: true },
    });

    if (!rolePermission) {
      return res.status(HTTPSTATUS.FORBIDDEN).json({
        message: `Forbidden: missing permission '${permissionName}'`,
      });
    }

    return next();
  };

// --------------------------------------------------
// requireAnyPermission — يكفي صلاحية واحدة
//
// مثال:
//   requireAnyPermission(["invoice.view", "payment.view"])
// --------------------------------------------------

export const requireAnyPermission =
  (permissionNames: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(HTTPSTATUS.UNAUTHORIZED).json({
        message: "Unauthorized",
      });
    }

    const count = await prisma.rolePermission.count({
      where: {
        roleId: req.user.roleId,
        permission: {
          name: { in: permissionNames },
        },
      },
    });

    if (count === 0) {
      return res.status(HTTPSTATUS.FORBIDDEN).json({
        message: "Forbidden: insufficient permissions",
      });
    }

    return next();
  };

// --------------------------------------------------
// requireAllPermissions — تطلب كل الصلاحيات
//
// مثال:
//   requireAllPermissions(["invoice.create", "payment.create"])
// --------------------------------------------------

export const requireAllPermissions =
  (permissionNames: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(HTTPSTATUS.UNAUTHORIZED).json({
        message: "Unauthorized",
      });
    }

    const count = await prisma.rolePermission.count({
      where: {
        roleId: req.user.roleId,
        permission: {
          name: { in: permissionNames },
        },
      },
    });

    if (count < permissionNames.length) {
      return res.status(HTTPSTATUS.FORBIDDEN).json({
        message: "Forbidden: insufficient permissions",
      });
    }

    return next();
  };
