import { useAuthStore } from "../stores/auth.store"

export const usePermissions = () => {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const user          = useAuthStore((s) => s.user)

  const can = (permission: string): boolean =>
    hasPermission(permission)

  const canAny = (permissions: string[]): boolean =>
    permissions.some((p) => hasPermission(p))

  const canAll = (permissions: string[]): boolean =>
    permissions.every((p) => hasPermission(p))

  return { can, canAny, canAll, role: user?.role.name }
}