import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse, LoginResponse } from '@/types'
import { sessionStorageAdapter } from '@/lib/storage'

const baseURL = import.meta.env.VITE_APP_BASE_API || ''
const TOKEN_HEADER = 'Authorization'
const REFRESH_HEADER = 'Is_Refresh_Token_Request'

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean }
type RefreshWaiter = (token: string) => void

export const apiClient = axios.create({ baseURL })
let refreshing = false
let refreshWaiters: RefreshWaiter[] = []

function runtimeThreadId(config: InternalAxiosRequestConfig) {
  if (!String(config.url ?? '').includes('/api/runtime')) return null
  const data = typeof config.data === 'string' ? safeJson(config.data) : config.data
  const candidates = [config.params?.threadId, config.params?.sessionId, data?.threadId, data?.sessionId]
  return candidates.find((value) => value !== undefined && value !== null && String(value).length > 0)
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

apiClient.interceptors.request.use((config) => {
  const token = sessionStorageAdapter.getAccessToken()
  if (token && config.headers.token !== false) config.headers[TOKEN_HEADER] = `Bearer ${token}`
  const threadId = runtimeThreadId(config)
  if (threadId) config.headers['X-Apboa-Thread-Id'] = String(threadId)
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    if (response.config.responseType === 'blob' || response.config.responseType === 'arraybuffer') return response
    const payload = response.data as ApiResponse
    if (payload.code === 200 || payload.code === 202) return response
    throw new Error(payload.msg || '后端返回了未处理的响应')
  },
  async (error: AxiosError<ApiResponse>) => {
    const request = error.config as RetryConfig | undefined
    if (!request || error.response?.status !== 401) {
      const status = error.response?.status
      throw new Error(
        error.response?.data?.msg ||
          (status ? `后端服务暂不可用 (HTTP ${status})` : '无法连接后端服务'),
      )
    }
    if (request._retry || request.headers?.[REFRESH_HEADER]) {
      sessionStorageAdapter.clear()
      window.location.assign(`${import.meta.env.BASE_URL}login`)
      throw new Error('登录状态已失效')
    }
    request._retry = true
    if (refreshing) {
      return new Promise((resolve) => {
        refreshWaiters.push((token) => {
          request.headers[TOKEN_HEADER] = `Bearer ${token}`
          resolve(apiClient(request))
        })
      })
    }
    const refreshToken = sessionStorageAdapter.getRefreshToken()
    if (!refreshToken) {
      sessionStorageAdapter.clear()
      window.location.assign(`${import.meta.env.BASE_URL}login`)
      throw new Error('缺少刷新凭据')
    }
    refreshing = true
    try {
      const response = await axios.post<ApiResponse<LoginResponse>>(
        `${baseURL}/api/auth/refresh-token`,
        { refreshToken },
        { headers: { [REFRESH_HEADER]: true } },
      )
      const data = response.data.data
      sessionStorageAdapter.saveLogin(data)
      refreshWaiters.forEach((waiter) => waiter(data.accessToken))
      refreshWaiters = []
      request.headers[TOKEN_HEADER] = `Bearer ${data.accessToken}`
      return apiClient(request)
    } catch (refreshError) {
      refreshWaiters = []
      sessionStorageAdapter.clear()
      window.location.assign(`${import.meta.env.BASE_URL}login`)
      throw refreshError
    } finally {
      refreshing = false
    }
  },
)
