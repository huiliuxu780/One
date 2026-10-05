import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse, LoginResponse } from '@/types'
import { sessionStorageAdapter } from '@/lib/storage'
import { redirectToLogin } from '@/lib/redirect'

const baseURL = import.meta.env.VITE_APP_BASE_API || ''
const TOKEN_HEADER = 'Authorization'
const REFRESH_HEADER = 'Is_Refresh_Token_Request'
const REQUEST_ID_HEADER = 'X-Request-Id'

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean }
type RefreshWaiter = (token: string) => void

/** 携带后端状态码与请求关联 ID 的统一错误；页面层据此展示可操作错误。 */
export class ApiClientError extends Error {
  readonly status?: number
  readonly code?: number
  readonly requestId?: string

  constructor(message: string, options: { status?: number; code?: number; requestId?: string } = {}) {
    super(message)
    this.name = 'ApiClientError'
    this.status = options.status
    this.code = options.code
    this.requestId = options.requestId
  }
}

export function toApiClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) return error
  if (error instanceof Error) return new ApiClientError(error.message)
  return new ApiClientError(String(error))
}

export const apiClient = axios.create({ baseURL })
let refreshing = false
let refreshWaiters: RefreshWaiter[] = []

function newRequestId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

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

function resolveRequestId(request?: InternalAxiosRequestConfig, response?: AxiosResponse) {
  const echoed = response?.headers?.[REQUEST_ID_HEADER.toLowerCase()]
  if (typeof echoed === 'string' && echoed.length > 0) return echoed
  const sent = request?.headers?.[REQUEST_ID_HEADER]
  return typeof sent === 'string' && sent.length > 0 ? sent : undefined
}

apiClient.interceptors.request.use((config) => {
  const token = sessionStorageAdapter.getAccessToken()
  if (token && config.headers.token !== false) config.headers[TOKEN_HEADER] = `Bearer ${token}`
  const threadId = runtimeThreadId(config)
  if (threadId) config.headers['X-Apboa-Thread-Id'] = String(threadId)
  if (!config.headers[REQUEST_ID_HEADER]) config.headers[REQUEST_ID_HEADER] = newRequestId()
  return config
})

function requestFailed(message: string, request?: RetryConfig, response?: AxiosResponse) {
  const payload = response?.data as ApiResponse | undefined
  return new ApiClientError(message, {
    status: response?.status,
    code: typeof payload?.code === 'number' ? payload.code : undefined,
    requestId: resolveRequestId(request, response),
  })
}

apiClient.interceptors.response.use(
  (response) => {
    if (response.config.responseType === 'blob' || response.config.responseType === 'arraybuffer') return response
    const payload = response.data as ApiResponse
    if (payload.code === 200 || payload.code === 202) return response
    throw requestFailed(payload.msg || '后端返回了未处理的响应', response.config as RetryConfig, response)
  },
  async (error: AxiosError<ApiResponse>) => {
    const request = error.config as RetryConfig | undefined
    if (!request || error.response?.status !== 401) {
      throw requestFailed(
        error.response?.data?.msg ||
          (error.response?.status ? `后端服务暂不可用 (HTTP ${error.response.status})` : '无法连接后端服务'),
        request,
        error.response,
      )
    }
    if (request._retry || request.headers?.[REFRESH_HEADER]) {
      sessionStorageAdapter.clear()
      redirectToLogin()
      throw new ApiClientError('登录状态已失效', { status: 401, requestId: resolveRequestId(request, error.response) })
    }
    request._retry = true
    if (refreshing) {
      return new Promise((resolve) => {
        refreshWaiters.push((token) => {
          if (!token) {
            // 刷新失败：后续请求按未登录处理
            sessionStorageAdapter.clear()
            redirectToLogin()
            return
          }
          request.headers[TOKEN_HEADER] = `Bearer ${token}`
          resolve(apiClient(request))
        })
      })
    }
    const newToken = await refreshSessionTokens()
    if (!newToken) {
      throw new ApiClientError('登录状态已失效，请重新登录', { status: 401 })
    }
    request.headers[TOKEN_HEADER] = `Bearer ${newToken}`
    return apiClient(request)
  },
)

/** 供 SSE 等非 axios 通道复用的单飞刷新：成功返回新 accessToken，失败返回 null。 */
export async function refreshSessionTokens(): Promise<string | null> {
  const refreshToken = sessionStorageAdapter.getRefreshToken()
  if (!refreshToken) {
    sessionStorageAdapter.clear()
    redirectToLogin()
    return null
  }
  if (refreshing) {
    return new Promise((resolve) => {
      refreshWaiters.push((token) => resolve(token || null))
    })
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
    return data.accessToken
  } catch {
    refreshWaiters = []
    sessionStorageAdapter.clear()
    redirectToLogin()
    return null
  } finally {
    refreshing = false
  }
}
