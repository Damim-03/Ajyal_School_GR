/**
 * متجرُ التهيئة — **مرآةٌ لحالة الخادم، لا مصدرٌ ثانٍ لها**.
 *
 * وهذا هو القيدُ الذي يحكم الملفَّ كلَّه: لا خطوةَ تتقدّم هنا إلّا وقد
 * تقدّمت هناك. فما مِن `setStep` عامّة ولا `next()` تُنادى من زرّ —
 * كلُّ انتقالٍ نتيجةُ ردٍّ من الخادم (§7). ولو مُلكت الخطوةُ هنا لأمكن
 * أن تُعرض شاشةُ «المؤسسة» بينما القاعدةُ لم تسجّل مديراً بعد.
 *
 * وما يملكه المتجرُ حقّاً ثلاثةٌ لا تخصّ الخادم:
 *   • اللغةُ المعروضةُ الآن — تتبدّل قبل أن يصل الردّ (§9).
 *   • حالةُ الإرسال والخطأ — شأنُ الشاشة لا شأنُ القاعدة.
 *   • المرحلةُ البصرية (`BOOTING`/`WELCOME`) التي لا تُسجَّل أصلاً.
 */

import { create } from "zustand";

import {
  initialLanguage,
  isLanguage,
} from "../i18n";
import {
  applyLanguage,
  reconcileFromState,
} from "../services/initialization.service";
import { clearAllDrafts, clearDraft, markVisited } from "../utils/recovery";
import * as api from "../services/firstBoot.service";
import { FirstBootError, type FirstBootErrorKind } from "../services/firstBoot.service";
import type {
  BootPhase,
  FirstBootState,
  FirstBootStep,
  Language,
  VerificationResult,
} from "../types/firstBoot.types";

interface Store {
  /** ما يُعرض الآن — أوسعُ من خطوة الخادم (`BOOTING`/`WELCOME`) */
  phase: BootPhase;
  language: Language;
  state: FirstBootState | null;
  verification: VerificationResult | null;

  /** جارٍ إرسالُ خطوة — يقفل الزرَّ الأساسيّ ولا يقفل الشاشة */
  submitting: boolean;
  /** تعذّر الوصولُ إلى الخادم عند الإقلاع — شاشةُ إعادة المحاولة */
  bootError: FirstBootErrorKind | null;
  error: FirstBootErrorKind | null;
  fieldErrors: Record<string, string>;

  /** هل هذه عودةٌ بعد انقطاع؟ — «أهلاً بعودتك» (§3) */
  resumed: boolean;

  load: () => Promise<void>;
  setLanguage: (language: Language) => void;
  beginSetup: () => void;
  /** يُنادى من كلّ شاشة: تُرسل، فتتقدّم الحالةُ بردّ الخادم */
  submit: (step: FirstBootStep, run: () => Promise<FirstBootState>) => Promise<boolean>;
  back: (from: FirstBootStep) => Promise<void>;
  runVerification: () => Promise<VerificationResult | null>;
  finish: () => Promise<boolean>;
  clearError: () => void;
}

/** الخطوةُ المعروضةُ تُشتقّ من حالة الخادم — لا تُخزَّن مستقلّةً */
const phaseFor = (state: FirstBootState, wasResumed: boolean): BootPhase => {
  if (state.status === "COMPLETED") return "COMPLETED";

  /*
   * تركيبٌ جديدٌ لم يبدأ ⇒ شاشةُ الترحيب. أمّا العائدُ فيُقذف إلى
   * خطوته مباشرةً: أن يُعرض «مرحباً — لنبدأ» على من قطع نصفَ الطريق
   * يوحي بأنّ ما فعله ضاع (§3).
   */
  if (state.status === "NOT_STARTED" && state.done.length === 0 && !wasResumed) {
    return "WELCOME";
  }

  /*
   * **«أنت جاهز» لتركيبٍ مُتَمٍّ وحدَه.**
   *
   * الشرطُ الأوّلُ في هذه الدالّة يغطّيها: `COMPLETED` ⇒ تسليمٌ صامت.
   * فبلوغُ هذا السطر بـ`READY` يعني تناقضاً — خطوةُ التتويج مع حالةٍ
   * غيرِ متمّة — وهي حالةٌ كان الخادمُ يُنتجها فعلاً بعد نجاح الفحص
   * وقبل ضغط زرّ الإتمام. ونتيجتُها أنّ المستخدم يرى شاشةَ «أنت جاهز»
   * في كلّ إقلاعٍ إلى الأبد، وزرُّها يُسلّم ولا يُتمّ.
   *
   * وقد سُدّت في `first-boot.state.ts` عند المصدر. وهذا حارسٌ ثانٍ:
   * المتجرُ مرآةُ الخادم، ومرآةٌ لا تُصحّح ما تعكسه — لكنّها لا تعرض
   * تتويجاً لم يُستحقّ. فتُعاد شاشةُ التحقّق، وهي وحدها تملك الزرَّ
   * الذي يُتمّ.
   */
  if (state.current === "READY") return "FINAL_VERIFICATION";

  return state.current;
};

export const useFirstBootStore = create<Store>()((set, get) => ({
  phase: "BOOTING",
  language: initialLanguage(),
  state: null,
  verification: null,
  submitting: false,
  bootError: null,
  error: null,
  fieldErrors: {},
  resumed: false,

  // --------------------------------------------------
  // القراءةُ الأولى — عند كلّ إقلاعٍ للتطبيق (§25)
  // --------------------------------------------------

  load: async () => {
    set({ bootError: null });

    try {
      const state = await api.fetchState();

      /*
       * لغةُ الخادم تسبق لغةَ الجهاز.
       *
       * فمن اختار الفرنسيةَ في التهيئة يجدها فرنسيةً على أيّ جهازٍ
       * يُركَّب على القاعدة نفسِها — وهو معنى أن تكون اللغةُ اختيارَ
       * مؤسسةٍ لا إعدادَ متصفّح.
       */
      const language = isLanguage(state.answers.language)
        ? state.answers.language
        : get().language;

      applyLanguage(language);
      await reconcileFromState(state);

      const resumed = state.done.length > 0 && state.status !== "COMPLETED";

      set({
        state,
        language,
        resumed,
        phase: phaseFor(state, resumed),
      });

      if (state.status !== "COMPLETED") markVisited();
    } catch (error) {
      const kind =
        error instanceof FirstBootError ? error.kind : "generic";

      set({ bootError: kind, phase: "BOOTING" });
    }
  },

  // --------------------------------------------------
  // اللغة — تتبدّل فوراً ثمّ تُرسَل (§9)
  // --------------------------------------------------

  setLanguage: (language) => {
    applyLanguage(language);
    set({ language });
  },

  beginSetup: () => {
    const state = get().state;

    set({ phase: state ? state.current : "LANGUAGE" });
  },

  // --------------------------------------------------
  // إرسالُ خطوة
  // --------------------------------------------------

  submit: async (step, run) => {
    if (get().submitting) return false;

    set({ submitting: true, error: null, fieldErrors: {} });

    try {
      const state = await run();

      /* وصلت الخطوةُ إلى القاعدة ⇒ لم تعد مسوّدتُها تعني شيئاً */
      clearDraft(step);

      set({
        state,
        phase: phaseFor(state, true),
        submitting: false,
        /* التقدّمُ يُبطل نتيجةَ تحقّقٍ سابق: قِيست حالةٌ لم تعد قائمة */
        verification: null,
      });

      return true;
    } catch (error) {
      if (!(error instanceof FirstBootError)) {
        set({ submitting: false, error: "generic" });
        return false;
      }

      /*
       * «خارج الترتيب» أو «مكتملة» تعني أنّ الخادمَ يعرف ما لا تعرفه
       * هذه النافذة — نافذةٌ أخرى تقدّمت، أو أُعيدت التهيئة. فتُعاد
       * قراءةُ الحالة بدل الإصرار على شاشةٍ لم تعد قائمة (§26).
       */
      if (error.kind === "outOfOrder" || error.kind === "alreadyCompleted") {
        set({ submitting: false, error: error.kind });
        await get().load();
        return false;
      }

      set({
        submitting: false,
        error: error.kind,
        fieldErrors: error.fields,
      });

      return false;
    }
  },

  // --------------------------------------------------
  // الرجوع
  // --------------------------------------------------

  back: async (from) => {
    if (get().submitting) return;

    set({ submitting: true, error: null });

    try {
      const state = await api.stepBack(from);

      set({
        state,
        /* الخادمُ يُرجع الوجهةَ في `current` — فتُقرأ منه لا تُحسب هنا */
        phase: state.current,
        submitting: false,
        verification: null,
      });
    } catch (error) {
      const kind = error instanceof FirstBootError ? error.kind : "generic";

      set({ submitting: false, error: kind });
    }
  },

  // --------------------------------------------------
  // التحقّق والإتمام
  // --------------------------------------------------

  runVerification: async () => {
    set({ submitting: true, error: null });

    try {
      const verification = await api.verify();

      set({ verification, submitting: false });

      return verification;
    } catch (error) {
      const kind = error instanceof FirstBootError ? error.kind : "generic";

      set({ submitting: false, error: kind });

      return null;
    }
  },

  finish: async () => {
    set({ submitting: true, error: null });

    try {
      const state = await api.complete();

      /* ما لم يُرسَل بعدُ لم يعد له معنى — والمحفوظُ صار في القاعدة */
      clearAllDrafts();

      set({ state, phase: "READY", submitting: false });

      return true;
    } catch (error) {
      const kind = error instanceof FirstBootError ? error.kind : "generic";

      set({ submitting: false, error: kind });

      /* الفشلُ يُظهر النقصَ — فتُقرأ التفاصيلُ من التحقّق لا من الرسالة */
      if (kind === "verificationFailed") await get().runVerification();

      return false;
    }
  },

  clearError: () => set({ error: null, fieldErrors: {} }),
}));
