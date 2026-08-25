import { useCallback, useEffect, useState } from "react";

/**
 * **هل هذا الجهاز على الإنترنت؟ — سؤالٌ لا يجيب عنه `navigator.onLine`.**
 *
 * وهذا هو بيتُ القصيد. `navigator.onLine` يقول «للجهاز وصلةُ شبكة»، لا
 * «الجهاز يبلغ الإنترنت». وحاسوبٌ في قاعةِ إدارةٍ موصولٌ بمقسّمٍ لا
 * منفذَ له إلى الخارج يُرجع `true` — وهي الحالةُ الشائعة في مدرسةٍ
 * جزائرية بالضبط. فالاكتفاءُ به يعني أن نقول للمستخدم «متصل» ونحن لا
 * نعلم.
 *
 * ولذلك يُقاس على مرحلتين:
 *
 *   ① **`navigator.onLine` نافياً لا مثبِتاً.** إن كان `false` فالجواب
 *     قاطعٌ فوراً — لا كابلَ ولا واي‑فاي، فلا حاجةَ لإزعاج الشبكة
 *     بطلبٍ سيسقط. وإن كان `true` فهو **لا يكفي**، وننتقل إلى ②.
 *
 *   ② **طلبٌ حقيقيّ إلى الخارج.** وهو الدليلُ الوحيد.
 *
 * ## الطلب
 *
 * `mode: "no-cors"` لأنّنا لا نريد **قراءة** شيء: نجاحُ الطلب نفسِه هو
 * الجواب. والردُّ يأتي مبهماً (opaque) ولا نقرأ منه حرفاً، ولا يُرسَل
 * معه شيء — لا ملفّاتُ ارتباط، ولا ترويسةُ إحالة، ولا بيانُ مستخدم.
 * `credentials: "omit"` و`referrerPolicy: "no-referrer"` يقولان ذلك
 * صراحةً بدل الاعتماد على الافتراضيات.
 *
 * ## والمهلةُ ثلاثُ ثوانٍ
 *
 * الشبكةُ المقطوعةُ عن الخارج لا تردّ بالرفض — **تصمت**. فبلا مهلةٍ
 * يبقى السطرُ «يفحص…» إلى أن يقرّر النظامُ نفسُه، وقد يطول دقيقة.
 * وثلاثٌ تكفي لأبطأ اتصالٍ معقول، ولا تُشعر بالانتظار.
 *
 * ## وفشلُه لا يُعطّل شيئاً
 *
 * NexSchool يعمل داخل شبكة المؤسسة ولا يحتاج الإنترنت. فهذا الفحصُ
 * **إخبارٌ لا شرط**: يقول للمستخدم أين هو، ولا يمنعه من المضيّ.
 */

export type InternetStatus = "CHECKING" | "ONLINE" | "OFFLINE";

/**
 * المضيفُ المسؤول — ثابتٌ مسمّى ليُرى ويُبدَّل، لا مدفونٌ في السطر.
 *
 * نقطةٌ تُرجع 204 بلا جسم — أخفُّ ما يمكن أن يُطلب. واختيرت لأنّها
 * الغرضُ الوحيد لها: هي ما تستعمله أنظمةُ التشغيل نفسُها لتقرّر إن
 * كانت الشبكةُ تبلغ الخارج.
 *
 * ومن أراد مضيفاً آخر — أو مضيفاً داخل مؤسسته — يبدّل هذا السطر وحده.
 */
export const INTERNET_PROBE_URL = "https://www.gstatic.com/generate_204";

const TIMEOUT_MS = 3000;

/**
 * فحصةٌ واحدة. تُرجع `false` عند أيّ فشل — لا ترمي أبداً.
 *
 * فالمستدعي شاشةٌ في معالج تهيئة، وسقوطُها لأجل فحصٍ إخباريّ أسوأُ
 * بكثيرٍ من جوابٍ يقول «لا إنترنت» وهو مخطئ.
 */
export async function checkInternet(): Promise<boolean> {
  /* نافياً لا مثبِتاً — انظر أعلاه. */
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;

  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    await fetch(INTERNET_PROBE_URL, {
      mode: "no-cors",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: abort.signal,
    });

    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/** حالةُ الإنترنت لشاشةٍ ما — تُفحص عند التركيب، وتُعاد عند الطلب. */
export function useInternet(): { status: InternetStatus; recheck: () => void } {
  const [status, setStatus] = useState<InternetStatus>("CHECKING");

  /**
   * الفحصُ وحده — بلا `setStatus("CHECKING")` قبله.
   *
   * والفصلُ مقصود: التركيبُ يبدأ من `"CHECKING"` أصلاً (قيمةُ البدء)،
   * فضبطُها ثانيةً داخل جسم الأثر عرضٌ زائدٌ لا يغيّر شيئاً — وهو ما
   * تمنعه قاعدةُ `set-state-in-effect`. أمّا `recheck` فتضبطها لأنّها
   * تُنادى من يد المستخدم لا من أثر.
   */
  const probe = useCallback(() => {
    let alive = true;

    void checkInternet().then((ok) => {
      if (alive) setStatus(ok ? "ONLINE" : "OFFLINE");
    });

    return () => {
      alive = false;
    };
  }, []);

  const recheck = useCallback(() => {
    setStatus("CHECKING");
    probe();
  }, [probe]);

  useEffect(() => {
    const stop = probe();

    /*
     * نزعُ الكابل يجب أن يُغيّر السطرَ في حينه لا أن ينتظر فحصاً يدوياً.
     * و`online` لا يُصدَّق وحده — يُعاد الفحصُ الحقيقيّ عنده، للسبب
     * نفسِه الذي جعله لا يكفي في المرحلة ①.
     */
    const onOffline = () => setStatus("OFFLINE");
    const onOnline = () => recheck();

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      stop();
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [probe, recheck]);

  return { status, recheck };
}
