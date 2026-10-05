import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageLoading, ErrorState } from '@/components/states'
import { chatKeyToken } from '@/api/auth'
import { apiClient } from '@/api/client'
import type { ApiResponse } from '@/types'
import { useAuthStore } from '@/features/auth/auth-store'
import { useQuery } from '@tanstack/react-query'

/**
 * Communication（RM-03）：通过 ChatKey 的对外分享对话入口。
 * 用 key 换取会话令牌后进入与登录用户等价的聊天界面。
 */
export function CommunicationPage() {
  const { chatKey } = useParams()
  const navigate = useNavigate()
  const acceptLogin = useAuthStore((state) => state.acceptLogin)

  const exchangeQuery = useQuery({
    queryKey: ['chat-key', chatKey],
    queryFn: async () => (await chatKeyToken(String(chatKey))).data.data,
    enabled: Boolean(chatKey),
    retry: false,
  })

  useEffect(() => {
    if (!exchangeQuery.data || !chatKey) return
    let cancelled = false
    acceptLogin(exchangeQuery.data)
    void apiClient
      .get<ApiResponse<string>>(`/api/agent/chat-key/${encodeURIComponent(chatKey)}/get-agent-id`)
      .then((response) => {
        if (!cancelled) navigate(`/chat?agentId=${encodeURIComponent(String(response.data.data))}&shared=1`, { replace: true })
      })
      .catch(() => {
        if (!cancelled) navigate('/chat', { replace: true })
      })
    return () => {
      cancelled = true
    }
  }, [acceptLogin, chatKey, exchangeQuery.data, navigate])

  if (exchangeQuery.error) {
    return <ErrorState error={exchangeQuery.error} />
  }
  return <PageLoading label="正在通过分享链接进入对话…" />
}
