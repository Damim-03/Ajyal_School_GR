"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAllPermissions = exports.requireAnyPermission = exports.requirePermission = void 0;
const client_1 = require("../prisma/client");
const http_config_1 = require("../config/http.config");
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
const requirePermission = (permissionName) => async (req, res, next) => {
    if (!req.user) {
        return res.status(http_config_1.HTTPSTATUS.UNAUTHORIZED).json({
            message: "Unauthorized",
        });
    }
    // --------------------------------------------------
    // نجلب صلاحيات الـ role مباشرة من DB
    // --------------------------------------------------
    const rolePermission = await client_1.prisma.rolePermission.findFirst({
        where: {
            roleId: req.user.roleId,
            permission: {
                name: permissionName,
            },
        },
        select: { id: true },
    });
    if (!rolePermission) {
        return res.status(http_config_1.HTTPSTATUS.FORBIDDEN).json({
            message: `Forbidden: missing permission '${permissionName}'`,
        });
    }
    return next();
};
exports.requirePermission = requirePermission;
// --------------------------------------------------
// requireAnyPermission — يكفي صلاحية واحدة
//
// مثال:
//   requireAnyPermission(["invoice.view", "payment.view"])
// --------------------------------------------------
const requireAnyPermission = (permissionNames) => async (req, res, next) => {
    if (!req.user) {
        return res.status(http_config_1.HTTPSTATUS.UNAUTHORIZED).json({
            message: "Unauthorized",
        });
    }
    const count = await client_1.prisma.rolePermission.count({
        where: {
            roleId: req.user.roleId,
            permission: {
                name: { in: permissionNames },
            },
        },
    });
    if (count === 0) {
        return res.status(http_config_1.HTTPSTATUS.FORBIDDEN).json({
            message: "Forbidden: insufficient permissions",
        });
    }
    return next();
};
exports.requireAnyPermission = requireAnyPermission;
// --------------------------------------------------
// requireAllPermissions — تطلب كل الصلاحيات
//
// مثال:
//   requireAllPermissions(["invoice.create", "payment.create"])
// --------------------------------------------------
const requireAllPermissions = (permissionNames) => async (req, res, next) => {
    if (!req.user) {
        return res.status(http_config_1.HTTPSTATUS.UNAUTHORIZED).json({
            message: "Unauthorized",
        });
    }
    const count = await client_1.prisma.rolePermission.count({
        where: {
            roleId: req.user.roleId,
            permission: {
                name: { in: permissionNames },
            },
        },
    });
    if (count < permissionNames.length) {
        return res.status(http_config_1.HTTPSTATUS.FORBIDDEN).json({
            message: "Forbidden: insufficient permissions",
        });
    }
    return next();
};
exports.requireAllPermissions = requireAllPermissions;
//# sourceMappingURL=permission.middleware.js.map