import { Suspense, lazy } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppShell } from './app-shell'
import { ProtectedRoute } from '@/features/auth/protected-route'
import type { Capability } from '@/features/auth/permissions'
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
const WorkflowResourcesPage = lazy(() => import('@/pages/workflow-resources-page').then(({ WorkflowResourcesPage }) => ({ default: WorkflowResourcesPage })))
const SettingsPage = lazy(() => import('@/pages/settings-page').then(({ SettingsPage }) => ({ default: SettingsPage })))
const OpsPage = lazy(() => import('@/pages/ops-page').then(({ OpsPage }) => ({ default: OpsPage })))
const ChatClusterPage = lazy(() => import('@/pages/chat-cluster-page').then(({ ChatClusterPage }) => ({ default: ChatClusterPage })))
const ChatHistoryPage = lazy(() => import('@/pages/chat-history-page').then(({ ChatHistoryPage }) => ({ default: ChatHistoryPage })))
const CommunicationPage = lazy(() => import('@/pages/communication-page').then(({ CommunicationPage }) => ({ default: CommunicationPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard-page').then(({ DashboardPage }) => ({ default: DashboardPage })))
const ApiServicePage = lazy(() => import('@/pages/api-service-page').then(({ ApiServicePage }) => ({ default: ApiServicePage })))
const ReviewPage = lazy(() => import('@/pages/review-page').then(({ ReviewPage }) => ({ default: ReviewPage })))
const DocsPage = lazy(() => import('@/pages/docs-page').then(({ DocsPage }) => ({ default: DocsPage })))

function withSuspense(element: React.ReactElement) {
  return <Suspense fallback={<PageLoading />}>{element}</Suspense>
}

function withCapability(element: React.ReactElement, capability: Capability) {
  return <ProtectedRoute capability={capability}>{withSuspense(element)}</ProtectedRoute>
}

export const router = createBrowserRouter(
  [
    { path: '/login', element: withSuspense(<LoginPage />) },
    // ChatKey 对外分享入口：免登录，凭据由 key 换取
    { path: '/communication/:chatKey', element: withSuspense(<CommunicationPage />) },
    // 旧 /web/doc 使用手册的 React 迁移版保持免登录访问。
    { path: '/docs/:slug?', element: withSuspense(<DocsPage />) },
    {
      element: <ProtectedRoute />,
      errorElement: <ServerErrorPage />,
      children: [
        {
          element: <AppShell />,
          children: [
            { index: true, element: <Navigate to="/agent" replace /> },
            { path: '/agent', element: withSuspense(<AgentsPage />) },
            { path: '/chat', element: withCapability(<ChatPage />, 'chat:use') },
            { path: '/chat-cluster', element: withCapability(<ChatClusterPage />, 'chat:use') },
            { path: '/chat-history', element: withCapability(<ChatHistoryPage />, 'chat:use') },
            { path: '/dashboard', element: withCapability(<DashboardPage />, 'dashboard:manage') },
            { path: '/api-service', element: withCapability(<ApiServicePage />, 'api-service:manage') },
            { path: '/review', element: withSuspense(<ReviewPage />) },
            { path: '/workspace', element: withCapability(<WorkspacePage />, 'chat:use') },
            { path: '/automation', element: withCapability(<AutomationPage />, 'automation:manage') },
            { path: '/workflow', element: withCapability(<WorkflowPage />, 'workflow:manage') },
            { path: '/workflow/:id/edit', element: withCapability(<WorkflowEditorPage />, 'workflow:manage') },
            { path: '/workflow-resources', element: withCapability(<WorkflowResourcesPage />, 'workflow:manage') },
            { path: '/model', element: withCapability(<ModelPage />, 'resource:manage') },
            { path: '/skill', element: withCapability(<SkillPage />, 'resource:manage') },
            { path: '/tool', element: withCapability(<ToolPage />, 'resource:manage') },
            { path: '/mcp', element: withCapability(<McpPage />, 'resource:manage') },
            { path: '/hook', element: withCapability(<HookPage />, 'resource:manage') },
            { path: '/prompt', element: withCapability(<PromptPage />, 'resource:manage') },
            { path: '/sensitive', element: withCapability(<SensitivePage />, 'resource:manage') },
            { path: '/memory', element: withCapability(<MemoryPage />, 'resource:manage') },
            { path: '/code-execution', element: withCapability(<CodeExecutionPage />, 'resource:manage') },
            { path: '/studio', element: withCapability(<StudioPage />, 'resource:manage') },
            { path: '/settings', element: withCapability(<SettingsPage />, 'settings:manage') },
            { path: '/ops', element: withCapability(<OpsPage />, 'ops:manage') },
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
