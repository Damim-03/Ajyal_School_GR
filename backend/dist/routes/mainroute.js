"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_route_1 = __importDefault(require("../modules/auth/auth.route"));
const mainRoute = (0, express_1.Router)();
// --------------------------------------------------
// Auth
// --------------------------------------------------
mainRoute.use("/auth", auth_route_1.default);
// --------------------------------------------------
// يُضاف هنا كل module لاحقاً
// router.use("/students",   studentRoutes)
// router.use("/teachers",   teacherRoutes)
// router.use("/invoices",   invoiceRoutes)
// --------------------------------------------------
exports.default = mainRoute;
//# sourceMappingURL=mainroute.js.map