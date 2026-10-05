import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUp, Check, CircleNotch, PencilSimple, PushPin, Plus, Square, Trash, Warning, X } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/sonner'
import { MarkdownLite } from '@/components/markdown-lite'
import { EmptyState, ErrorState, PageLoading } from '@/components/states'
import { pageAgents } from '@/api/agents'
import type { ChatSessionVO, Message } from '@/types'
import { readableError } from '@/lib/utils'
import { useChatStore } from '@/features/chat/chat-store'

export function ChatPage() {
  const store = useChatStore()
  const [input, setInput] = useState('')
  const [memoryActive, setMemoryActive] = useState(true)
  const [agentPickerOpen, setAgentPickerOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const agentsQuery = useQuery({
    queryKey: ['list', 'agent', 'chat-select'],
    queryFn: async () => (await pageAgents({ page: 1, size: 100, enabled: true })).data.data.records,
  })
  const agents = agentsQuery.data ?? []

  useEffect(() => {
    void store.loadSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [store.liveMessages.length, store.history.length])

  const activeSession = store.sessions.find((session) => String(session.id) === store.activeSessionId)
  const activeAgent = agents.find((agent) => String(agent.id) === store.activeAgentId)

  async function handleSend() {
    const text = input.trim()
    if (!text || store.running) return
    if (!activeSession || !activeAgent?.agentCode) {
      toast.error('请先选择智能体并创建会话')
      return
    }
    setInput('')
    await store.send(text, activeAgent.agentCode)
  }

  const pinned = store.sessions.filter((session) => session.isPinned)
  const others = store.sessions.filter((session) => !session.isPinned)

  return (
    <div className="grid h-[100dvh] grid-cols-[260px_minmax(0,1fr)]">
      {/* 会话列表 */}
      <aside className="flex h-full flex-col border-r border-sidebar-border bg-sidebar">
        <div className="p-3">
          <Button className="w-full" onClick={() => setAgentPickerOpen(true)}>
            <Plus size={14} /> 新会话
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-auto px-2 pb-3">
          {store.sessionsLoading ? <PageLoading label="会话加载中…" /> : null}
          {[...pinned, ...others].map((session) => (
            <SessionItem key={String(session.id)} session={session} active={String(session.id) === store.activeSessionId} />
          ))}
          {!store.sessionsLoading && store.sessions.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">暂无会话，点击“新会话”开始。</p>
          ) : null}
        </div>
      </aside>

      {/* 消息区 */}
      <main className="flex h-full min-h-0 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{activeSession?.title || '选择会话'}</div>
            <div className="text-xs text-muted-foreground">
              {activeAgent ? `${activeAgent.name} · ${activeAgent.agentCode}` : '未选择智能体'}
            </div>
          </div>
          {store.running ? (
            <Badge variant="outline" className="ml-2 gap-1">
              <CircleNotch size={12} className="animate-spin" /> {store.runState === 'STOPPING' ? '停止中…' : store.reconnecting ? '重连回放中…' : '运行中'}
            </Badge>
          ) : null}
        </header>

        {store.error ? (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <Warning size={14} /> {store.error}
            <button className="ml-auto" onClick={store.clearError} aria-label="关闭错误提示"><X size={14} /></button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
          {!activeSession ? (
            <EmptyState title="开始新的对话" description="从左侧选择会话，或点击“新会话”选择一个智能体。" />
          ) : (
            <>
              {store.history.map((message) => (
                <MessageBubble key={String(message.id)} role={message.role} content={message.content} />
              ))}
              {store.liveMessages.map((message) => (
                <LiveMessage key={message.id} message={message} />
              ))}
              {store.pendingTools.length ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                  <div className="mb-3 text-sm font-medium">工具执行确认（HITL）</div>
                  <div className="space-y-2">
                    {store.pendingTools.map((tool) => (
                      <div key={tool.toolUseId} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                        <span className="font-mono text-xs">{tool.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{JSON.stringify(tool.input ?? {}).slice(0, 80)}</span>
                        <div className="ml-auto flex gap-1">
                          <Button size="sm" onClick={() => void store.decide([{ toolUseId: tool.toolUseId, name: tool.name, approved: true }], memoryActive)}>
                            <Check size={13} /> 允许
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void store.decide([{ toolUseId: tool.toolUseId, name: tool.name, approved: false }], memoryActive)}>
                            拒绝
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={memoryActive} onCheckedChange={setMemoryActive} aria-label="记忆开关" /> 本次决策计入长期记忆（memoryActive）
                  </label>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="flex items-end gap-2">
            <Textarea
              className="min-h-11 flex-1"
              placeholder={activeSession ? '输入消息，Enter 发送，Shift+Enter 换行' : '先创建会话'}
              value={input}
              disabled={!activeSession || store.running}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void handleSend()
                }
              }}
            />
            {store.running ? (
              <Button variant="destructive" onClick={() => void store.stop()} disabled={store.runState === 'STOPPING'}>
                <Square size={14} /> {store.runState === 'STOPPING' ? '停止中…' : '停止'}
              </Button>
            ) : (
              <Button onClick={() => void handleSend()} disabled={!input.trim() || !activeSession}>
                <ArrowUp size={14} /> 发送
              </Button>
            )}
          </div>
        </div>
      </main>

      {agentPickerOpen ? (
        <AgentPicker
          agents={agents.map((agent) => ({ id: String(agent.id), name: agent.name, code: agent.agentCode }))}
          loading={agentsQuery.isLoading}
          onClose={() => setAgentPickerOpen(false)}
          onPick={async (agent) => {
            setAgentPickerOpen(false)
            const created = await store.newSession(agent.id)
            if (!created) toast.error('创建会话失败')
          }}
        />
      ) : null}
    </div>
  )
}

function SessionItem({ session, active }: { session: ChatSessionVO; active: boolean }) {
  const { openSession, removeSession, togglePin, renameSession } = useChatStore()
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(session.title ?? '')

  return (
    <div
      className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${active ? 'bg-sidebar-accent font-medium' : 'hover:bg-sidebar-accent/60'}`}
      onClick={() => void openSession(session)}
    >
      {session.isPinned ? <PushPin size={12} className="shrink-0 text-primary" /> : null}
      {renaming ? (
        <Input
          autoFocus
          className="h-7 text-xs"
          value={title}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => { setRenaming(false); if (title.trim()) void renameSession(String(session.id), title.trim()) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { setRenaming(false); if (title.trim()) void renameSession(String(session.id), title.trim()) }
          }}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate">{session.title || `会话 ${String(session.id).slice(-6)}`}</span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="opacity-0 group-hover:opacity-100" aria-label="会话操作" onClick={(event) => event.stopPropagation()}>
            ⋯
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => { setTitle(session.title ?? ''); setRenaming(true) }}>
            <PencilSimple size={14} /> 重命名
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void togglePin(session)}>
            <PushPin size={14} /> {session.isPinned ? '取消置顶' : '置顶'}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onSelect={() => void removeSession(String(session.id))}>
            <Trash size={14} /> 删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function AgentPicker({ agents, loading, onClose, onPick }: {
  agents: Array<{ id: string; name: string; code: string }>
  loading: boolean
  onClose: () => void
  onPick: (agent: { id: string; name: string; code: string }) => Promise<void>
}) {
  const [keyword, setKeyword] = useState('')
  const filtered = useMemo(() => agents.filter((agent) => agent.name.includes(keyword) || agent.code.includes(keyword)), [agents, keyword])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-4 shadow-dialog" onClick={(event) => event.stopPropagation()}>
        <Label>选择智能体开始会话</Label>
        <Input className="mt-2" autoFocus placeholder="搜索…" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <div className="mt-2 max-h-72 space-y-0.5 overflow-auto">
          {loading ? <PageLoading /> : null}
          {filtered.map((agent) => (
            <button key={agent.id} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => void onPick(agent)}>
              <div className="font-medium">{agent.name}</div>
              <div className="font-mono text-xs text-muted-foreground">{agent.code}</div>
            </button>
          ))}
          {!loading && filtered.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">没有匹配的智能体</p> : null}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ role, content }: { role: string; content: string | unknown }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">
          <MarkdownLite content={typeof content === 'string' ? content : JSON.stringify(content)} />
        </div>
      </div>
    )
  }
  if (role === 'tool') {
    return (
      <details className="max-w-[85%] rounded-xl border border-border bg-card px-3 py-2 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">工具结果</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs">{typeof content === 'string' ? content : JSON.stringify(content, null, 2)}</pre>
      </details>
    )
  }
  if (role === 'activity') {
    return (
      <details className="max-w-[85%] rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">活动卡片</summary>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs">{typeof content === 'string' ? content : JSON.stringify(content, null, 2)}</pre>
      </details>
    )
  }
  return (
    <div className="flex">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2.5">
        <MarkdownLite content={typeof content === 'string' ? content : JSON.stringify(content)} />
      </div>
    </div>
  )
}

/** AG-UI 实时消息渲染：文本/推理/工具调用分片 */
function LiveMessage({ message }: { message: Message }) {
  if (message.role === 'user') return <MessageBubble role="user" content={message.content ?? ''} />
  if (message.role === 'tool') return <MessageBubble role="tool" content={message.content ?? ''} />
  if (message.role === 'assistant') return <MessageBubble role="assistant" content={message.content ?? ''} />
  return null
}

export function chatPageErrorFallback(cause: unknown) {
  return <ErrorState error={cause} onRetry={() => window.location.reload()} />
}
