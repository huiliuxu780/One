import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitBranch, MagnifyingGlass } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { toast } from '@/components/ui/sonner'
import { MarkdownLite } from '@/components/markdown-lite'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states'
import { getMessageTree, pageSessions, switchCurrentMessage, updateCurrentMessageContent } from '@/api/chatSession'
import type { ChatMessageVO, ChatSessionVO } from '@/types'
import { readableError } from '@/lib/utils'

/**
 * 会话历史（RM-03 ChatHistory）：分页浏览会话与消息链，支持切换当前分支与编辑当前消息内容。
 */
export function ChatHistoryPage() {
  const [keyword, setKeyword] = useState('')
  const [sessionPage, setSessionPage] = useState(1)
  const [activeSession, setActiveSession] = useState<ChatSessionVO | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const sessionsQuery = useQuery({
    queryKey: ['list', 'chat-session', 'history', sessionPage, keyword],
    queryFn: async () => (await pageSessions({ page: sessionPage, size: 10, title: keyword || undefined })).data.data,
  })

  const messagesQuery = useQuery({
    queryKey: ['list', 'chat-history-tree', activeSession?.id],
    queryFn: async () => (await getMessageTree(String(activeSession!.id))).data.data,
    enabled: Boolean(activeSession),
  })

  const messages: ChatMessageVO[] = messagesQuery.data ?? []
  const currentLeaf = messages.find((message) => String(message.id) === String(activeSession?.currentMessageId))
  const currentPath = new Set((currentLeaf?.path ?? '').split('/').filter(Boolean))

  async function switchBranch(message: ChatMessageVO) {
    if (!activeSession) return
    try {
      await switchCurrentMessage(String(activeSession.id), String(message.id))
      setActiveSession({ ...activeSession, currentMessageId: String(message.id) })
      toast.success('已切换当前分支')
      void messagesQuery.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '分支切换失败'))
    }
  }

  async function saveContent(message: ChatMessageVO) {
    if (!activeSession) return
    try {
      if (String(activeSession.currentMessageId) !== String(message.id)) {
        await switchCurrentMessage(String(activeSession.id), String(message.id))
        setActiveSession({ ...activeSession, currentMessageId: String(message.id) })
      }
      await updateCurrentMessageContent(String(activeSession.id), editText)
      toast.success('当前消息内容已更新')
      setEditingId(null)
      void messagesQuery.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '更新失败'))
    }
  }

  return (
    <div className="grid h-[calc(100dvh-0px)] min-h-0 grid-cols-[320px_minmax(0,1fr)] px-0">
      <aside className="flex h-full min-h-0 flex-col border-r border-border bg-sidebar p-3">
        <div className="relative mb-2">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="搜索会话" value={keyword} onChange={(event) => { setKeyword(event.target.value); setSessionPage(1) }} />
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-auto">
          {(sessionsQuery.data?.records ?? []).map((session: ChatSessionVO) => (
            <button
              key={String(session.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${activeSession?.id === session.id ? 'bg-sidebar-accent font-medium' : 'hover:bg-sidebar-accent/60'}`}
              onClick={() => setActiveSession(session)}
            >
              <div className="truncate">{session.title || `会话 ${String(session.id).slice(-6)}`}</div>
              <div className="truncate text-xs text-muted-foreground">{session.updatedAt ?? ''}</div>
            </button>
          ))}
          {sessionsQuery.isLoading ? <TableSkeleton rows={4} /> : null}
          {!sessionsQuery.isLoading && (sessionsQuery.data?.records ?? []).length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">暂无会话</p>
          ) : null}
        </div>
        {sessionsQuery.data ? (
          <Pagination page={sessionPage} size={sessionsQuery.data.size} total={sessionsQuery.data.total} onPageChange={setSessionPage} />
        ) : null}
      </aside>

      <main className="min-h-0 overflow-auto p-5">
        {!activeSession ? (
          <EmptyState title="选择会话" description="从左侧选择一个会话浏览其消息历史。" />
        ) : messagesQuery.isLoading ? (
          <TableSkeleton rows={4} />
        ) : messagesQuery.error ? (
          <ErrorState error={messagesQuery.error} onRetry={() => void messagesQuery.refetch()} />
        ) : messages.length === 0 ? (
          <EmptyState title="当前分支没有消息" />
        ) : (
          <div className="mx-auto max-w-3xl space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GitBranch size={13} /> 完整消息树；蓝色节点属于当前分支
              <Badge variant="outline" className="ml-auto">共 {messages.length} 条</Badge>
            </div>
            {messages.map((message) => (
              <div key={String(message.id)} className={`rounded-xl border bg-card p-3 ${currentPath.has(String(message.id)) ? 'border-primary/45' : 'border-border opacity-80'}`} style={{ marginLeft: Math.min(message.depth ?? 0, 8) * 16 }}>
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={message.role === 'user' ? 'default' : 'secondary'}>{message.role}</Badge>
                  <span className="font-mono">depth {message.depth}</span>
                  <span>{message.createdAt ?? ''}</span>
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="sm" disabled={String(activeSession.currentMessageId) === String(message.id)} onClick={() => void switchBranch(message)}>{String(activeSession.currentMessageId) === String(message.id) ? '当前叶节点' : '从此继续'}</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditingId(String(message.id)); setEditText(message.content ?? '') }}>编辑</Button>
                  </div>
                </div>
                {editingId === String(message.id) ? (
                  <div className="space-y-2">
                    <textarea
                      className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void saveContent(message)}>保存</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>取消</Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm"><MarkdownLite content={message.content ?? ''} /></div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
