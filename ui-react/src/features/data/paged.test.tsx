import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { PageResult } from '@/types'
import { useBatchSelection, usePagedList, type ListFilters } from './paged'

interface Row {
  id: string
  name: string
}

const server = setupServer(
  http.get('*/api/test/page', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const keyword = url.searchParams.get('keyword') ?? ''
    const records: Row[] = Array.from({ length: 3 }, (_, index) => ({ id: String(page * 10 + index), name: `${keyword || 'all'}-row-${index}` }))
    return HttpResponse.json({
      code: 200,
      msg: '操作成功',
      data: { records, total: 7, size: 3, current: page, pages: 3 } satisfies PageResult<Row>,
    })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const fetcher = async (params: { page: number; size: number } & ListFilters): Promise<PageResult<Row>> => {
  const query = new URLSearchParams({ page: String(params.page), size: String(params.size) })
  if (params.keyword !== undefined) query.set('keyword', String(params.keyword))
  const response = await fetch(`http://test.local/api/test/page?${query.toString()}`)
  const payload = (await response.json()) as { data: PageResult<Row> }
  return payload.data
}

describe('usePagedList', () => {
  it('加载第一页并返回分页元数据', async () => {
    const { result } = renderHook(() => usePagedList<Row>({ resource: 'test', fetcher, initialPageSize: 3 }), { wrapper })
    await waitFor(() => expect(result.current.data?.records).toHaveLength(3))
    expect(result.current.data?.total).toBe(7)
    expect(result.current.page).toBe(1)
  })

  it('筛选变化时回到第一页并带上筛选参数', async () => {
    const { result } = renderHook(() => usePagedList<Row>({ resource: 'test', fetcher, initialPageSize: 3 }), { wrapper })
    await waitFor(() => expect(result.current.data?.records[0]?.name).toBe('all-row-0'))

    act(() => result.current.setFilter('keyword', 'abc'))
    expect(result.current.page).toBe(1)
    await waitFor(() => expect(result.current.data?.records[0]?.name).toBe('abc-row-0'))
  })

  it('翻页后请求新页数据', async () => {
    const { result } = renderHook(() => usePagedList<Row>({ resource: 'test', fetcher, initialPageSize: 3 }), { wrapper })
    await waitFor(() => expect(result.current.data?.records).toHaveLength(3))

    act(() => result.current.setPage(2))
    await waitFor(() => expect(result.current.data?.records[0]?.id).toBe('20'))
  })
})

describe('useBatchSelection', () => {
  it('单选、全选与清除语义正确', () => {
    const { result } = renderHook(() => useBatchSelection(['a', 'b', 'c']))

    act(() => result.current.toggle('a'))
    expect(result.current.selected).toEqual(['a'])
    expect(result.current.isSelected('a')).toBe(true)
    expect(result.current.allSelected).toBe(false)
    expect(result.current.someSelected).toBe(true)

    act(() => result.current.toggleAll())
    expect(result.current.selected).toEqual(['a', 'b', 'c'])
    expect(result.current.allSelected).toBe(true)

    act(() => result.current.toggleAll())
    expect(result.current.selected).toEqual([])

    act(() => {
      result.current.toggle('b')
      result.current.clear()
    })
    expect(result.current.selected).toEqual([])
  })
})
