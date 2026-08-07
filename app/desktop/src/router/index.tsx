import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute, PublicOnlyRoute } from "./protected-route";
import { ROUTES } from "./routes";
import { AppLayout } from "../components/layout/app-layout";
import { Loading } from "../components/shared/loading";

// --------------------------------------------------
// Lazy imports
// --------------------------------------------------

const LoginPage = lazy(() => import("../modules/auth/pages/login.page"));

const StudentsPage = lazy(
  () => import("../modules/students/pages/students.page"),
);
const StudentDetailPage = lazy(
  () => import("../modules/students/pages/student-detail.page"),
);

const TeachersPage = lazy(
  () => import("../modules/teachers/pages/teachers.page"),
);

const EnrollmentsPage = lazy(
  () => import("../modules/enrollments/pages/enrollments.page"),
);

// --------------------------------------------------
// Suspense wrapper
// --------------------------------------------------

const Lazy = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<Loading />}>{children}</Suspense>
);

// --------------------------------------------------
// AppRouter
// --------------------------------------------------

export function AppRouter() {
  return (
    <Routes>
      {/* ==================== PUBLIC ==================== */}
      <Route
        path={ROUTES.login}
        element={
          <PublicOnlyRoute>
            <Lazy>
              <LoginPage />
            </Lazy>
          </PublicOnlyRoute>
        }
      />

      {/* ==================== PROTECTED ==================== */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route
          index
          element={
            <Lazy>
              <StudentsPage />
            </Lazy>
          }
        />

        {/* Students */}
        <Route
          path={ROUTES.students.root}
          element={
            <Lazy>
              <StudentsPage />
            </Lazy>
          }
        />
        <Route
          path={ROUTES.students.detail(":id")}
          element={
            <Lazy>
              <StudentDetailPage />
            </Lazy>
          }
        />

        {/* Teachers */}
        <Route
          path={ROUTES.teachers.root}
          element={
            <Lazy>
              <TeachersPage />
            </Lazy>
          }
        />
        <Route
          path={ROUTES.teachers.detail(":id")}
          element={
            <Lazy>
              <TeachersPage />
            </Lazy>
          }
        />

        {/* Enrollments */}
        <Route
          path={ROUTES.enrollments.root}
          element={
            <Lazy>
              <EnrollmentsPage />
            </Lazy>
          }
        />
      </Route>

      {/* أي رابط غير موجود → الرئيسية */}
      <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
    </Routes>
  );
}
