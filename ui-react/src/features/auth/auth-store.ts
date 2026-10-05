import { create } from 'zustand'
import { md5 } from 'js-md5'
import type { AccountVO, LoginRequest, LoginResponse, TenantInfo } from '@/types'
import * as authApi from '@/api/auth'
import { sessionStorageAdapter } from '@/lib/storage'

const DEFAULT_TENANT_ID = import.meta.env.VITE_DEFAULT_TENANT_ID || '1'

interface AuthState {
  user: AccountVO | null
  tenant: TenantInfo | null
  authenticated: boolean
  busy: boolean
  login: (username: string, password: string) => Promise<void>
  acceptLogin: (data: LoginResponse) => void
  logout: () => Promise<void>
  updateUser: (patch: Partial<AccountVO>) => void
}

function validateSingleTenant(data: LoginResponse) {
  if (data.blocked) throw new Error('账号尚未获得默认组织访问权限')
  if (data.needSelectTenant) throw new Error('账号未加入配置的默认组织')
  if (!data.accessToken || !data.userDetail?.tenantId) throw new Error('登录响应缺少租户上下文')
  if (String(data.userDetail.tenantId) !== String(DEFAULT_TENANT_ID)) {
    throw new Error('后端返回了非默认组织上下文，已拒绝登录')
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: sessionStorageAdapter.getUser(),
  tenant: sessionStorageAdapter.getTenant(),
  authenticated: Boolean(sessionStorageAdapter.getAccessToken()),
  busy: false,
  updateUser(patch) {
    const current = sessionStorageAdapter.getUser()
    if (!current) return
    const next = { ...current, ...patch }
    sessionStorageAdapter.saveUser(next)
    set({ user: next })
  },
  acceptLogin(data) {
    validateSingleTenant(data)
    sessionStorageAdapter.saveLogin(data)
    set({
      user: sessionStorageAdapter.getUser(),
      tenant: sessionStorageAdapter.getTenant(),
      authenticated: true,
    })
  },
  async login(username, password) {
    set({ busy: true })
    try {
      const request: LoginRequest = { username, password: md5(password), tenantId: DEFAULT_TENANT_ID }
      const response = await authApi.login(request)
      const data = response.data.data
      useAuthStore.getState().acceptLogin(data)
    } finally {
      set({ busy: false })
    }
  },
  async logout() {
    try {
      await authApi.logout()
    } finally {
      sessionStorageAdapter.clear()
      set({ user: null, tenant: null, authenticated: false })
    }
  },
}))
