import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ApiServicePage } from './api-service-page'

const pageParams: URLSearchParams[] = []

const server = setupServer(
  http.get('*/api/gateway/api/brief', () => HttpResponse.json({ code: 200, msg: 'ok', data: [{ id: '77', name: '演示 API' }] })),
  http.get('*/api/gateway/access-log/page', ({ request }) => {
    pageParams.push(new URL(request.url).searchParams)
    return HttpResponse.json({
      code: 200,
      msg: 'ok',
      data: {
        records: [{ id: 'log-1', method: 'POST', path: '/v1/ask', accessIp: '10.0.0.1', httpStatus: 200, status: 1, createdAt: '2026-10-06 12:00:00' }],
        total: 1,
        size: 20,
        current: 1,
        pages: 1,
      },
    })
  }),
  http.get('*/api/gateway/access-log/log-1', () => HttpResponse.json({
    code: 200,
    msg: 'ok',
    data: {
      id: 'log-1',
      method: 'POST',
      path: '/v1/ask',
      httpStatus: 200,
      status: 1,
      requestBody: '{"question":"hi"}',
      responseBody: '{"answer":"hello"}',
      error: '',
      queryParams: '{"trace":"t1"}',
    },
  })),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => { server.resetHandlers(); pageParams.length = 0 })
afterAll(() => server.close())

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/api-service?tab=logs']}>
        <ApiServicePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('访问日志页签', () => {
  it('提供 API 与结果筛选，并把 apiId 并入分页请求', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: '查看' })

    await user.click(screen.getByRole('combobox', { name: '按 API 筛选' }))
    const option = await screen.findByRole('option', { name: '演示 API' })
    await user.click(option)

    await waitFor(() => expect(pageParams.some((params) => params.get('apiId') === '77')).toBe(true))
  })

  it('详情弹窗读取详情接口并展示请求/响应正文', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: '查看' }))

    expect(await screen.findByText('请求体')).toBeInTheDocument()
    expect(screen.getByText(/"question": "hi"/)).toBeInTheDocument()
    expect(screen.getByText(/"answer": "hello"/)).toBeInTheDocument()
    expect(screen.getByText('Query 参数')).toBeInTheDocument()
  })
})
