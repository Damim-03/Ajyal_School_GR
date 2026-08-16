import { Router } from "express";
import authRoutes from "../modules/auth/auth.route";
import settingsRoutes from "./settings.route";
import teacherRoutes from "../modules/teacher/teacher.route";
import studentRoutes from "../modules/student/student.route";
import teachingAssignmentRoutes from "../modules/teaching-assignment/teaching-assignment.route";
import enrollmentRoutes from "../modules/enrollment/enrollment.route";
import scheduleRoutes from "../modules/schedule/schedule.route";
import sessionRoutes from "../modules/session/session.route";
import attendanceRoutes from "../modules/attendance/attendance.route";
import attendanceSheetRoutes from "../modules/attendance-sheet/attendance-sheet.route";
import invoiceRoutes from "../modules/invoice/invoice.route";
import paymentRoutes from "../modules/payment/payment.route";
import receiptRoutes from "../modules/receipt/receipt.route";
import settlementPolicyRoutes from "../modules/settlement-policy/settlement-policy.route";
import settlementRoutes from "../modules/settlement/settlement.route";
import userRoutes from "../modules/user/user.route";
import roleRoutes, { permissionRouter } from "../modules/role/role.route";
import reportRoutes from "../modules/report/report.route";
import uploadRoutes from "../modules/upload/upload.route";

const mainRoute: Router = Router();

// --------------------------------------------------
// Auth
// --------------------------------------------------

mainRoute.use("/auth", authRoutes);

// --------------------------------------------------
// Settings — subjects, levels, classrooms ...
// --------------------------------------------------

mainRoute.use("/settings", settingsRoutes);

// --------------------------------------------------
// People
// --------------------------------------------------

mainRoute.use("/teachers", teacherRoutes);
mainRoute.use("/students", studentRoutes);

// --------------------------------------------------
// Academic links — الإسناد والتسجيل
// --------------------------------------------------

mainRoute.use("/teaching-assignments", teachingAssignmentRoutes);
mainRoute.use("/enrollments", enrollmentRoutes);

// --------------------------------------------------
// Timetable
// --------------------------------------------------

mainRoute.use("/schedules", scheduleRoutes);
mainRoute.use("/sessions", sessionRoutes);
/* الكشوف قبل /attendance — لولا ذلك لالتقط "/attendance/:id" الكشوفَ */
mainRoute.use("/attendance-sheets", attendanceSheetRoutes);
mainRoute.use("/attendance", attendanceRoutes);

// --------------------------------------------------
// Finance
// --------------------------------------------------

mainRoute.use("/invoices", invoiceRoutes);
mainRoute.use("/payments", paymentRoutes);
mainRoute.use("/receipts", receiptRoutes);

/* تخليص الأستاذ — السياسات قبل التخليص، فالثاني لا يقوم بغير الأولى */
mainRoute.use("/settlement-policies", settlementPolicyRoutes);
mainRoute.use("/settlements", settlementRoutes);

// --------------------------------------------------
// Administration
// --------------------------------------------------

mainRoute.use("/users", userRoutes);
mainRoute.use("/roles", roleRoutes);
mainRoute.use("/permissions", permissionRouter);

// --------------------------------------------------
// Reports
// --------------------------------------------------

mainRoute.use("/reports", reportRoutes);

// --------------------------------------------------
// Uploads — صور الطلبة وشعار المدرسة
// --------------------------------------------------

mainRoute.use("/uploads", uploadRoutes);

export default mainRoute;
