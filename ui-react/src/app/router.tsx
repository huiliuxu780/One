import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppShell } from './app-shell'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { AgentsPage } from '@/pages/agents-page'
import { LoginPage } from '@/pages/login-page'
import { NotImplementedPage } from '@/pages/not-implemented-page'

export const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <AppShell />,
          children: [
            { index: true, element: <Navigate to="/agent" replace /> },
            { path: '/agent', element: <AgentsPage /> },
            { path: '*', element: <NotImplementedPage /> },
          ],
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
)
