import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "../api/client";

/**
 * هوية المدرسة — متجر عامّ.
 *
 * تُقرأ من هنا في الترويسة وشاشة الإقلاع والدخول والإيصالات، فوجب أن
 * تُحمَّل **مرّة لكل جلسة** لا في كل شاشة: لو جلبتها كل شاشة لظهر اسم
 * المدرسة متأخّراً عن رسم الترويسة، ولوميض الاسمُ الافتراضي ثم تبدّل.
 *
 * والافتراضيات هنا نسخة من افتراضيات الخادم: قبل أن يصل الرد تعرض
 * الواجهة شيئاً معقولاً بدل فراغ.
 */

export type SchoolSettings = Record<string, string>;

const DEFAULTS: SchoolSettings = {
  "school.name_ar": "مركز أجيال التعليمي",
  "school.name_en": "Ajyal Learning Center",
  "school.short_name": "أجيال",
  "school.short_suffix": "GR",
  "school.tagline": "نظام إدارة المركز",
  "school.address": "",
  "school.phone": "",
  "school.email": "",
  "school.brand_color": "#7dd3fc",
  "school.logo_path": "",
  "school.logo_size": "56",
  "school.logo_contrast": "100",
  "school.logo_clarity": "100",
  /*
   * حقوقُ التسجيل — مبلغٌ يُقبض مرّةً عند التحاق الطالب.
   *
   * وفارغُه يعني «لا مبلغَ مقرَّر»: المؤسسة تكتبه في الإعدادات مرّةً
   * فيُملأ في كلّ تسجيل، ومن تركه فارغاً كتبه بيده في كلّ مرّة —
   * وصفرٌ مكتوبٌ افتراضاً كان سيُثبَّت في الوصول بلا قصد.
   */
  "school.registration_fee": "",
  "school.receipt_note": "",
  "school.receipt_thanks": "شكراً لثقتكم",
  "school.currency": "دج",
};

interface SchoolState {
  settings: SchoolSettings;
  configured: string[];
  loaded: boolean;
  loading: boolean;

  load: (force?: boolean) => Promise<void>;
  apply: (data: { settings: SchoolSettings; configured: string[] }) => void;
}

export const useSchoolStore = create<SchoolState>()(
  /*
   * تُحفظ محلياً — وهذا ليس تخزيناً مؤقّتاً بل شرطٌ لعمل الميزة.
   *
   * قراءة الهوية من الخادم تحتاج مصادقة، وشاشتا الإقلاع والدخول تسبقان
   * الدخول. فبلا حفظٍ محلّي تعرضان الافتراضي «أجيال» دائماً — أي أنّ
   * المدرسة لا ترى اسمها في الشاشتين اللتين يهمّها فيهما أكثر من غيرهما.
   * كشفه الفحص: بعد إعادة التحميل عادت الشاشة إلى الاسم الافتراضي.
   *
   * والمحتوى غير حسّاس: اسم المدرسة وهاتفها ولونها — ما يُطبع على كل
   * إيصال ويراه كل زائر.
   */
  persist(
    (set, get) => ({
      settings: DEFAULTS,
      configured: [],
      loaded: false,
      loading: false,

      load: async (force = false) => {
        if (get().loading) return;
        if (get().loaded && !force) return;

        set({ loading: true });

        try {
          const { data } = await apiClient.get("/settings/school");

          set({
            settings: { ...DEFAULTS, ...data.data.settings },
            configured: data.data.configured ?? [],
            loaded: true,
            loading: false,
          });
        } catch {
          /*
           * تعذّر الجلب لا يُسقط الواجهة: تبقى القيم المحفوظة محلياً
           * ويُعاد المحاولة عند الدخول التالي. اسمٌ قديم أفضل من شاشة
           * خطأ لأجل ترويسة.
           */
          set({ loading: false });
        }
      },

      apply: ({ settings, configured }) =>
        set({ settings: { ...DEFAULTS, ...settings }, configured, loaded: true }),
    }),
    {
      name: "school-identity",
      /* `loaded` لا يُحفظ: كل جلسة تُعيد الجلب مرّة لتلتقط أي تغيير */
      partialize: (state) => ({
        settings: state.settings,
        configured: state.configured,
      }),
    },
  ),
);

/** قارئ مختصر: school("school.name_ar") */
export const school = (key: string): string =>
  useSchoolStore.getState().settings[key] ?? DEFAULTS[key] ?? "";

/** hook للاشتراك في مفتاح واحد فيُعاد التصيير عند تغيّره وحده */
export const useSchool = (key: string): string =>
  useSchoolStore((s) => s.settings[key] ?? DEFAULTS[key] ?? "");
