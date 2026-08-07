import { Router } from "express";
import authRoutes from "../modules/auth/auth.route";

const mainRoute: Router = Router();

// --------------------------------------------------
// Auth
// --------------------------------------------------

mainRoute.use("/auth", authRoutes);

// --------------------------------------------------
// يُضاف هنا كل module لاحقاً
// router.use("/students",   studentRoutes)
// router.use("/teachers",   teacherRoutes)
// router.use("/invoices",   invoiceRoutes)
// --------------------------------------------------

export default mainRoute;
