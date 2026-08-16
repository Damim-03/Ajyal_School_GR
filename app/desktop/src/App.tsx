import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppRouter } from "./routes";
import { BootScreen } from "./features/boot/BootScreen";
import { useAuthStore } from "./core/stores/auth.store";
import { useSchoolStore } from "./core/stores/school.store";
import { PATHS } from "./routes/paths";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

export default function App() {
  // تُعرض شاشة الإقلاع مرّة واحدة لكل جلسة تشغيل
  const [booted, setBooted] = useState(
    () => sessionStorage.getItem("ajyal_booted") === "1",
  );

  useEffect(() => {
    const auth = useAuthStore.getState();

    /*
     * هوية المدرسة تُحمَّل مرّة لكل جلسة — هنا لا في كل شاشة.
     * الترويسة والإيصالات تقرأها من متجرٍ عامّ، فوجب أن تكون حاضرة
     * قبل أوّل رسم لا عند فتح شاشة الإعدادات.
     */
    const loadSchool = () => useSchoolStore.getState().load();

    // تشغيل جديد ⇒ أنهِ الجلسة المحفوظة ليمرّ المستخدم بالتسلسل كاملاً:
    // الإقلاع ← الدخول ← الرئيسية
    if (!booted) {
      auth.logout();
      return;
    }

    /*
     * وإعادةُ التحميل ليست تشغيلاً جديداً.
     *
     * Ctrl+R يُبقي `sessionStorage` فيتخطّى الإقلاع، لكنّ التوكن يعيش
     * في الذاكرة فيضيع — فكان المستخدم يُقذف إلى الدخول ويعيد اختيار
     * شاشته في كل مرّة. وكعكةُ التجديد صالحةٌ سبعةَ أيام، فالجلسة
     * تُستأنف منها والمسار في الـhash يبقى كما هو.
     */
    auth.restore().then((ok) => {
      if (ok) loadSchool();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    sessionStorage.setItem("ajyal_booted", "1");
    window.location.hash = PATHS.login;
    setBooted(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      {booted ? <AppRouter /> : <BootScreen onDone={finish} />}
    </QueryClientProvider>
  );
}
