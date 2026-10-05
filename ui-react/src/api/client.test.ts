import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError, apiClient } from './client'
import { sessionStorageAdapter } from '@/lib/storage'

vi.mock('@/lib/redirect', () => ({ redirectToLogin: vi.fn() }))
import { redirectToLogin } from '@/lib/redirect'

const server = setupServer(
  http.get('*/api/agent/definition/page', ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (auth === 'Bearer expired-token') {
      return HttpResponse.json({ code: 401, msg: '登录已过期' }, { status: 401 })
    }
    if (auth === 'Bearer never-authorized') {
      return HttpResponse.json({ code: 403, msg: '没有权限' }, { status: 403 })
    }
    return HttpResponse.json({ code: 200, msg: '操作成功', data: { records: [], total: 0, size: 10, current: 1, pages: 0 } })
  }),
  http.post('*/api/auth/refresh-token', async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string }
    refreshCalls.push(body.refreshToken ?? '')
    if (body.refreshToken === 'refresh-invalid') {
      return HttpResponse.json({ code: 401, msg: '刷新凭据无效' }, { status: 401 })
    }
    return HttpResponse.json({
      code: 200,
      msg: '操作成功',
      data: {
        accessToken: 'fresh-token',
        refreshToken: 'refresh-rotated',
        accessTokenTTL: String(Date.now() + 60 * 60 * 1000),
        refreshTokenTTL: String(Date.now() + 24 * 60 * 60 * 1000),
      },
    })
  }),
)

const refreshCalls: string[] = []

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  refreshCalls.length = 0
})
afterEach(() => {
  server.resetHandlers()
  vi.mocked(redirectToLogin).mockClear()
})
afterAll(() => server.close())

function seedSession(accessToken: string, refreshToken: string) {
  sessionStorageAdapter.saveLogin({
    accessToken,
    refreshToken,
    accessTokenTTL: String(Date.now() + 60 * 60 * 1000),
    refreshTokenTTL: String(Date.now() + 24 * 60 * 60 * 1000),
  } as never)
}

describe('apiClient 单飞刷新', () => {
  it('过期 token 触发一次刷新并重放原请求', async () => {
    seedSession('expired-token', 'refresh-valid')

    const response = await apiClient.get('/api/agent/definition/page')
    expect(response.data.code).toBe(200)
    expect(refreshCalls).toEqual(['refresh-valid'])
    expect(sessionStorageAdapter.getAccessToken()).toBe('fresh-token')
    expect(redirectToLogin).not.toHaveBeenCalled()

    sessionStorageAdapter.clear()
  })

  it('并发 401 只触发一次刷新，两个请求都重放成功', async () => {
    seedSession('expired-token', 'refresh-valid')

    const [first, second] = await Promise.all([
      apiClient.get('/api/agent/definition/page?page=1'),
      apiClient.get('/api/agent/definition/page?page=2'),
    ])
    expect(first.data.code).toBe(200)
    expect(second.data.code).toBe(200)
    expect(refreshCalls.filter((token) => token === 'refresh-valid')).toHaveLength(1)

    sessionStorageAdapter.clear()
  })

  it('刷新失败时清理会话并跳转登录页', async () => {
    seedSession('expired-token', 'refresh-invalid')

    await expect(apiClient.get('/api/agent/definition/page')).rejects.toBeInstanceOf(ApiClientError)
    expect(redirectToLogin).toHaveBeenCalled()
    expect(sessionStorageAdapter.getAccessToken()).toBe('')
    expect(sessionStorageAdapter.getRefreshToken()).toBe('')

    sessionStorageAdapter.clear()
  })

  it('并发刷新失败时所有等待请求都会结束，不会永久挂起', async () => {
    seedSession('expired-token', 'refresh-invalid')

    const requests = Promise.allSettled([
      apiClient.get('/api/agent/definition/page?page=1'),
      apiClient.get('/api/agent/definition/page?page=2'),
    ])
    const result = await Promise.race([
      requests,
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 1000)),
    ])

    expect(result).not.toBe('timeout')
    expect(result).toHaveLength(2)
    expect((result as PromiseSettledResult<unknown>[]).every((item) => item.status === 'rejected')).toBe(true)
    expect(refreshCalls.filter((token) => token === 'refresh-invalid')).toHaveLength(1)
    expect(redirectToLogin).toHaveBeenCalled()

    sessionStorageAdapter.clear()
  })

  it('非 401 错误抛出带状态码与关联 ID 的 ApiClientError', async () => {
    seedSession('never-authorized', 'refresh-valid')

    const error = await apiClient.get('/api/agent/definition/page').catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(ApiClientError)
    expect((error as ApiClientError).status).toBe(403)
    expect((error as ApiClientError).message).toContain('没有权限')
    expect((error as ApiClientError).requestId).toMatch(/^[0-9a-f-]{36}$|^req-/)

    sessionStorageAdapter.clear()
  })
})
