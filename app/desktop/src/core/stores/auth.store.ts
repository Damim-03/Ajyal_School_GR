import axios from "axios";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { appConfig } from "../config/app.config";
import type { User } from "../types";

// --------------------------------------------------
// Auth Store — Zustand + persist
// --------------------------------------------------

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuth: boolean;
  /**
   * جارٍ استئناف الجلسة.
   *
   * لا رأيَ لحارس المسارات قبل انتهائه: `isAuth` تبدأ `false` دائماً
   * لأنّ التوكن لا يُحفظ، فالحكمُ عليها قبل سؤال الخادم يقذف المستخدم
   * إلى شاشة الدخول وهو داخلٌ فعلاً.
   */
  isRestoring: boolean;

  // Actions
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  restore: () => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

/**
 * استئنافٌ واحد لا اثنان.
 *
 * React في وضع التطوير يُركّب المكوّن مرّتين، فيُطلق التأثيرُ نداءَين
 * متطابقَين إلى `/auth/refresh`. لا ضرر فيهما اليوم — التجديد لا يُدوِّر
 * الكعكة — لكنّ الوعد المشترك يجعل السلوك واحداً في الحالين.
 */
let restoring: Promise<boolean> | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuth: false,
      isRestoring: true,

      // --------------------------------------------------
      // setAuth — بعد Login ناجح
      // --------------------------------------------------
      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuth: true, isRestoring: false }),

      // --------------------------------------------------
      // setAccessToken — بعد Refresh ناجح
      // --------------------------------------------------
      setAccessToken: (accessToken) => set({ accessToken }),

      // --------------------------------------------------
      // restore — استئناف الجلسة بعد إعادة التحميل
      //
      // التوكن يعيش في الذاكرة وحدها، فإعادةُ التحميل تمحوه ولو كانت
      // كعكةُ التجديد صالحةً سبعةَ أيام. وكان أثرُ ذلك أنّ كل Ctrl+R
      // يعيد المستخدم إلى شاشة الدخول ثم إلى اختيار الشاشة من جديد —
      // بلا سببٍ أمنيّ: الكعكة قائمة والخادم يقبلها.
      //
      // فالإقلاع يسأل الخادم أوّلاً. ويسأل `/auth/me` بعدها لا اكتفاءً
      // بالمستخدم المحفوظ: الصلاحيات تتغيّر في قاعدة البيانات، ونسخةُ
      // localStorage تبقى على حالها إلى الأبد فتُظهر أزراراً لا يملكها
      // أو تُخفي أزراراً صار يملكها.
      //
      // ويُستعمل `axios` المجرَّد لا `apiClient`: هذا الملفّ يقرؤه
      // العميل، فاستيرادُه هنا حلقةٌ دائرية.
      // --------------------------------------------------
      restore: () => {
        if (restoring) return restoring;

        if (!get().user) {
          set({ isRestoring: false });
          return Promise.resolve(false);
        }

        restoring = (async () => {
          try {
            const { data } = await axios.post(
              `${appConfig.API_URL}/auth/refresh`,
              {},
              { withCredentials: true },
            );

            const accessToken = data.data.accessToken as string;

            const me = await axios.get(`${appConfig.API_URL}/auth/me`, {
              headers: { Authorization: `Bearer ${accessToken}` },
              withCredentials: true,
            });

            set({
              user: me.data.data.user as User,
              accessToken,
              isAuth: true,
              isRestoring: false,
            });

            return true;
          } catch {
            /* كعكةٌ منتهية أو حسابٌ عُطِّل — يُبدأ من الدخول */
            set({
              user: null,
              accessToken: null,
              isAuth: false,
              isRestoring: false,
            });

            return false;
          }
        })().finally(() => {
          restoring = null;
        });

        return restoring;
      },

      // --------------------------------------------------
      // logout — مسح كل شيء
      // --------------------------------------------------
      logout: () =>
        set({
          user: null,
          accessToken: null,
          isAuth: false,
          isRestoring: false,
        }),

      // --------------------------------------------------
      // hasPermission — RBAC check
      // --------------------------------------------------
      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        return user.permissions.includes(permission);
      },
    }),
    {
      name: "auth-storage",
      // نحفظ فقط الـ user — التوكن يُجدَّد تلقائياً
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
