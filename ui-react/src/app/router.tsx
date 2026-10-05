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
const ModelPage = lazy(() => import('@/pages/model-page').then(({ ModelPage }) => ({ default: ModelPage })))
const SkillPage = lazy(() => import('@/pages/skill-page').then(({ SkillPage }) => ({ default: SkillPage })))
const McpPage = lazy(() => import('@/pages/mcp-page').then(({ McpPage }) => ({ default: McpPage })))
const ToolPage = lazy(() => import('@/pages/resource-pages').then(({ ToolPage }) => ({ default: ToolPage })))
const HookPage = lazy(() => import('@/pages/resource-pages').then(({ HookPage }) => ({ default: HookPage })))
const PromptPage = lazy(() => import('@/pages/resource-pages').then(({ PromptPage }) => ({ default: PromptPage })))
const SensitivePage = lazy(() => import('@/pages/resource-pages').then(({ SensitivePage }) => ({ default: SensitivePage })))
const MemoryPage = lazy(() => import('@/pages/resource-pages').then(({ MemoryPage }) => ({ default: MemoryPage })))
const CodeExecutionPage = lazy(() => import('@/pages/resource-pages').then(({ CodeExecutionPage }) => ({ default: CodeExecutionPage })))
const StudioPage = lazy(() => import('@/pages/resource-pages').then(({ StudioPage }) => ({ default: StudioPage })))
const ChatPage = lazy(() => import('@/pages/chat-page').then(({ ChatPage }) => ({ default: ChatPage })))
const WorkspacePage = lazy(() => import('@/pages/workspace-page').then(({ WorkspacePage }) => ({ default: WorkspacePage })))
const AutomationPage = lazy(() => import('@/pages/automation-page').then(({ AutomationPage }) => ({ default: AutomationPage })))
const WorkflowPage = lazy(() => import('@/pages/workflow-page').then(({ WorkflowPage }) => ({ default: WorkflowPage })))
const WorkflowEditorPage = lazy(() => import('@/pages/workflow-editor-page').then(({ WorkflowEditorPage }) => ({ default: WorkflowEditorPage })))
const SettingsPage = lazy(() => import('@/pages/settings-page').then(({ SettingsPage }) => ({ default: SettingsPage })))
const OpsPage = lazy(() => import('@/pages/ops-page').then(({ OpsPage }) => ({ default: OpsPage })))
const ChatClusterPage = lazy(() => import('@/pages/chat-cluster-page').then(({ ChatClusterPage }) => ({ default: ChatClusterPage })))
const ChatHistoryPage = lazy(() => import('@/pages/chat-history-page').then(({ ChatHistoryPage }) => ({ default: ChatHistoryPage })))
const CommunicationPage = lazy(() => import('@/pages/communication-page').then(({ CommunicationPage }) => ({ default: CommunicationPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard-page').then(({ DashboardPage }) => ({ default: DashboardPage })))
const ApiServicePage = lazy(() => import('@/pages/api-service-page').then(({ ApiServicePage }) => ({ default: ApiServicePage })))
const ReviewPage = lazy(() => import('@/pages/review-page').then(({ ReviewPage }) => ({ default: ReviewPage })))

function withSuspense(element: React.ReactElement) {
  return <Suspense fallback={<PageLoading />}>{element}</Suspense>
}

export const router = createBrowserRouter(
  [
    { path: '/login', element: withSuspense(<LoginPage />) },
    // ChatKey 对外分享入口：免登录，凭据由 key 换取
    { path: '/communication/:chatKey', element: withSuspense(<CommunicationPage />) },
    {
      element: <ProtectedRoute />,
      errorElement: <ServerErrorPage />,
      children: [
        {
          element: <AppShell />,
          children: [
            { index: true, element: <Navigate to="/agent" replace /> },
            { path: '/agent', element: withSuspense(<AgentsPage />) },
            { path: '/chat', element: withSuspense(<ChatPage />) },
            { path: '/chat-cluster', element: withSuspense(<ChatClusterPage />) },
            { path: '/chat-history', element: withSuspense(<ChatHistoryPage />) },
            { path: '/dashboard', element: withSuspense(<DashboardPage />) },
            { path: '/api-service', element: withSuspense(<ApiServicePage />) },
            { path: '/review', element: withSuspense(<ReviewPage />) },
            { path: '/workspace', element: withSuspense(<WorkspacePage />) },
            { path: '/automation', element: withSuspense(<AutomationPage />) },
            { path: '/workflow', element: withSuspense(<WorkflowPage />) },
            { path: '/workflow/:id/edit', element: withSuspense(<WorkflowEditorPage />) },
            { path: '/model', element: withSuspense(<ModelPage />) },
            { path: '/skill', element: withSuspense(<SkillPage />) },
            { path: '/tool', element: withSuspense(<ToolPage />) },
            { path: '/mcp', element: withSuspense(<McpPage />) },
            { path: '/hook', element: withSuspense(<HookPage />) },
            { path: '/prompt', element: withSuspense(<PromptPage />) },
            { path: '/sensitive', element: withSuspense(<SensitivePage />) },
            { path: '/memory', element: withSuspense(<MemoryPage />) },
            { path: '/code-execution', element: withSuspense(<CodeExecutionPage />) },
            { path: '/studio', element: withSuspense(<StudioPage />) },
            { path: '/settings', element: withSuspense(<SettingsPage />) },
            { path: '/ops', element: withSuspense(<OpsPage />) },
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
