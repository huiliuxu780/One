import { http, HttpResponse } from 'msw'
import type { ApiResponse, LoginResponse } from '@/types'

function loginResponse(overrides?: Partial<LoginResponse>): ApiResponse<LoginResponse> {
  return {
    code: 200,
    msg: '操作成功',
    data: {
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      accessTokenTTL: String(Date.now() + 60 * 60 * 1000),
      refreshTokenTTL: String(Date.now() + 24 * 60 * 60 * 1000),
      userDetail: {
        id: '1',
        username: 'tester',
        name: '测试用户',
        email: 'tester@example.com',
        tenantId: '1',
        tenantCode: 'default',
        tenantName: '默认组织',
        tenantRole: 'TENANT_EDITOR',
      },
      ...overrides,
    },
  } as ApiResponse<LoginResponse>
}

export const handlers = [
  http.post('*/api/auth/login', () => HttpResponse.json(loginResponse())),
  http.post('*/api/auth/logout', () => HttpResponse.json({ code: 200, msg: '操作成功', data: true })),
  http.post('*/api/auth/refresh-token', async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string }
    if (!body.refreshToken || !body.refreshToken.startsWith('refresh-')) {
      return HttpResponse.json({ code: 401, msg: '刷新凭据无效' }, { status: 401 })
    }
    return HttpResponse.json(
      loginResponse({ accessToken: `${body.refreshToken}-rotated`, refreshToken: body.refreshToken }),
    )
  }),
  http.get('*/api/agent/definition/page', ({ request }) => {
    const url = new URL(request.url)
    const auth = request.headers.get('Authorization')
    if (!auth?.startsWith('Bearer ') || auth.includes('expired')) {
      return HttpResponse.json({ code: 401, msg: '登录状态已过期' }, { status: 401 })
    }
    const total = Number(url.searchParams.get('total') ?? 12)
    const size = Number(url.searchParams.get('size') ?? 10)
    const page = Number(url.searchParams.get('page') ?? 1)
    const recordsData = Array.from({ length: Math.min(size, Math.max(total - (page - 1) * size, 0)) }, (_, index) => ({
      id: String((page - 1) * size + index + 1),
      name: `Agent ${(page - 1) * size + index + 1}`,
      type: 'AGENT',
      enabled: true,
    }))
    return HttpResponse.json({
      code: 200,
      msg: '操作成功',
      data: { records: recordsData, total, size, current: page, pages: Math.ceil(total / size) },
    })
  }),
]
