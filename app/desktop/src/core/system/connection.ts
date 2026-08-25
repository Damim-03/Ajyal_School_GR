/**
 * مراقبةُ الاتصال — **وما ينقطع هنا ليس «الإنترنت»**.
 *
 * NexSchool يعمل داخل شبكة المؤسسة: نافذةٌ على المكتب وخادمٌ إمّا على
 * الجهاز نفسِه أو على جهاز الإدارة. فالانقطاعُ الذي يوقف العملَ فعلاً
 * هو **انقطاعُ الطريق إلى الخادم** — وقد يقع والإنترنتُ سليم (أُطفئ
 * جهازُ الإدارة، أو نُزع كابلُ الشبكة، أو سقطت الخدمة).
 *
 * ولذلك يُقاس الأمران معاً، ويُقال للمستخدم أيُّهما وقع:
 *
 *   ① **وصلةُ الجهاز** — `navigator.onLine` وحدثاها. جوابٌ قاطعٌ
 *      وفوريّ حين يُنزع الكابل أو يسقط الواي‑فاي.
 *
 *   ② **بلوغُ الخادم** — تُبلَّغ عن كلّ طلبٍ سقط **بلا ردّ** (‏لا 500
 *      ولا 403: تلك ردودٌ، أي أنّ الخادم حيّ). وطلبٌ واحدٌ ساقطٌ لا
 *      يكفي — قد يكون عارضاً — فالعتبةُ اثنان متتاليان.
 *
 * **والتعافي يُقاس ولا يُفترض**: ما دام الاتصالُ مقطوعاً يُسأل
 * `/api/health` كلَّ خمس ثوانٍ. فلا يبقى الإشعارُ معلّقاً بعد أن عاد
 * الخادم، ولا يُطلب من المستخدم أن يُحدّث الصفحة ليكتشف ذلك بنفسه.
 */

import { create } from "zustand";

import { apiBaseUrl } from "../api/base-url";

export type ConnectionStatus = "ONLINE" | "DEVICE_OFFLINE" | "SERVER_UNREACHABLE";

interface ConnectionState {
  status: ConnectionStatus;
  /** متى وقع الانقطاع — يقرؤه الإشعارُ ليقول «منذ كم» */
  since: number | null;
}

export const useConnection = create<ConnectionState>()(() => ({
  status: "ONLINE",
  since: null,
}));

/** عتبةُ السقوط: طلبان متتاليان بلا ردّ */
const FAILURE_THRESHOLD = 2;

/** إيقاعُ إعادة السؤال أثناء الانقطاع وحده */
const RECHECK_MS = 5000;

let consecutiveFailures = 0;
let recheckTimer: number | null = null;
let started = false;

const set = (status: ConnectionStatus) => {
  const current = useConnection.getState().status;

  if (current === status) return;

  useConnection.setState({
    status,
    since: status === "ONLINE" ? null : Date.now(),
  });
};

/**
 * سؤالُ الخادم مباشرةً — لا عبر `apiClient`.
 *
 * فمُعترِضُ العميل يلاحق 401 ويطلب تجديدَ توكن ثمّ يُسقط الجلسة، وهذا
 * فحصُ حياةٍ لا طلبُ بيانات: لا يعني بجوابه شيئاً سوى «وصل أم لم يصل».
 * و`fetch` بمهلةٍ قصيرة أخفُّ ما يؤدّي ذلك.
 */
const pingServer = async (): Promise<boolean> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(`${apiBaseUrl()}/health`, {
      signal: controller.signal,
      /*
       * `no-store` شرطٌ لا تحسين: ردٌّ مخزَّنٌ من قبل الانقطاع يجعل
       * الفحصَ ينجح على خادمٍ ساقط — أي فحصُ حياةٍ يشهد بحياة ميّت.
       */
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
};

const stopRecheck = () => {
  if (recheckTimer !== null) {
    window.clearInterval(recheckTimer);
    recheckTimer = null;
  }
};

const startRecheck = () => {
  if (recheckTimer !== null) return;

  recheckTimer = window.setInterval(() => {
    /* لا فائدةَ من سؤال الخادم ووصلةُ الجهاز مقطوعة أصلاً */
    if (!navigator.onLine) return;

    void pingServer().then((alive) => {
      if (!alive) return;

      consecutiveFailures = 0;
      set("ONLINE");
      stopRecheck();
    });
  }, RECHECK_MS);
};

/**
 * يُبلَّغ من مُعترِض `apiClient` عن طلبٍ سقط بلا ردّ.
 *
 * و«بلا ردّ» قيدٌ دقيق: خادمٌ يردّ 500 خادمٌ **حيّ** — عطبُه في طلبٍ
 * بعينه لا في الطريق إليه. ورفعُ لافتة «انقطع الاتصال» عليه يُرسل
 * المستخدمَ يفحص الكابلاتِ لأجل خطأٍ في الشيفرة.
 */
export const reportRequestFailure = () => {
  if (!navigator.onLine) {
    set("DEVICE_OFFLINE");
    startRecheck();
    return;
  }

  consecutiveFailures += 1;

  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    set("SERVER_UNREACHABLE");
    startRecheck();
  }
};

/** يُبلَّغ عن كلّ طلبٍ وصل — ردُّه هو الدليلُ على أنّ الطريق قائم */
export const reportRequestSuccess = () => {
  consecutiveFailures = 0;

  if (useConnection.getState().status !== "ONLINE") {
    set("ONLINE");
    stopRecheck();
  }
};

/**
 * يُركَّب مرّةً عند إقلاع التطبيق.
 *
 * وحدثا المتصفّح يقولان الحقيقةَ في اتجاهٍ واحد: `offline` قاطعٌ —
 * لا وصلةَ فلا خادم. أمّا `online` فيعني «عادت الوصلة»، ولا يعني أنّ
 * الخادمَ عاد معها؛ فيُسأل ولا يُصدَّق.
 */
export const startConnectionWatch = () => {
  if (started || typeof window === "undefined") return;

  started = true;

  window.addEventListener("offline", () => {
    set("DEVICE_OFFLINE");
    startRecheck();
  });

  window.addEventListener("online", () => {
    consecutiveFailures = 0;

    void pingServer().then((alive) => {
      if (alive) {
        set("ONLINE");
        stopRecheck();
      } else {
        set("SERVER_UNREACHABLE");
        startRecheck();
      }
    });
  });

  if (!navigator.onLine) {
    set("DEVICE_OFFLINE");
    startRecheck();
  }
};
