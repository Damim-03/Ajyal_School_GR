import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";

import { ProtectedRoute } from "./guards/ProtectedRoute";
import { ModuleAtmosphere } from "../components/ambient/ModuleAtmosphere";
import { PATHS } from "./paths";

import { HomePage } from "../features/home/HomePage";
import SignInPage from "../modules/auth/pages/sign-in.page";
import SchoolIdentityPage from "../features/settings/SchoolIdentityPage";
import SettingsHubPage from "../features/settings/SettingsHubPage";
import PrintTestPage from "../features/settings/PrintTestPage";
import MaintenancePage from "../features/settings/MaintenancePage";
import { ResourceScreen } from "../features/settings/ResourceScreen";
import RolesPage from "../features/settings/RolesPage";
import AcademicHubPage from "../features/academic/AcademicHubPage";
import WelcomePage from "../features/onboarding/WelcomePage";
import {
  RESOURCES,
  FINANCE_RESOURCES,
  ADMIN_RESOURCES,
} from "../features/settings/resource.config";
import StudentsHubPage from "../modules/students/StudentsHubPage";
import StudentsPage from "../modules/students/StudentsPage";
import StudentFilesPage from "../modules/students/StudentFilesPage";
import StudentWizardPage from "../modules/students/StudentWizardPage";
import StudentImportPage from "../modules/students/StudentImportPage";
import TeacherImportPage from "../modules/teachers/TeacherImportPage";
import StudentDetailPage from "../modules/students/StudentDetailPage";
import FinanceHubPage from "../modules/finance/FinanceHubPage";
import InvoicesPage from "../modules/finance/InvoicesPage";
import PaymentsPage from "../modules/finance/PaymentsPage";
import AttendanceHubPage from "../modules/attendance/AttendanceHubPage";
import DailySheetPage from "../modules/attendance/DailySheetPage";
import MonthlyFeesPage from "../modules/attendance/MonthlyFeesPage";
import EstimatePage from "../modules/attendance/EstimatePage";
import SettlementArchivePage from "../modules/finance/SettlementArchivePage";
import StudentAccountPage from "../modules/attendance/StudentAccountPage";
import TeacherAccountPage from "../modules/attendance/TeacherAccountPage";
import TeachersHubPage from "../modules/teachers/TeachersHubPage";
import TeachersPage from "../modules/teachers/TeachersPage";
import TeacherDetailPage from "../modules/teachers/TeacherDetailPage";
import AssignmentsPage from "../modules/teachers/AssignmentsPage";
import EnrollmentsHubPage from "../modules/enrollments/EnrollmentsHubPage";
import StudentAssignmentPage from "../modules/enrollments/StudentAssignmentPage";
import TransferPage from "../modules/enrollments/TransferPage";
import BrowsePage from "../modules/enrollments/BrowsePage";
import WeeklySchedulePage from "../modules/schedules/WeeklySchedulePage";
import { reportsRoutes } from "../modules/reports/reports.routes";

/**
 * ملاحظة معمارية منقولة عن SKK (متعمَّدة):
 * لا AnimatePresence على مستوى المسارات. للتطبيق انتقالاتُ صفحاتٍ
 * مخصّصة أدقّ تنسيقاً:
 *   • الرئيسية → قسم: إخفاء الواجهة + تمدّد الخلفية + حجاب (HomePage.launch)
 *   • قسم → الرئيسية: حجاب + استقرار عكسي (lib/screen-transition)
 * وطبقةُ انتقالٍ ثانية فوقها تتعارض معها وتعطّل التنقّل.
 */

const guarded = (element: ReactNode) => <ProtectedRoute>{element}</ProtectedRoute>;

/** العناوين التي غادرت /settings — تُحوَّل ولا تُترك ترتدّ إلى الرئيسية */
const LEGACY_SETTINGS_REDIRECTS: [string, string][] = [
  ["/settings/academic-years", PATHS.academicYears],
  ["/settings/education-stages", PATHS.academicStages],
  ["/settings/levels", PATHS.academicLevels],
  ["/settings/study-groups", PATHS.academicGroups],
  ["/settings/subjects", PATHS.academicSubjects],
  ["/settings/classrooms", PATHS.academicClassrooms],
  ["/settings/lesson-slots", PATHS.academicSlots],
  ["/settings/tuition-fees", PATHS.financeFees],
];

export function AppRouter() {
  return (
    <HashRouter>
      {/*
        جوّ القسم فوق الـRoutes لا داخلها: يُركَّب مرّة واحدة ولا يُفكَّك مع
        تغيّر المسار، فيبقى العالم قائماً بينما تتبدّل الغرف داخله.
      */}
      <ModuleAtmosphere />

      <Routes>
        <Route path={PATHS.login} element={<SignInPage />} />

        <Route path={PATHS.welcome} element={guarded(<WelcomePage />)} />

        <Route path={PATHS.home} element={guarded(<HomePage />)} />

        {/* الأدقّ أولاً: /students/list قبل /students */}
        <Route path={PATHS.studentsList} element={guarded(<StudentsPage />)} />
        <Route path={PATHS.studentsFiles} element={guarded(<StudentFilesPage />)} />
        <Route path={PATHS.studentNew} element={guarded(<StudentWizardPage />)} />
        <Route path={PATHS.studentsImport} element={guarded(<StudentImportPage />)} />
        <Route path={PATHS.students} element={guarded(<StudentsHubPage />)} />
        {/* بعد المسارات الثابتة: /students/:id يلتقط ما تبقّى */}
        <Route
          path={PATHS.studentDetailPattern}
          element={guarded(<StudentDetailPage />)}
        />

        {/* الأساتذة: الثابت قبل :id، والمحور آخراً */}
        <Route path={PATHS.teachersList} element={guarded(<TeachersPage />)} />
        <Route path={PATHS.teachersImport} element={guarded(<TeacherImportPage />)} />
        <Route path={PATHS.assignments} element={guarded(<AssignmentsPage />)} />
        <Route path={PATHS.teachers} element={guarded(<TeachersHubPage />)} />
        <Route
          path={PATHS.teacherDetailPattern}
          element={guarded(<TeacherDetailPage />)}
        />

        {/*
          إسناد الطلبة — الطالب إلى مادةٍ عند أستاذٍ في فوج.
          غيرُ إسناد الأساتذة (/assignments) الذي يربط الأستاذ بالفوج.
          الأدقّ أولاً، والمحور آخراً.
        */}
        <Route path={PATHS.enrollmentsAssign} element={guarded(<StudentAssignmentPage />)} />
        <Route path={PATHS.enrollmentsTransfer} element={guarded(<TransferPage />)} />
        <Route path={PATHS.enrollmentsBrowse} element={guarded(<BrowsePage />)} />
        <Route path={PATHS.enrollments} element={guarded(<EnrollmentsHubPage />)} />

        {/*
          الجداول شاشةٌ واحدة.

          كانت ثلاثاً: محورٌ ببطاقتين، وشبكةٌ أسبوعية، وشاشةُ «الحصص»
          تولّد الحصص الفعلية بتواريخها. وحُذفت الأخيرة لأنّ ما تولّده
          لا يبلغ كشف الحضور: الكشف يُنشئ حصّته بنفسه حين يُكتب تاريخ
          العمود. وبزوالها بقي المحور ببطاقةٍ واحدة — صفحةُ عبورٍ بلا
          قرار — فزال معها، والعنوانان القديمان يُحوَّلان إلى الشبكة.
        */}
        <Route path={PATHS.schedulesWeekly} element={guarded(<WeeklySchedulePage />)} />
        <Route path={PATHS.schedules} element={<Navigate to={PATHS.schedulesWeekly} replace />} />
        <Route
          path="/schedules/sessions"
          element={<Navigate to={PATHS.schedulesWeekly} replace />}
        />

        {/* الكشوف: الأدقّ قبل المحور */}
        <Route path={PATHS.attendanceDaily} element={guarded(<DailySheetPage />)} />
        <Route path={PATHS.attendanceMonthlyFees} element={guarded(<MonthlyFeesPage />)} />
        <Route path={PATHS.attendanceExpected} element={guarded(<EstimatePage />)} />
        <Route path={PATHS.settlementArchive} element={guarded(<SettlementArchivePage />)} />
        <Route
          path={PATHS.attendanceStudentAccount}
          element={guarded(<StudentAccountPage />)}
        />
        <Route
          path={PATHS.attendanceTeacherAccount}
          element={guarded(<TeacherAccountPage />)}
        />
        <Route path={PATHS.attendance} element={guarded(<AttendanceHubPage />)} />

        {/*
          التقارير — شجرةٌ فرعية كاملة بتخطيطها الخاصّ.

          تُركَّب دالّةً لا عنصراً لأنّها تحتاج `guarded` وهو معرَّفٌ
          هنا. وتمريرُه معاملاً يُبقي وحدةَ التقارير مستقلّةً عن شجرة
          التوجيه، فلا تستورد من `routes/guards`.
        */}
        {reportsRoutes(guarded)}

        {/* المالية: الشاشات قبل المحور */}
        <Route path={PATHS.invoices} element={guarded(<InvoicesPage />)} />
        <Route path={PATHS.payments} element={guarded(<PaymentsPage />)} />
        {/* الإيصالات تُطبع من المدفوعات — لا شاشة مستقلّة لها */}
        <Route path={PATHS.receipts} element={<Navigate to={PATHS.payments} replace />} />

        {/* حقوق الاشتراك وسياسات التخليص — انتقلتا من الإعدادات */}
        {FINANCE_RESOURCES.map((spec) => (
          <Route
            key={spec.key}
            path={spec.path}
            element={guarded(<ResourceScreen spec={spec} />)}
          />
        ))}

        <Route path={PATHS.finance} element={guarded(<FinanceHubPage />)} />

        {/* الإعدادات: المسارات الأدقّ قبل المحور */}
        <Route path={PATHS.settingsSchool} element={guarded(<SchoolIdentityPage />)} />
        <Route path={PATHS.settingsPrint} element={guarded(<PrintTestPage />)} />
        <Route path={PATHS.settingsRoles} element={guarded(<RolesPage />)} />
        <Route path={PATHS.settingsMaintenance} element={guarded(<MaintenancePage />)} />

        {/* الحسابات — الموارد الوحيدة الباقية تحت الإعدادات */}
        {ADMIN_RESOURCES.map((spec) => (
          <Route
            key={spec.key}
            path={spec.path}
            element={guarded(<ResourceScreen spec={spec} />)}
          />
        ))}

        <Route path={PATHS.settings} element={guarded(<SettingsHubPage />)} />

        {/* ============ البنية الدراسية ============ */}
        {RESOURCES.map((spec) => (
          <Route
            key={spec.key}
            path={spec.path}
            element={guarded(<ResourceScreen spec={spec} />)}
          />
        ))}

        <Route path={PATHS.academic} element={guarded(<AcademicHubPage />)} />

        {/*
          العناوين القديمة تحت /settings — مَن حفظها أو رجع إليها من
          سِجلّ التنقّل يصل إلى مكانها الجديد لا إلى الرئيسية.
        */}
        {LEGACY_SETTINGS_REDIRECTS.map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={to} replace />} />
        ))}

        {/*
          شاشات الأقسام تُضاف هنا تباعاً. حتى ذلك الحين يعيد أيّ مسار
          غير معروف إلى الرئيسية بدل شاشة فارغة.
        */}
        <Route path="*" element={<Navigate to={PATHS.home} replace />} />
      </Routes>
    </HashRouter>
  );
}
