import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppRouter } from "./routes";
import { BootScreen } from "./features/boot/BootScreen";
import { NotificationHost } from "./components/notifications/NotificationHost";
import { useAuthStore } from "./core/stores/auth.store";
import { useSchoolStore } from "./core/stores/school.store";
import { useOverlayHeld } from "./motion/home-entrance";
import { warmUiSounds } from "./lib/ui-sound";
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
     * تهيئةُ النغمات — قبل أن تُطلب بكثير.
     *
     * الفكُّ لا يحتاج إيماءةً من المستخدم (السياقُ يُنشأ معلَّقاً ويفكّ
     * وهو كذلك)، وإنّما التشغيلُ هو المحبوس. فتهيئتُها هنا تعني أنّ أوّلَ
     * إشعارٍ في الجلسة يجد نغمتَه في الذاكرة فيُسمع مع بطاقته لا بعدها.
     */
    warmUiSounds();

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

  /**
   * يُنادى بعد **نجاح الدخول** لا بعد ضغط Enter.
   *
   * صارت المصادقةُ داخل تسلسل الإقلاع نفسِه: الإقلاع ← اختيار المستخدم
   * ← كلمة المرور. فالوجهةُ الرئيسيةُ لا صفحةَ الدخول — وإرسالُه إلى
   * `/login` وهو مُصادَقٌ كان سيُظهر له نموذجاً لا حاجة له ثمّ يقذفه.
   *
   * وصفحةُ الدخول تبقى في الموجّه لما بعد الخروج من الحساب.
   */
  const finish = () => {
    sessionStorage.setItem("ajyal_booted", "1");
    window.location.hash = PATHS.home;
    setBooted(true);
  };

  /**
   * هل ما زالت شاشةُ الإقلاع مركَّبةً فوق الرئيسية؟
   *
   * هنا يقع **التراكب** الذي تقوم عليه الرحلة كلُّها (§6). كان التبديلُ
   * حادّاً — `booted ? <AppRouter/> : <BootScreen/>` — أي أنّ الشجرة
   * الخارجةَ تُفكَّك في الإطار نفسِه الذي تُركَّب فيه الداخلة. ونتيجتُه
   * ليست انتقالاً سريعاً بل **إطارٌ لا يملكه أحد**: لوحةُ البيئة
   * تُدمَّر (‏`scene.destroy()`) قبل أن تُرسم الرئيسية، فيومض السوادُ
   * بينهما.
   *
   * الآن تتعايش الشجرتان نحوَ 260ms: الرئيسيةُ تُركَّب عند 120ms وتبدأ
   * استيقاظها، وشاشةُ الإقلاع تبقى فوقها تنسحب حتى 380ms. لا لحظةَ
   * تكون فيها الشاشةُ خاليةً من الاثنتين.
   *
   * ومَن يملك اللحظتين هو جدولُ الدخول لا مؤقّتٌ هنا — فلا رقمَ يجب أن
   * يطابق رقماً آخر يدوياً.
   */
  const overlayHeld = useOverlayHeld();

  return (
    <QueryClientProvider client={queryClient}>
      {booted && <AppRouter />}
      {(!booted || overlayHeld) && <BootScreen onDone={finish} />}

      {/*
        الإشعاراتُ فوق كلّ شيءٍ وخارج الموجّه.

        لو رُكّبت داخل صفحةٍ لماتت مع الانتقال، ونصفُ الإشعارات إنّما
        تُطلق عند الانتقال نفسِه («حُفظ ثمّ اذهب»). وهي هنا فوق شاشة
        الإقلاع أيضاً — فانقطاعُ الخادم قبل الدخول خبرٌ يستحقّ أن يُقال.
      */}
      <NotificationHost />
    </QueryClientProvider>
  );
}
