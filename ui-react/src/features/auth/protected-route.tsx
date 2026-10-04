import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from './auth-store'

export function ProtectedRoute() {
  const authenticated = useAuthStore((state) => state.authenticated)
  const location = useLocation()
  if (!authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
