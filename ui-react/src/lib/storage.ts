import type { AccountVO, LoginResponse, TenantInfo } from '@/types'
import type { StoredToken } from '@/types/layout'

const ACCESS_KEY = 'apboa-next-accessToken'
const REFRESH_KEY = 'apboa-next-refreshToken'
const USER_KEY = 'apboa-next-user'
const TENANT_KEY = 'apboa-next-current-tenant'

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

function readToken(key: string) {
  const token = readJson<StoredToken>(key)
  if (!token?.value) return ''
  if (String(token.ttl) === '-1') return token.value
  if (Date.now() < Number(token.ttl)) return token.value
  localStorage.removeItem(key)
  return ''
}

export const sessionStorageAdapter = {
  getAccessToken: () => readToken(ACCESS_KEY),
  getRefreshToken: () => readToken(REFRESH_KEY),
  getUser: () => readJson<AccountVO>(USER_KEY),
  getTenant: () => readJson<TenantInfo>(TENANT_KEY),
  saveLogin(data: LoginResponse) {
    localStorage.setItem(ACCESS_KEY, JSON.stringify({ value: data.accessToken, ttl: data.accessTokenTTL }))
    localStorage.setItem(REFRESH_KEY, JSON.stringify({ value: data.refreshToken, ttl: data.refreshTokenTTL }))
    if (data.userDetail) {
      const user: AccountVO = {
        id: data.userDetail.id,
        nickname: data.userDetail.name,
        username: data.userDetail.username,
        email: data.userDetail.email,
        tenantRole: data.userDetail.tenantRole ?? undefined,
        enabled: true,
      }
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      if (data.userDetail.tenantId) {
        const tenant: TenantInfo = {
          tenantId: data.userDetail.tenantId,
          tenantCode: data.userDetail.tenantCode ?? '',
          tenantName: data.userDetail.tenantName ?? data.userDetail.tenantCode ?? '',
          role: data.userDetail.tenantRole ?? '',
        }
        localStorage.setItem(TENANT_KEY, JSON.stringify(tenant))
      }
    }
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TENANT_KEY)
    localStorage.removeItem('apboa-next-available-tenants')
  },
}
