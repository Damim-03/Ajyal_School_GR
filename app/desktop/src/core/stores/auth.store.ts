import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "../types";

// --------------------------------------------------
// Auth Store — Zustand + persist
// --------------------------------------------------

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuth: boolean;

  // Actions
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuth: false,

      // --------------------------------------------------
      // setAuth — بعد Login ناجح
      // --------------------------------------------------
      setAuth: (user, accessToken) => set({ user, accessToken, isAuth: true }),

      // --------------------------------------------------
      // setAccessToken — بعد Refresh ناجح
      // --------------------------------------------------
      setAccessToken: (accessToken) => set({ accessToken }),

      // --------------------------------------------------
      // logout — مسح كل شيء
      // --------------------------------------------------
      logout: () => set({ user: null, accessToken: null, isAuth: false }),

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
