import { Suspense, useState } from 'react'
import {
  Pulse,
  CaretDown,
  ClockCounterClockwise,
  BookOpen,
  FlowArrow,
  Gear,
  Hexagon,
  House,
  Lightning,
  ListChecks,
  LockKey,
  Monitor,
  Database,
  PlugsConnected,
  Robot,
  ShieldCheck,
  SignOut,
  Toolbox,
  UserCircle,
  Wrench,
} from '@phosphor-icons/react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PageLoading } from '@/components/states'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/features/auth/auth-store'
import { usePermissions, type Capability } from '@/features/auth/permissions'

interface NavigationItem {
  label: string
  icon: React.ComponentType<{ size?: number; weight?: 'duotone' | 'fill' | 'regular' }>
  to?: string
  enabled?: boolean
  /** 能力要求；声明后不满足的角色直接隐藏入口（路由仍有 capability 守卫）。 */
  capability?: Capability
}

const primaryNavigation: NavigationItem[] = [
  { label: '智能体', to: '/agent', icon: Robot, enabled: true },
  { label: '对话', to: '/chat', icon: Hexagon, enabled: true, capability: 'chat:use' },
  { label: '对话广场', to: '/chat-cluster', icon: House, enabled: true },
  { label: '会话历史', to: '/chat-history', icon: ClockCounterClockwise, enabled: true },
  { label: '工作流', to: '/workflow', icon: FlowArrow, enabled: true },
  { label: '工作流资源', to: '/workflow-resources', icon: Database, enabled: true, capability: 'workflow:manage' },
  { label: '自动化', to: '/automation', icon: ClockCounterClockwise, enabled: true },
]

const resourceNavigation: NavigationItem[] = [
  { label: '模型', to: '/model', icon: PlugsConnected, enabled: true, capability: 'resource:manage' },
  { label: '技能', to: '/skill', icon: Toolbox, enabled: true, capability: 'resource:manage' },
  { label: '工具', to: '/tool', icon: Wrench, enabled: true, capability: 'resource:manage' },
  { label: 'MCP', to: '/mcp', icon: Pulse, enabled: true, capability: 'resource:manage' },
  { label: 'Hook', to: '/hook', icon: Lightning, enabled: true, capability: 'resource:manage' },
]

const assetNavigation: NavigationItem[] = [
  { label: '工作空间', to: '/workspace', icon: Database, enabled: true },
  { label: '提示词', to: '/prompt', icon: ListChecks, enabled: true, capability: 'resource:manage' },
  { label: '敏感词', to: '/sensitive', icon: ShieldCheck, enabled: true, capability: 'resource:manage' },
  { label: '长期记忆', to: '/memory', icon: Database, enabled: true, capability: 'resource:manage' },
  { label: '代码执行', to: '/code-execution', icon: Monitor, enabled: true, capability: 'resource:manage' },
  { label: 'Studio', to: '/studio', icon: Gear, enabled: true, capability: 'resource:manage' },
  { label: '设置', to: '/settings', icon: UserCircle, enabled: true },
  { label: '运维', to: '/ops', icon: Monitor, enabled: true, capability: 'ops:manage' },
]

const integrationNavigation: NavigationItem[] = [
  { label: '工作台', to: '/dashboard', icon: House, enabled: true },
  { label: 'API 服务', to: '/api-service', icon: PlugsConnected, enabled: true },
  { label: '审查', to: '/review', icon: ShieldCheck, enabled: true },
  { label: '使用手册', to: '/docs', icon: BookOpen, enabled: true },
]

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, tenant, logout } = useAuthStore()
  const { can } = usePermissions()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function renderNavigation(items: NavigationItem[], ariaLabel: string, groupLabel: string) {
    return (
      <nav className="mt-5 space-y-1" aria-label={ariaLabel}>
        {!collapsed ? <div className="mb-2 px-3 text-[11px] font-medium text-sidebar-muted">{groupLabel}</div> : null}
        {items.map((item) => {
          const Icon = item.icon
          if (item.capability && !can(item.capability)) return null
          if (!item.enabled) {
            return (
              <div key={item.label} className="flex h-10 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm text-sidebar-muted" title="迁移中">
                <Icon size={18} />
                <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
                {!collapsed ? <span className="ml-auto text-[10px]">迁移中</span> : null}
              </div>
            )
          }
          return (
            <NavLink
              key={item.label}
              to={item.to!}
              className={({ isActive }) =>
                cn(
                  'flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-sidebar-accent',
                  isActive && 'bg-sidebar-accent font-medium text-primary',
                )
              }
            >
              <Icon size={18} weight="duotone" />
              <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    )
  }

  return (
    <div className="grid min-h-[100dvh] bg-app" style={{ gridTemplateColumns: collapsed ? '76px minmax(0,1fr)' : '244px minmax(0,1fr)' }}>
      <aside className="sticky top-0 flex h-[100dvh] flex-col border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
        <button className="flex h-12 items-center gap-3 rounded-xl px-2 text-left hover:bg-sidebar-accent" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="size-9 rounded-lg" />
          {!collapsed ? <div className="min-w-0"><div className="truncate text-sm font-semibold">Apboa Next</div><div className="truncate text-[11px] text-sidebar-muted">React workspace</div></div> : null}
        </button>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
          data-testid="sidebar-navigation-scroll"
        >
          {renderNavigation(primaryNavigation, '主导航', '工作空间')}
          {renderNavigation(resourceNavigation, '资源管理', '资源管理')}
          {renderNavigation(assetNavigation, '资产配置', '资产配置')}
          {renderNavigation(integrationNavigation, '分析与集成', '分析与集成')}
        </div>

        <div className="mt-3 shrink-0 border-t border-sidebar-border pt-3">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" className={cn('h-auto w-full justify-start gap-3 p-2 text-sidebar-foreground hover:bg-sidebar-accent', collapsed && 'justify-center')}>
                <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">{user?.username?.slice(0, 1).toUpperCase() || '?'}</span>
                {!collapsed ? <><span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm">{user?.nickname || user?.username}</span><span className="block truncate text-[11px] font-normal text-sidebar-muted">{tenant?.tenantName || '默认组织'}</span></span><CaretDown size={14} /></> : null}
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content side="right" align="end" sideOffset={8} className="z-50 min-w-48 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-dialog">
                <DropdownMenu.Item onSelect={() => navigate('/settings/profile')} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted"><UserCircle size={16} />个人资料</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => navigate('/settings/password')} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted"><LockKey size={16} />修改密码</DropdownMenu.Item>
                <DropdownMenu.Item disabled className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground outline-none"><Gear size={16} />账号设置</DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item onSelect={handleLogout} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive outline-none hover:bg-muted focus:bg-muted"><SignOut size={16} />退出登录</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </aside>
      <div className="min-w-0">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}
