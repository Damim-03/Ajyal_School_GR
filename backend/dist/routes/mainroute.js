"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_route_1 = __importDefault(require("../modules/auth/auth.route"));
const settings_route_1 = __importDefault(require("./settings.route"));
const teacher_route_1 = __importDefault(require("../modules/teacher/teacher.route"));
const student_route_1 = __importDefault(require("../modules/student/student.route"));
const teaching_assignment_route_1 = __importDefault(require("../modules/teaching-assignment/teaching-assignment.route"));
const enrollment_route_1 = __importDefault(require("../modules/enrollment/enrollment.route"));
const schedule_route_1 = __importDefault(require("../modules/schedule/schedule.route"));
const session_route_1 = __importDefault(require("../modules/session/session.route"));
const attendance_route_1 = __importDefault(require("../modules/attendance/attendance.route"));
const attendance_sheet_route_1 = __importDefault(require("../modules/attendance-sheet/attendance-sheet.route"));
const invoice_route_1 = __importDefault(require("../modules/invoice/invoice.route"));
const payment_route_1 = __importDefault(require("../modules/payment/payment.route"));
const receipt_route_1 = __importDefault(require("../modules/receipt/receipt.route"));
const settlement_policy_route_1 = __importDefault(require("../modules/settlement-policy/settlement-policy.route"));
const settlement_route_1 = __importDefault(require("../modules/settlement/settlement.route"));
const teacher_payment_route_1 = __importDefault(require("../modules/teacher-payment/teacher-payment.route"));
const teacher_debt_share_route_1 = __importDefault(require("../modules/teacher-debt-share/teacher-debt-share.route"));
const user_route_1 = __importDefault(require("../modules/user/user.route"));
const role_route_1 = __importStar(require("../modules/role/role.route"));
const report_route_1 = __importDefault(require("../modules/report/report.route"));
const reports_route_1 = __importDefault(require("../modules/reports/reports.route"));
const upload_route_1 = __importDefault(require("../modules/upload/upload.route"));
const maintenance_route_1 = __importDefault(require("../modules/maintenance/maintenance.route"));
const first_boot_route_1 = __importDefault(require("../modules/system/first-boot.route"));
const initialized_middleware_1 = require("../core/middleware/initialized.middleware");
const mainRoute = (0, express_1.Router)();
// --------------------------------------------------
// System — التهيئة الأولى
//
// **قبل الحارس** لأنّها هي التي تُنهيه: مسارٌ يُركَّب بعده لا يُنادى
// إلّا في نظامٍ مهيَّأ، والتهيئةُ لا تقوم في نظامٍ مهيَّأ.
// --------------------------------------------------
mainRoute.use("/system", first_boot_route_1.default);
// --------------------------------------------------
// Auth
// --------------------------------------------------
mainRoute.use("/auth", auth_route_1.default);
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
mainRoute.use(initialized_middleware_1.requireInitialized);
// --------------------------------------------------
// Settings — subjects, levels, classrooms ...
// --------------------------------------------------
mainRoute.use("/settings", settings_route_1.default);
// --------------------------------------------------
// People
// --------------------------------------------------
mainRoute.use("/teachers", teacher_route_1.default);
mainRoute.use("/students", student_route_1.default);
// --------------------------------------------------
// Academic links — الإسناد والتسجيل
// --------------------------------------------------
mainRoute.use("/teaching-assignments", teaching_assignment_route_1.default);
mainRoute.use("/enrollments", enrollment_route_1.default);
// --------------------------------------------------
// Timetable
// --------------------------------------------------
mainRoute.use("/schedules", schedule_route_1.default);
mainRoute.use("/sessions", session_route_1.default);
/* الكشوف قبل /attendance — لولا ذلك لالتقط "/attendance/:id" الكشوفَ */
mainRoute.use("/attendance-sheets", attendance_sheet_route_1.default);
mainRoute.use("/attendance", attendance_route_1.default);
// --------------------------------------------------
// Finance
// --------------------------------------------------
mainRoute.use("/invoices", invoice_route_1.default);
mainRoute.use("/payments", payment_route_1.default);
mainRoute.use("/receipts", receipt_route_1.default);
/* تخليص الأستاذ — السياسات قبل التخليص، فالثاني لا يقوم بغير الأولى */
mainRoute.use("/settlement-policies", settlement_policy_route_1.default);
mainRoute.use("/settlements", settlement_route_1.default);
mainRoute.use("/teacher-payments", teacher_payment_route_1.default);
mainRoute.use("/teacher-debt-shares", teacher_debt_share_route_1.default);
// --------------------------------------------------
// Administration
// --------------------------------------------------
mainRoute.use("/users", user_route_1.default);
mainRoute.use("/roles", role_route_1.default);
mainRoute.use("/permissions", role_route_1.permissionRouter);
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
mainRoute.use("/reports/v2", reports_route_1.default);
mainRoute.use("/reports", report_route_1.default);
// --------------------------------------------------
// Uploads — صور الطلبة وشعار المدرسة
// --------------------------------------------------
mainRoute.use("/uploads", upload_route_1.default);
// --------------------------------------------------
// الصيانة — النسخ الاحتياطي والاستعادة وإعادة التهيئة
// --------------------------------------------------
mainRoute.use("/maintenance", maintenance_route_1.default);
exports.default = mainRoute;
//# sourceMappingURL=mainroute.js.map