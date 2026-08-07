import { Navigate } from "react-router-dom";
import { useAuthStore } from "../core/stores/auth.store";
import { ROUTES } from "./routes";

// --------------------------------------------------
// ProtectedRoute — مسجّل فقط
// --------------------------------------------------

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuth = useAuthStore((s) => s.isAuth);

  if (!isAuth) {
    return <Navigate to={ROUTES.login} replace />;
  }

  return <>{children}</>;
};

// --------------------------------------------------
// PublicOnlyRoute — غير مسجّل فقط
// --------------------------------------------------

export const PublicOnlyRoute = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const isAuth = useAuthStore((s) => s.isAuth);

  if (isAuth) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return <>{children}</>;
};
