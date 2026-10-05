import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageLoading, ErrorState } from '@/components/states'
import { chatKeyToken } from '@/api/auth'
import { sessionStorageAdapter } from '@/lib/storage'
import { readableError } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'

/**
 * Communication（RM-03）：通过 ChatKey 的对外分享对话入口。
 * 用 key 换取会话令牌后进入与登录用户等价的聊天界面。
 */
export function CommunicationPage() {
  const { chatKey } = useParams()
  const navigate = useNavigate()

  const exchangeQuery = useQuery({
    queryKey: ['chat-key', chatKey],
    queryFn: async () => (await chatKeyToken(String(chatKey))).data.data,
    enabled: Boolean(chatKey),
    retry: false,
  })

  useEffect(() => {
    if (exchangeQuery.data) {
      sessionStorageAdapter.saveLogin(exchangeQuery.data)
      navigate('/chat', { replace: true })
    }
  }, [exchangeQuery.data, navigate])

  if (exchangeQuery.error) {
    return <ErrorState error={exchangeQuery.error} />
  }
  return <PageLoading label="正在通过分享链接进入对话…" />
}
