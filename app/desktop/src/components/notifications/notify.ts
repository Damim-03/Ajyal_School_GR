/**
 * الإشعارات — متجرٌ واحد، ونداءٌ من أيّ مكان.
 *
 * كان في كلّ شاشةٍ `flash()` خاصّةٌ بها: حالةٌ محلّية و`setTimeout`
 * وعنصرٌ يُرسم في أسفل الملفّ. سبعُ نسخٍ من الشيء نفسه بسبعِ مدد
 * وسبعةِ أشكال، ولا واحدةَ منها تصدر صوتاً — والإشعارُ بلا صوتٍ نصفُ
 * إشعار: من نظر إلى مكانٍ آخر لحظةَ ظهوره لم يعلم أنّ شيئاً وقع.
 *
 * **والنداءُ ليس خطّافاً (hook).** الإشعارُ يُطلق من معالج حدث، ومن
 * دالّة async، ومن مُعترِض axios لا مكوّنَ حوله. فهو دالّةٌ عادية
 * تُستدعى من أيّ موضع — والمكوّنُ الوحيد الذي يقرأ المتجر هو الذي
 * يرسم.
 */

import { create } from "zustand";

import { uiSound } from "../../lib/ui-sound";

/**
 * أنواعُ الإشعار — وهي تصنيفُ PS5 نفسُه، ولكلٍّ نغمتُه المسجّلة.
 *
 *   info    ← «شيءٌ يُقرأ»       خبرٌ لا يُطلب عليه فعل
 *   success ← تمَّ ما طُلب
 *   action  ← «شيءٌ يُفعَل»      فيه زرٌّ ينتظر، فلا يُطوى من نفسه
 *   error   ← «شيءٌ انكسر»
 *   trophy  ← إنجازٌ يستحقّ الوقوف — نادرٌ عمداً
 *   welcome ← ترحيبُ الدخول — مرّةً واحدة في الجلسة
 *   offline ← انقطع الطريقُ إلى الخادم — **لا يُطوى من نفسه**
 *   restored ← عاد الاتصال
 *
 * والتصنيفُ ليس لوناً فحسب: هو الذي يقرّر النغمة والمدّة وهل يُطوى
 * تلقائياً. ولو كان واحداً لتساوى «حُفظ» و«تعذّر الاتصال» في الأذن.
 */
export type NoticeKind =
  | "info"
  | "success"
  | "action"
  | "error"
  | "trophy"
  | "welcome"
  | "offline"
  | "restored";

export interface Notice {
  id: number;
  kind: NoticeKind;
  title: string;
  /** سطرٌ ثانٍ اختياري — التفصيل الذي لا يسع العنوان */
  detail?: string;
  /** مدّةُ البقاء؛ صفرٌ يعني «لا يُطوى إلّا بيد» */
  ttl: number;
  action?: { label: string; run: () => void };
  /** لحظةُ الإطلاق — يقرؤها السجلّ ليقول «منذ كم». */
  at: number;
}

/** قيدٌ في السجلّ: الإشعار نفسُه، وهل رآه المستخدم. */
export interface ArchivedNotice extends Notice {
  read: boolean;
}

interface NoticeStore {
  /** المعروضُ الآن — يُطوى من نفسه أو بيد. */
  notices: Notice[];
  /**
   * **السجلّ — وهو المشكلة التي كان يحلّها غيابُه.**
   *
   * الإشعارُ كان يُعرض ثوانيَ ثمّ يُمحى محواً. فمن كان ينظر إلى مكانٍ
   * آخر — أو غادر مكتبَه — لا سبيلَ له إلى معرفة ما وقع. والصوتُ وحده
   * لا يكفي: هو يقول «حدث شيء» ولا يقول ماذا.
   *
   * فصار البثُّ شيئاً والحفظُ شيئاً: القائمةُ الأولى تنطوي، وهذه تبقى.
   */
  history: ArchivedNotice[];
  dismiss: (id: number) => void;
  markAllRead: () => void;
  clearHistory: () => void;
}

/**
 * أربعةٌ على الشاشة لا أكثر.
 *
 * عمليةٌ تُطلق عشرةَ إشعاراتٍ متتابعة تملأ الشاشة وتحجب ما تحتها،
 * والأقدمُ منها لم يُقرأ أصلاً. فيُزاح الأقدمُ لمن بعده — كما يفعل
 * الجهاز.
 */
const MAX_VISIBLE = 4;

/**
 * حدُّ السجلّ.
 *
 * خمسون تكفي ليومِ عملٍ كامل، وتمنع أن يتضخّم في جلسةٍ طويلة حتى يصير
 * تمريرُه أطولَ من قراءته. والأقدمُ يسقط — فالإشعارُ خبرٌ تنقص قيمتُه
 * بالزمن، بخلاف السجلّ المحاسبي.
 *
 * ولا يُحفظ بين الجلسات عمداً: هذه أخبارُ الجلسة الجارية، وإحياؤها بعد
 * إعادة التشغيل يعرض على المستخدم ما عالجه أمس كأنّه وقع الآن.
 */
const MAX_HISTORY = 50;

export const useNotices = create<NoticeStore>((set) => ({
  notices: [],
  history: [],

  /* الطيُّ يخصّ المعروضَ وحده — السجلّ لا يُمسّ. */
  dismiss: (id) =>
    set((state) => ({ notices: state.notices.filter((n) => n.id !== id) })),

  markAllRead: () =>
    set((state) => ({ history: state.history.map((n) => ({ ...n, read: true })) })),

  clearHistory: () => set({ history: [] }),
}));

let nextId = 1;

/**
 * المدّةُ بحسب النوع.
 *
 * الخطأُ يبقى أطول: من فاته «حُفظ» لم يفته شيء، ومن فاته «تعذّر
 * الحفظ» ظنّ أنّ عملَه محفوظ. و`action` لا يُطوى أبداً — فيه زرٌّ
 * ينتظر، وطيُّه يُضيع الفعلَ الذي عُرض.
 */
const TTL: Record<NoticeKind, number> = {
  info: 4200,
  success: 3600,
  action: 0,
  error: 7000,
  trophy: 5200,
  /* أطولُ قليلاً: يُقرأ اسمٌ ودور، ويقع مرّةً فلا يُزعج بقاؤه */
  welcome: 5600,
  /*
   * الانقطاعُ **حالةٌ لا خبر** — فلا يُطوى بمؤقّت.
   *
   * وطيُّه بعد سبع ثوانٍ كان سيعني أن يعود المستخدمُ إلى الكتابة في
   * نموذجٍ لن يُحفظ، وقد رأى التحذيرَ ونسيه. فيبقى ما دام السببُ
   * قائماً، ويرفعه `connection-notice` حين يعود الخادم — لا مؤقّتٌ.
   */
  offline: 0,
  restored: 3600,
};

const SOUND = {
  info: "notifyInfo",
  success: "notifySuccess",
  action: "notifyAction",
  error: "notifyError",
  trophy: "notifyTrophy",
  welcome: "notifyWelcome",
  offline: "notifyError",
  restored: "notifySuccess",
} as const;

const push = (
  kind: NoticeKind,
  title: string,
  options: { detail?: string; ttl?: number; action?: Notice["action"] } = {},
) => {
  const id = nextId++;

  const notice: Notice = {
    id,
    kind,
    title,
    detail: options.detail,
    ttl: options.ttl ?? TTL[kind],
    action: options.action,
    at: Date.now(),
  };

  useNotices.setState((state) => ({
    notices: [...state.notices, notice].slice(-MAX_VISIBLE),
    /*
     * السجلّ **يُقلَب**: الأحدثُ أوّلاً.
     *
     * القلبُ هنا لا عند العرض: اللوحةُ تقرأ وتُصيّر، وفرزُها في كلّ
     * عرضٍ عملٌ مكرّر بلا سبب — والترتيبُ خاصّيةُ السجلّ لا خاصّيةُ من
     * ينظر إليه.
     *
     * و`action` لا يُحفظ: هو دالّةٌ تُغلق على حالةِ الشاشة التي أطلقته،
     * وتلك الشاشةُ قد فُكّكت منذ زمن. زرٌّ في السجلّ يستدعي سياقاً ميّتاً
     * أسوأ من غياب الزرّ.
     */
    history: [
      { ...notice, action: undefined, read: false },
      ...state.history,
    ].slice(0, MAX_HISTORY),
  }));

  uiSound(SOUND[kind]);

  return id;
};

/**
 * الواجهةُ العامّة.
 *
 * `notify.error(...)` تُقرأ في موضع الاستدعاء بلا شرح — وهي أوضحُ من
 * `push("error", ...)` لأنّ النوعَ صار جزءاً من الجملة لا وسيطاً فيها.
 */
export const notify = {
  info: (title: string, detail?: string) => push("info", title, { detail }),
  success: (title: string, detail?: string) => push("success", title, { detail }),
  error: (title: string, detail?: string) => push("error", title, { detail }),
  trophy: (title: string, detail?: string) => push("trophy", title, { detail }),
  welcome: (title: string, detail?: string) => push("welcome", title, { detail }),

  /** يبقى حتى يُفعَل أو يُطوى بيد — فيه زرٌّ ينتظر */
  action: (title: string, label: string, run: () => void, detail?: string) =>
    push("action", title, { detail, action: { label, run } }),

  /** انقطاعُ الاتصال — يبقى حتى يُرفع بـ`dismiss` عند العودة */
  offline: (title: string, detail?: string) => push("offline", title, { detail }),
  restored: (title: string, detail?: string) =>
    push("restored", title, { detail }),

  dismiss: (id: number) => useNotices.getState().dismiss(id),
  clear: () => useNotices.setState({ notices: [] }),
};

/** عددُ ما لم يُقرأ — تقرؤه شارةُ الجرس. */
export const useUnreadCount = () =>
  useNotices((s) => s.history.reduce((n, x) => n + (x.read ? 0 : 1), 0));
