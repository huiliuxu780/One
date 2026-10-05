import { QueryClient } from '@tanstack/react-query'
import { toApiClientError } from '@/api/client'

function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = toApiClientError(error).status
  // 4xx 属于请求本身的问题，重试无意义；408/429 与网络、5xx 允许有限重试。
  if (status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429) return false
  return failureCount < 2
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
}

export const queryClient = createQueryClient()

export const queryKeys = {
  list: (resource: string, params?: unknown) => ['list', resource, params ?? null] as const,
  detail: (resource: string, id: string | number) => ['detail', resource, id] as const,
}
