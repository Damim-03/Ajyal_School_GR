/**
 * من حالةِ الاتصال إلى إشعارٍ على الشاشة.
 *
 * وفُصل عن `connection.ts` بقصد: ذاك **يقيس** ولا يعرف أنّ في التطبيق
 * إشعاراتٍ أصلاً، وهذا **يقول**. فمن أراد قياسَ الاتصال في شاشةٍ بلا
 * إشعارات (‏شريطُ حالةٍ في الترويسة مثلاً) يشترك في المتجر مباشرةً.
 *
 * **والاشتراكُ خارج React**: الانقطاعُ يقع في أيّ لحظة — أثناء طلبٍ
 * في الخلفية، أو والمستخدم في شاشةٍ لا علاقة لها بالشبكة. فلو رُبط
 * بمكوّنٍ لمات مع تفكيكه، وهذه حالةُ تطبيقٍ لا حالةُ شاشة.
 */

import { notify } from "../../components/notifications/notify";
import { useConnection, type ConnectionStatus } from "./connection";

/**
 * معرّفُ الإشعار المعلَّق — واحدٌ لا أكثر.
 *
 * ولولاه لتراكمت البطاقاتُ عند شبكةٍ متذبذبة: تسقط فتُرفع بطاقة، تعود
 * فتسقط فتُرفع ثانية… حتى تمتلئ الشاشةُ بأخبارٍ عن الشيء نفسه.
 */
let openNoticeId: number | null = null;

/** آخرُ حالةٍ أُعلنت — فلا يُعاد الإعلانُ عن الشيء نفسِه */
let announced: ConnectionStatus = "ONLINE";

const TEXT: Record<
  Exclude<ConnectionStatus, "ONLINE">,
  { title: string; detail: string }
> = {
  /*
   * وصلةُ الجهاز — والرسالةُ تقول **ما يجب أن يُفعل** لا ما وقع فحسب.
   * «انقطع الاتصال» وحدها تترك المستخدم يخمّن أين الخلل.
   */
  DEVICE_OFFLINE: {
    title: "انقطع الاتصال بالشبكة",
    detail: "تأكّد من كابل الشبكة أو الواي‑فاي. لن يُحفظ شيءٌ حتى يعود.",
  },
  SERVER_UNREACHABLE: {
    title: "تعذّر الوصول إلى الخادم",
    detail: "الشبكةُ تعمل، لكنّ خادمَ NexSchool لا يستجيب.",
  },
};

/**
 * تُنادى مرّةً عند إقلاع التطبيق.
 *
 * ولا تُعلن الحالةَ الابتدائية إن كانت سليمة: «أنت متّصل» عند كلّ
 * إقلاعٍ خبرٌ لا يعني أحداً. والإعلانُ عند **التبدّل** وحده.
 */
export const watchConnectionNotices = () => {
  useConnection.subscribe((state) => {
    if (state.status === announced) return;

    const previous = announced;
    announced = state.status;

    /* بطاقةُ الحالة السابقة تُرفع أوّلاً — الحالُ تبدّل فبطاقتُه لغت */
    if (openNoticeId !== null) {
      notify.dismiss(openNoticeId);
      openNoticeId = null;
    }

    if (state.status === "ONLINE") {
      /*
       * «عاد الاتصال» لا تُقال إلّا لمن رأى انقطاعاً.
       *
       * فالحالةُ قد تُضبط `ONLINE` عند أوّل طلبٍ ناجحٍ في الجلسة، ومن
       * لم يرَ تحذيراً لا يعنيه أن يُقال له إنّ ما لم ينقطع قد عاد.
       */
      if (previous !== "ONLINE") {
        notify.restored("عاد الاتصال", "يمكنك متابعة العمل.");
      }

      return;
    }

    const text = TEXT[state.status];

    openNoticeId = notify.offline(text.title, text.detail);
  });
};
