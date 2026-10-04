import { useState } from 'react'
import {
  Pulse,
  CaretDown,
  ClockCounterClockwise,
  FlowArrow,
  Gear,
  Hexagon,
  House,
  PlugsConnected,
  Robot,
  SignOut,
  Toolbox,
  Wrench,
} from '@phosphor-icons/react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/features/auth/auth-store'

const primaryNavigation = [
  { label: '智能体', to: '/agent', icon: Robot, enabled: true },
  { label: '对话广场', to: '/chat-cluster', icon: Hexagon, enabled: false },
  { label: '工作流', to: '/workflow', icon: FlowArrow, enabled: false },
  { label: '自动化', to: '/automation', icon: ClockCounterClockwise, enabled: false },
]

const resourceNavigation = [
  { label: '模型', icon: PlugsConnected },
  { label: '技能', icon: Toolbox },
  { label: '工具', icon: Wrench },
  { label: 'MCP', icon: Pulse },
]

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, tenant, logout } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="grid min-h-[100dvh] bg-app" style={{ gridTemplateColumns: collapsed ? '76px minmax(0,1fr)' : '244px minmax(0,1fr)' }}>
      <aside className="sticky top-0 flex h-[100dvh] flex-col border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
        <button className="flex h-12 items-center gap-3 rounded-xl px-2 text-left hover:bg-sidebar-accent" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="size-9 rounded-lg" />
          {!collapsed ? <div className="min-w-0"><div className="truncate text-sm font-semibold">Apboa Next</div><div className="truncate text-[11px] text-sidebar-muted">React workspace</div></div> : null}
        </button>

        <nav className="mt-5 space-y-1" aria-label="主导航">
          {!collapsed ? <div className="mb-2 px-3 text-[11px] font-medium text-sidebar-muted">工作空间</div> : null}
          {primaryNavigation.map((item) => {
            const Icon = item.icon
            if (!item.enabled) {
              return <div key={item.label} className="flex h-10 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm text-sidebar-muted" title="迁移中"><Icon size={18} /><span className={cn(collapsed && 'sr-only')}>{item.label}</span>{!collapsed ? <span className="ml-auto text-[10px]">迁移中</span> : null}</div>
            }
            return <NavLink key={item.label} to={item.to} className={({ isActive }) => cn('flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-sidebar-accent', isActive && 'bg-sidebar-accent font-medium text-primary')}><Icon size={18} weight="duotone" /><span className={cn(collapsed && 'sr-only')}>{item.label}</span></NavLink>
          })}
        </nav>

        <nav className="mt-7 space-y-1" aria-label="资源管理">
          {!collapsed ? <div className="mb-2 px-3 text-[11px] font-medium text-sidebar-muted">资源管理</div> : null}
          {resourceNavigation.map((item) => <div key={item.label} className="flex h-10 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm text-sidebar-muted" title="迁移中"><item.icon size={18} /><span className={cn(collapsed && 'sr-only')}>{item.label}</span></div>)}
        </nav>

        <div className="mt-auto">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" className={cn('h-auto w-full justify-start gap-3 p-2 text-sidebar-foreground hover:bg-sidebar-accent', collapsed && 'justify-center')}>
                <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">{user?.username?.slice(0, 1).toUpperCase() || '?'}</span>
                {!collapsed ? <><span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm">{user?.nickname || user?.username}</span><span className="block truncate text-[11px] font-normal text-sidebar-muted">{tenant?.tenantName || '默认组织'}</span></span><CaretDown size={14} /></> : null}
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content side="right" align="end" sideOffset={8} className="z-50 min-w-48 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-dialog">
                <DropdownMenu.Item disabled className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground outline-none"><Gear size={16} />账号设置</DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item onSelect={handleLogout} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive outline-none hover:bg-muted focus:bg-muted"><SignOut size={16} />退出登录</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </aside>
      <div className="min-w-0"><Outlet /></div>
    </div>
  )
}
