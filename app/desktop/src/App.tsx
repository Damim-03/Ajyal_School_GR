import { useCallback, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppRouter } from "./routes";
import { BootScreen } from "./features/boot/BootScreen";
import { HandoffCurtain } from "./features/boot/HandoffCurtain";
import { FirstBoot } from "./features/first-boot/FirstBoot";
import { NotificationHost } from "./components/notifications/NotificationHost";
import { PowerScreen } from "./features/boot/PowerScreen";
import { useAuthStore } from "./core/stores/auth.store";
import { useSchoolStore } from "./core/stores/school.store";
import { useOverlayHeld } from "./motion/home-entrance";
import { queryTuning } from "./core/system/preferences";
import { warmUiSounds } from "./lib/ui-sound";
import { PATHS } from "./routes/paths";

/**
 * إيقاعُ البيانات يُقرأ من تفضيلات النظام لا يُكتب رقماً.
 *
 * `staleTime` كانت خمسَ دقائقَ ثابتة، وصار للمستخدم رأيٌ فيها من شاشة
 * «الأداء» في التهيئة (§13): دقيقةٌ في ملمح الأداء، وربعُ ساعةٍ في
 * توفير الطاقة. وهذا هو ما يجعل ذلك الخيارَ حقيقياً لا وصفاً.
 *
 * ويُقرأ مرّةً عند الإقلاع: `QueryClient` يُنشأ مرّةً، وتبديلُ الملمح
 * يسري على الجلسة التالية. وإعادةُ بنائه في أثناء التشغيل تُسقط
 * المخزَّنَ كلَّه — ثمنٌ أكبرُ ممّا يشتريه.
 */
const tuning = queryTuning();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: tuning.refetchOnWindowFocus,
      staleTime: tuning.staleTime,
    },
  },
});

export default function App() {
  /**
   * التهيئةُ الأولى — **البوّابةُ التي تسبق كلَّ شيء** (§2/§25).
   *
   * ثلاثُ حالات: `null` = لم يُسأل الخادمُ بعد، `true` = مهيَّأ،
   * `false` = يحتاج تهيئة. والابتداءُ بـ`null` مقصود: لا يُركَّب
   * الموجّهُ ولا شاشةُ الإقلاع قبل أن يُعرف الجواب — وإلّا ومض
   * التطبيقُ لحظةً ثمّ حجبته التهيئةُ فوقه.
   */
  const [initialized, setInitialized] = useState<boolean | null>(null);

  /** هل انتهت التهيئةُ في هذه الجلسة؟ — يُقصّر ما بعدها ويوجّه إلى «مرحباً» */
  const [freshSetup, setFreshSetup] = useState(false);

  /**
   * طبقةُ التهيئة ما زالت منسحبةً فوق ما تحتها (§54).
   *
   * فلولاها لفُكّكت في الإطار نفسِه الذي يُركَّب فيه الإقلاعُ تحتها —
   * أي أنّ حركةَ الانسحاب لا تُرى أصلاً، ويقع بين المشهدين إطارٌ لا
   * يملكه أحد. وهي المشكلةُ نفسُها التي حُلّت بـ`overlayHeld` بين
   * الإقلاع والرئيسية، وبالحلّ نفسِه: تعايشٌ قصيرٌ لا تبديلٌ حادّ.
   */
  const [handoffHeld, setHandoffHeld] = useState(false);

  // تُعرض شاشةُ الإقلاع مرّة واحدة لكل جلسة تشغيل
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
   * تسليمُ التهيئة.
   *
   * و`justCompleted` يفرّق حالتين تبدوان واحدة: تركيبٌ كان مهيَّأً قبل
   * أن يُفتح التطبيقُ اليوم (تسليمٌ صامت، والإقلاعُ يمضي بمقدّمته
   * كاملة)، وتركيبٌ أُتمّ قبل ثوانٍ — فيُتخطّى الشعارُ والتحذيرُ
   * و«اضغط Enter»، ويُوجَّه أوّلُ دخولٍ إلى شاشة «مرحباً بك» (§30/§65).
   */
  const onSetupDone = useCallback((justCompleted: boolean) => {
    setFreshSetup(justCompleted);
    /* التسليمُ الصامتُ لا انسحابَ له — لا شيءَ عُرض ليُسحب */
    setHandoffHeld(justCompleted);
    setInitialized(true);
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

    /*
     * أوّلُ دخولٍ بعد التهيئة يذهب إلى «مرحباً بك» لا إلى الرئيسية.
     *
     * فالنظامُ جاهزٌ والمؤسسةُ لم تُبنَ بعد: لا موادَّ ولا أفواجَ ولا
     * طلبة. والرئيسيةُ حينها شبكةُ بلاطاتٍ تفتح شاشاتٍ فارغة — وأسوأُ
     * ما يُستقبَل به مستخدمٌ جديدٌ أن يُترك أمام تطبيقٍ لا يعرف من أين
     * يبدأ فيه (§30).
     */
    window.location.hash = freshSetup ? PATHS.welcome : PATHS.home;
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
      {/*
        قبل الجواب: لا موجّهَ ولا إقلاع.

        و`FirstBoot` هي التي تسأل — وتعرض شاشةَ انتظارها ثمّ تُسلّم.
        فالبوّابةُ والسؤالُ في مكانٍ واحد، ولا حالةَ ثالثةٌ تُدار هنا.
      */}
      {(initialized !== true || handoffHeld) && (
        <FirstBoot
          onComplete={onSetupDone}
          onGone={() => setHandoffHeld(false)}
        />
      )}

      {initialized === true && (
        <>
          {booted && <AppRouter />}
          {(!booted || overlayHeld) && (
            <BootScreen onDone={finish} skipIntro={freshSetup} />
          )}
        </>
      )}

      {/*
        ستارُ التسليم — **فوق الشجرة كلِّها، لا داخل إحدى الشاشتين**.

        طريقا الوصول إلى الرئيسية مختلفان بنيوياً: من الإقلاع تبقى
        `BootScreen` مركَّبةً فوقها وتنسحب، ومن الخروج من الحساب تُبدَّل
        صفحةُ `SignInPage` في الموجّه فلا يبقى فوق التركيب شيء. فلو رُسم
        الستارُ داخل إحداهما لغطّى طريقاً وترك الآخر مكشوفاً.

        وهو هنا حتى قبل الجواب عن التهيئة: سطحٌ شفّافٌ لا يلتقط المؤشّر،
        لا يُرى إلّا حين يرفعه جدولُ الدخول. وبقاؤه مركَّباً هو شرطُ أن
        يعلوَ على المُركِّب وحده بينما يُحجَب الخيطُ تحته.
      */}
      <HandoffCurtain />

      {/*
        الإشعاراتُ فوق كلّ شيءٍ وخارج الموجّه.

        لو رُكّبت داخل صفحةٍ لماتت مع الانتقال، ونصفُ الإشعارات إنّما
        تُطلق عند الانتقال نفسِه («حُفظ ثمّ اذهب»). وهي هنا فوق شاشة
        الإقلاع أيضاً — فانقطاعُ الخادم قبل الدخول خبرٌ يستحقّ أن يُقال.
      */}
      <NotificationHost />

      {/*
        شاشةُ الإطفاء — **آخرُ ما يُرسم، وفوق الإشعارات نفسِها**.

        الطلبُ يأتي من زرِّ الطاقة في شاشة اختيار المستخدم، وهي شاشةٌ
        تحتها في الشجرة. فلو رُسمت الشاشةُ هناك لصارت طبقةً ملءَ الشاشة
        داخلَ صفٍّ من الأزرار، ولوَرثت انسحابَ ما فوقها.

        وهي لا ترسم شيئاً ما لم يُطلب فعلٌ — فوجودُها الدائمُ هنا لا ثمنَ
        له، وهو ما يجعلها تعمل من أيّ شاشةٍ تُضاف غداً.
      */}
      <PowerScreen />
    </QueryClientProvider>
  );
}
