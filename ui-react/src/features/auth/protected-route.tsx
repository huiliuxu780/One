import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from './auth-store'
import { usePermissions, type Capability } from './permissions'

interface ProtectedRouteProps {
  /** 路由能力要求；不满足时跳转 403，而不是仅靠菜单隐藏。 */
  capability?: Capability
}

export function ProtectedRoute({ capability }: ProtectedRouteProps) {
  const authenticated = useAuthStore((state) => state.authenticated)
  const { can } = usePermissions()
  const location = useLocation()
  if (!authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (capability && !can(capability)) return <Navigate to="/403" replace />
  return <Outlet />
}
