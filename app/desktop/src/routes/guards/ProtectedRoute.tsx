import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "../../core/stores/auth.store";
import { PATHS } from "../paths";

/**
 * حارس المسارات المحمية.
 *
 * يقرأ من المتجر مباشرة لا عبر hook: الحارس يُقيَّم قبل أن تُركَّب
 * الشاشة، والقراءة المباشرة تتجنّب إعادة تصيير لا لزوم لها.
 *
 * ولا يحكم قبل أن ينتهي استئناف الجلسة: التوكن لا يُحفظ، فـ`isAuth`
 * تبدأ `false` عند كل إعادة تحميل ولو كانت الجلسة قائمة. والحكمُ
 * حينها يقذف المستخدم إلى الدخول ثمّ يعود بعد لحظةٍ داخلاً — وقد ضاع
 * المسار الذي كان فيه.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuth = useAuthStore((s) => s.isAuth);
  const isRestoring = useAuthStore((s) => s.isRestoring);

  if (isRestoring) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05070d] text-white/40">
        <div className="flex items-center gap-3 text-sm font-bold">
          <Loader2 className="h-4 w-4 animate-spin" />
          استئناف الجلسة…
        </div>
      </div>
    );
  }

  if (!isAuth) return <Navigate to={PATHS.login} replace />;

  return <>{children}</>;
}
