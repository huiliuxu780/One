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
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PageLoading } from '@/components/states'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/features/auth/auth-store'
import { usePermissions, type Capability } from '@/features/auth/permissions'

interface NavigationItem {
  label: string
  icon: React.ComponentType<{ size?: number; weight?: 'duotone' | 'fill' | 'regular' }>
  to?: string
  /** 能力要求；声明后不满足的角色直接隐藏入口（路由仍有 capability 守卫）。 */
  capability?: Capability
}

const primaryNavigation: NavigationItem[] = [
  { label: '智能体', to: '/agent', icon: Robot },
  { label: '对话', to: '/chat', icon: Hexagon, capability: 'chat:use' },
  { label: '对话广场', to: '/chat-cluster', icon: House },
  { label: '会话历史', to: '/chat-history', icon: ClockCounterClockwise },
  { label: '工作流', to: '/workflow', icon: FlowArrow },
  { label: '工作流资源', to: '/workflow-resources', icon: Database, capability: 'workflow:manage' },
  { label: '自动化', to: '/automation', icon: ClockCounterClockwise },
]

const resourceNavigation: NavigationItem[] = [
  { label: '模型', to: '/model', icon: PlugsConnected, capability: 'resource:manage' },
  { label: '技能', to: '/skill', icon: Toolbox, capability: 'resource:manage' },
  { label: '工具', to: '/tool', icon: Wrench, capability: 'resource:manage' },
  { label: 'MCP', to: '/mcp', icon: Pulse, capability: 'resource:manage' },
  { label: 'Hook', to: '/hook', icon: Lightning, capability: 'resource:manage' },
]

const assetNavigation: NavigationItem[] = [
  { label: '工作空间', to: '/workspace', icon: Database },
  { label: '提示词', to: '/prompt', icon: ListChecks, capability: 'resource:manage' },
  { label: '敏感词', to: '/sensitive', icon: ShieldCheck, capability: 'resource:manage' },
  { label: '长期记忆', to: '/memory', icon: Database, capability: 'resource:manage' },
  { label: '代码执行', to: '/code-execution', icon: Monitor, capability: 'resource:manage' },
  { label: 'Studio', to: '/studio', icon: Gear, capability: 'resource:manage' },
  { label: '设置', to: '/settings', icon: UserCircle },
  { label: '运维', to: '/ops', icon: Monitor, capability: 'ops:manage' },
]

const integrationNavigation: NavigationItem[] = [
  { label: '工作台', to: '/dashboard', icon: House },
  { label: 'API 服务', to: '/api-service', icon: PlugsConnected },
  { label: '审查', to: '/review', icon: ShieldCheck },
  { label: '使用手册', to: '/docs', icon: BookOpen },
]

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 纸墨外壳顶栏：面包屑 + 等宽日期，全产品统一。 */
function Topbar() {
  const location = useLocation()
  const current = [...primaryNavigation, ...resourceNavigation, ...assetNavigation, ...integrationNavigation]
    .find((item) => item.to && (location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)))
  const now = new Date()
  return (
    <div className="flex h-[46px] flex-none items-center justify-between border-b border-border px-6">
      <span className="text-[11.5px] text-muted-foreground">
        工作空间 / <b className="font-medium text-secondary-foreground">{current?.label ?? '总览'}</b>
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {now.getMonth() + 1} 月 {now.getDate()} 日，{WEEKDAYS[now.getDay()]}
      </span>
    </div>
  )
}

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
        {!collapsed ? <div className="mb-2 px-3 text-[10.5px] font-medium tracking-[0.14em] text-sidebar-muted">{groupLabel}</div> : null}
        {items.map((item) => {
          const Icon = item.icon
          if (item.capability && !can(item.capability)) return null
          return (
            <NavLink
              key={item.label}
              to={item.to!}
              className={({ isActive }) =>
                cn(
                  'flex h-8 items-center gap-2.5 rounded-md px-3 text-[13px] transition-colors hover:bg-sidebar-accent',
                  isActive && 'bg-sidebar-accent font-semibold text-primary',
                )
              }
            >
              <Icon size={16} weight="duotone" />
              <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    )
  }

  return (
    <div className="grid min-h-[100dvh] bg-app" style={{ gridTemplateColumns: collapsed ? '76px minmax(0,1fr)' : '216px minmax(0,1fr)' }}>
      <aside className="sticky top-0 flex h-[100dvh] flex-col border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
        <button className="flex h-12 items-center gap-3 rounded-md px-2 text-left hover:bg-sidebar-accent" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="size-8 rounded-md" />
          {!collapsed ? <div className="min-w-0"><div className="truncate font-display text-[15px] font-bold">Apboa Next</div></div> : null}
        </button>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [mask-image:linear-gradient(to_bottom,#000_calc(100%-20px),transparent)]"
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
                <span className="grid size-6 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background">{user?.username?.slice(0, 1).toUpperCase() || '?'}</span>
                {!collapsed ? <><span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm">{user?.nickname || user?.username}</span><span className="block truncate text-[11px] font-normal text-sidebar-muted">{tenant?.tenantName || '默认组织'}</span></span><CaretDown size={14} /></> : null}
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content side="right" align="end" sideOffset={8} className="z-50 min-w-48 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-dialog">
                <DropdownMenu.Item onSelect={() => navigate('/settings/profile')} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted"><UserCircle size={16} />个人资料</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => navigate('/settings/password')} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted"><LockKey size={16} />修改密码</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => navigate('/settings?tab=accounts')} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted"><Gear size={16} />账号设置</DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item onSelect={handleLogout} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive outline-none hover:bg-muted focus:bg-muted"><SignOut size={16} />退出登录</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <Topbar />
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}
