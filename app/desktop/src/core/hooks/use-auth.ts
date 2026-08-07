import { useAuthStore } from "../stores/auth.store"

export const useAuth = () => {
  const user        = useAuthStore((s) => s.user)
  const isAuth      = useAuthStore((s) => s.isAuth)
  const logout      = useAuthStore((s) => s.logout)
  const accessToken = useAuthStore((s) => s.accessToken)

  return { user, isAuth, logout, accessToken }
}