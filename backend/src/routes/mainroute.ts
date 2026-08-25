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
import teacherPaymentRoutes from "../modules/teacher-payment/teacher-payment.route";
import teacherDebtShareRoutes from "../modules/teacher-debt-share/teacher-debt-share.route";
import userRoutes from "../modules/user/user.route";
import roleRoutes, { permissionRouter } from "../modules/role/role.route";
import reportRoutes from "../modules/report/report.route";
import reportsWorkspaceRoutes from "../modules/reports/reports.route";
import uploadRoutes from "../modules/upload/upload.route";
import maintenanceRoutes from "../modules/maintenance/maintenance.route";
import systemRoutes from "../modules/system/first-boot.route";
import { requireInitialized } from "../core/middleware/initialized.middleware";

const mainRoute: Router = Router();

// --------------------------------------------------
// System — التهيئة الأولى
//
// **قبل الحارس** لأنّها هي التي تُنهيه: مسارٌ يُركَّب بعده لا يُنادى
// إلّا في نظامٍ مهيَّأ، والتهيئةُ لا تقوم في نظامٍ مهيَّأ.
// --------------------------------------------------

mainRoute.use("/system", systemRoutes);

// --------------------------------------------------
// Auth
// --------------------------------------------------

mainRoute.use("/auth", authRoutes);

// --------------------------------------------------
// حارسُ التهيئة (§62)
//
// كلُّ ما بعده يحتاج نظاماً مهيَّأً. وموضعُه هنا — لا في كلّ راوترٍ
// على حدة — هو ما يجعل الحمايةَ شاملةً بلا سطرٍ يُنسى: وحدةٌ تُضاف
// غداً تحته تُحرَس بلا أن يتذكّر كاتبُها شيئاً.
//
// و`/settings/school` قراءةً مستثناةٌ داخله: شاشاتُ التهيئة تعرض
// اسمَ المؤسسة وشعارَها.
// --------------------------------------------------

mainRoute.use(requireInitialized);

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
mainRoute.use("/teacher-payments", teacherPaymentRoutes);
mainRoute.use("/teacher-debt-shares", teacherDebtShareRoutes);

// --------------------------------------------------
// Administration
// --------------------------------------------------

mainRoute.use("/users", userRoutes);
mainRoute.use("/roles", roleRoutes);
mainRoute.use("/permissions", permissionRouter);

// --------------------------------------------------
// Reports
//
// وحدتان تتعايشان في أثناء الانتقال:
//
//   /reports      القديمة — تخدم شاشاتٍ تعمل اليوم
//   /reports/v2   الجديدة — منظومة التقارير قيد البناء
//
// وبادئةٌ مستقلّة لا مسارٌ واحد، لأنّ `/financial` موجودٌ في
// الاثنتين. وتركيبُهما على `/reports` معاً كان سيجعل الراوتر
// الأوّل يلتقطه فلا يصل طلبٌ واحد إلى الجديد — عطبٌ صامت: المسار
// يردّ 200 ببيانات النسخة القديمة، فيبدو أنّ الجديد يعمل.
//
// والأخصُّ يُركَّب أوّلاً: `/reports/v2` قبل `/reports` حتى لا
// يعتمد الوصولُ إليه على أن يُمرِّر القديمُ ما لا يعرفه.
//
// ومتى غطّت الجديدةُ كلَّ ما تغطّيه القديمة، تُبدَّل البادئتان
// وتُحذف القديمة — استبدالٌ بخطوةٍ واحدة لا إعادةُ كتابة.
// --------------------------------------------------

mainRoute.use("/reports/v2", reportsWorkspaceRoutes);
mainRoute.use("/reports", reportRoutes);

// --------------------------------------------------
// Uploads — صور الطلبة وشعار المدرسة
// --------------------------------------------------

mainRoute.use("/uploads", uploadRoutes);

// --------------------------------------------------
// الصيانة — النسخ الاحتياطي والاستعادة وإعادة التهيئة
// --------------------------------------------------

mainRoute.use("/maintenance", maintenanceRoutes);

export default mainRoute;
