import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import type { PageResult } from '@/types'
import { queryKeys } from '@/lib/query-client'

export type ListFilters = Record<string, string | number | boolean | undefined>

export interface UsePagedListOptions<T> {
  /** 资源名，用于构造缓存键 */
  resource: string
  fetcher: (params: { page: number; size: number } & ListFilters) => Promise<PageResult<T>>
  initialFilters?: ListFilters
  initialPageSize?: number
  enabled?: boolean
}

function compact(filters: ListFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''))
}

/**
 * 统一的分页列表查询：页码、页大小、筛选状态与缓存、翻页占位。
 * 筛选变化时回到第一页；翻页期间保留上一页数据避免闪烁。
 */
export function usePagedList<T>({ resource, fetcher, initialFilters, initialPageSize = 10, enabled = true }: UsePagedListOptions<T>) {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(initialPageSize)
  const [filters, setFiltersState] = useState<ListFilters>(initialFilters ?? {})

  const setFilter = useCallback((key: string, value: ListFilters[string]) => {
    setFiltersState((previous) => {
      if (previous[key] === value) return previous
      const next = { ...previous }
      if (value === undefined || value === '') delete next[key]
      else next[key] = value
      return next
    })
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters ?? {})
    setPage(1)
  }, [initialFilters])

  const params = useMemo(() => ({ page, size, ...compact(filters) }), [page, size, filters])
  const queryKey = useMemo(() => queryKeys.list(resource, params), [resource, params])

  const query = useQuery({
    queryKey,
    queryFn: () => fetcher(params),
    placeholderData: keepPreviousData,
    enabled,
  })

  return {
    ...query,
    data: query.data ?? null,
    page,
    size,
    filters,
    setPage,
    setSize,
    setFilter,
    resetFilters,
    isPlaceholderData: query.isPlaceholderData,
  }
}

/** 批量选择：以字符串 ID 为键，跨页保留已选项，提供全选/清除语义。 */
export function useBatchSelection(pageIds?: string[]) {
  const [selected, setSelected] = useState<string[]>([])

  const toggle = useCallback((id: string) => {
    setSelected((previous) => (previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]))
  }, [])

  const toggleAll = useCallback(() => {
    const all = pageIds ?? []
    setSelected((previous) => {
      const allSelected = all.length > 0 && all.every((id) => previous.includes(id))
      return allSelected ? [] : all
    })
  }, [pageIds])

  const clear = useCallback(() => setSelected([]), [])

  const isSelected = useCallback((id: string) => selected.includes(id), [selected])
  const allSelected = Boolean(pageIds?.length) && (pageIds ?? []).every((id) => selected.includes(id))
  const someSelected = selected.length > 0

  return { selected, toggle, toggleAll, clear, isSelected, allSelected, someSelected }
}

/** 列表变更后的缓存失效：按资源名精确失效列表与详情。 */
export function useInvalidateResource() {
  const queryClient = useQueryClient()
  return useCallback(
    (resource: string) => {
      void queryClient.invalidateQueries({ queryKey: ['list', resource] })
      void queryClient.invalidateQueries({ queryKey: ['detail', resource] })
    },
    [queryClient],
  )
}
