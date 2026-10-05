import { useCallback } from 'react'
import { useAuthStore } from './auth-store'

/**
 * 能力-角色映射：菜单隐藏只做引导，路由守卫（ProtectedRoute capability）
 * 与后端权限检查才是真正边界；后端仍会对每个请求做角色校验。
 */
export type Capability =
  | 'chat:use'
  | 'agent:manage'
  | 'resource:manage'
  | 'automation:manage'
  | 'workflow:manage'
  | 'dashboard:manage'
  | 'api-service:manage'
  | 'ops:manage'
  | 'settings:manage'
  | 'account:manage'

const ROLE_RANK = {
  TENANT_VIEWER: 1,
  TENANT_EDITOR: 2,
  TENANT_ADMIN: 3,
  TENANT_OWNER: 4,
} as const

export type TenantRoleValue = keyof typeof ROLE_RANK

export const CAPABILITY_MIN_ROLE: Record<Capability, TenantRoleValue> = {
  'chat:use': 'TENANT_VIEWER',
  'agent:manage': 'TENANT_EDITOR',
  'resource:manage': 'TENANT_EDITOR',
  'automation:manage': 'TENANT_EDITOR',
  'workflow:manage': 'TENANT_EDITOR',
  'dashboard:manage': 'TENANT_EDITOR',
  'api-service:manage': 'TENANT_EDITOR',
  'ops:manage': 'TENANT_ADMIN',
  'settings:manage': 'TENANT_ADMIN',
  'account:manage': 'TENANT_ADMIN',
}

export function roleSatisfies(userRole: string | null | undefined, minRole: TenantRoleValue): boolean {
  if (!userRole) return false
  const rank = ROLE_RANK[userRole as TenantRoleValue]
  if (rank === undefined) return false
  return rank >= ROLE_RANK[minRole]
}

export function usePermissions() {
  const user = useAuthStore((state) => state.user)
  const role = user?.tenantRole ?? null

  const can = useCallback(
    (capability: Capability) => roleSatisfies(role, CAPABILITY_MIN_ROLE[capability]),
    [role],
  )

  return { role, can }
}
