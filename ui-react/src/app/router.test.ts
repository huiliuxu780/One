import { describe, expect, it } from 'vitest'
import { isValidElement } from 'react'
import type { RouteObject } from 'react-router-dom'
import { router } from './router'

function flattenRoutes(routes: RouteObject[], prefix = ''): string[] {
  return routes.flatMap((route) => {
    const path = route.path ? (route.path.startsWith('/') ? route.path : `${prefix}/${route.path}`) : prefix
    return [path, ...(route.children ? flattenRoutes(route.children, path) : [])]
  })
}

/** 旧 Vue 深链兼容与诚实 auth 页面是迁移验收的硬性要求。 */
describe('legacy route compatibility', () => {
  const paths = flattenRoutes(router.routes)

  it('keeps the Vue root landing page mapped to the dashboard', () => {
    const protectedShell = router.routes.find((route) => route.children)?.children?.find((route) => route.children)
    const indexRoute = protectedShell?.children?.find((route) => route.index)
    expect(isValidElement<{ to: string }>(indexRoute?.element) ? indexRoute.element.props.to : undefined).toBe('/dashboard')
  })

  it('keeps the old Vue deep links reachable as redirects', () => {
    const legacy = [
      '/skill/new',
      '/skill/hub',
      '/skill/:id/edit',
      '/mcp/:serverId/tools',
      '/automation/new',
      '/automation/:id/edit',
      '/automation/:id/records',
      '/api-service/new',
      '/api-service/:id/edit',
      '/workflow/new',
      '/workflow/:id',
      '/chat/history/:agentId',
      '/chat-history/:agentId',
      '/chat/:agentId',
      '/dashboard/dataset-manage',
      '/dataset-manage',
      '/settings/account',
      '/settings/system-params',
      '/settings/system-intro',
      '/settings/api-keys',
      '/ops/monitor',
      '/ops/storage',
      '/review/agent',
      '/review/workflow',
      '/model/:providerId/config',
      '/api-service/logs',
      '/api-service/apps',
    ]
    for (const path of legacy) expect(paths).toContain(path)
  })

  it('exposes honest registration and password recovery pages instead of fake flows', () => {
    expect(paths).toContain('/register')
    expect(paths).toContain('/forgot-password')
  })

  it('keeps excluded tenant routes out of the router', () => {
    expect(paths).not.toContain('/tenant')
    expect(paths).not.toContain('/knowledge')
  })
})
