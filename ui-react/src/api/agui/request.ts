/**
 * AG-UI SSE 请求：URL 与认证头（与 Vue 版协议一致，独立于 axios 实例）
 */

import { sessionStorageAdapter } from '@/lib/storage'
import { redirectToLogin } from '@/lib/redirect'

/** 默认 run 端点路径 */
const DEFAULT_RUN_PATH = '/api/runtime/agui/run'
/** 默认 SSE 端点基础路径 */
const DEFAULT_SSE_BASE = '/api/runtime/agui'

function withBase(path: string): string {
  const base = import.meta.env.VITE_APP_BASE_API || ''
  if (!base) return path
  return base.endsWith('/') ? `${base}${path.replace(/^\//, '')}` : `${base}${path}`
}

export function getAgentRunURL(): string {
  return withBase(DEFAULT_RUN_PATH)
}

export function getSSEHeaders(threadId?: string): Record<string, string> {
  const token = sessionStorageAdapter.getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (threadId) headers['X-Apboa-Thread-Id'] = threadId
  return headers
}

export function getRESTHeaders(threadId?: string): Record<string, string> {
  const token = sessionStorageAdapter.getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (threadId) headers['X-Apboa-Thread-Id'] = threadId
  return headers
}

export function getReconnectURL(threadId: string): string {
  return withBase(`${DEFAULT_SSE_BASE}/reconnect/${encodeURIComponent(threadId)}`)
}

export function getStatusURL(threadId: string): string {
  return withBase(`${DEFAULT_SSE_BASE}/status/${encodeURIComponent(threadId)}`)
}

export function getStopURL(threadId: string): string {
  return withBase(`${DEFAULT_SSE_BASE}/stop/${encodeURIComponent(threadId)}`)
}

export function getActiveRunsURL(): string {
  return withBase(`${DEFAULT_SSE_BASE}/active-runs`)
}

export function getResumeURL(threadId: string): string {
  return withBase(`${DEFAULT_SSE_BASE}/resume/${encodeURIComponent(threadId)}`)
}

export function getPendingURL(threadId: string): string {
  return withBase(`${DEFAULT_SSE_BASE}/pending/${encodeURIComponent(threadId)}`)
}

/** 会话彻底失效时的统一出口 */
export function expireToLogin(): void {
  sessionStorageAdapter.clear()
  redirectToLogin()
}
