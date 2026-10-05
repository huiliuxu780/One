import { Suspense, lazy } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppShell } from './app-shell'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { PageLoading } from '@/components/states'
import { ForbiddenPage, NotFoundPage, ServerErrorPage } from '@/pages/error-pages'

const LoginPage = lazy(() => import('@/pages/login-page').then(({ LoginPage }) => ({ default: LoginPage })))
const AgentsPage = lazy(() => import('@/pages/agents-page').then(({ AgentsPage }) => ({ default: AgentsPage })))
const ProfilePage = lazy(() => import('@/pages/profile-page').then(({ ProfilePage }) => ({ default: ProfilePage })))
const ChangePasswordPage = lazy(() =>
  import('@/pages/change-password-page').then(({ ChangePasswordPage }) => ({ default: ChangePasswordPage })),
)

function withSuspense(element: React.ReactElement) {
  return <Suspense fallback={<PageLoading />}>{element}</Suspense>
}

export const router = createBrowserRouter(
  [
    { path: '/login', element: withSuspense(<LoginPage />) },
    {
      element: <ProtectedRoute />,
      errorElement: <ServerErrorPage />,
      children: [
        {
          element: <AppShell />,
          children: [
            { index: true, element: <Navigate to="/agent" replace /> },
            { path: '/agent', element: withSuspense(<AgentsPage />) },
            { path: '/settings/profile', element: withSuspense(<ProfilePage />) },
            { path: '/settings/password', element: withSuspense(<ChangePasswordPage />) },
            { path: '/403', element: <ForbiddenPage /> },
            { path: '/500', element: <ServerErrorPage /> },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
)
