import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowSquareOut, Copy, Key, Link, Trash } from '@phosphor-icons/react'
import { addAgentJob, deleteAgentJob, getAgent, getAgentChatKey, getAgentJob, getAgentTrends, updateAgentJob } from '@/api/agents'
import { getCurrentMessages, pageSessions, deleteSession } from '@/api/chatSession'
import { hooks, mcpServers, modelConfigs, prompts, sensitiveWords, skills, tools } from '@/api/resources'
import { getWorkflow } from '@/api/workflows'
import { agentEndpoints, workspaceEndpoints, type ApiDocEndpoint } from './api-doc-data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import { EmptyState, ErrorState, PageLoading } from '@/components/states'
import { readableError } from '@/lib/utils'
import type { AgentDefinitionVO, ChatMessageVO, ChatSessionVO, JobInfo, TrendItem } from '@/types'

export function AgentDetails({ agent, onClose }: { agent: AgentDefinitionVO; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-auto sm:max-w-4xl">
        <SheetHeader><SheetTitle>{agent.name}</SheetTitle><SheetDescription>{agent.agentCode} · 实时配置与运行数据</SheetDescription></SheetHeader>
        <Tabs defaultValue="architecture" className="p-4 pt-2">
          <TabsList className="flex-wrap">
            <TabsTrigger value="architecture">架构</TabsTrigger>
            <TabsTrigger value="api">API / Chat Key</TabsTrigger>
            <TabsTrigger value="statistics">统计</TabsTrigger>
            <TabsTrigger value="history">对话历史</TabsTrigger>
            <TabsTrigger value="schedule">定时任务</TabsTrigger>
          </TabsList>
          <TabsContent value="architecture"><ArchitecturePanel agentId={String(agent.id)} /></TabsContent>
          <TabsContent value="api"><ApiPanel agent={agent} /></TabsContent>
          <TabsContent value="statistics"><StatisticsPanel agentId={String(agent.id)} /></TabsContent>
          <TabsContent value="history"><HistoryPanel agentId={String(agent.id)} /></TabsContent>
          <TabsContent value="schedule"><SchedulePanel agentId={String(agent.id)} /></TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

type NamedValue = { name?: string; alias?: string; toolId?: string } | null
type DetailFetcher = (id: string) => Promise<{ data: { data: NamedValue } }>

interface ArchItem {
  id: string
  name: string
  sub?: string
}

/** 与 Vue useArchitectureData 一致：逐 ID 拉详情解析名称；单个失败回退显示 ID，不伪造。 */
async function resolveIds(ids: string[], fetch: DetailFetcher): Promise<ArchItem[]> {
  if (!ids.length) return []
  const settled = await Promise.allSettled(ids.map((id) => fetch(id)))
  return settled.map((result, index) => {
    const value = result.status === 'fulfilled' ? result.value.data.data : null
    return value
      ? { id: ids[index], name: value.alias || value.name || ids[index], sub: value.toolId }
      : { id: ids[index], name: ids[index] }
  })
}

function ArchitecturePanel({ agentId }: { agentId: string }) {
  const query = useQuery({
    queryKey: ['detail', 'agent-architecture', agentId],
    queryFn: async () => {
      const agent = (await getAgent(agentId)).data.data
      if (!agent) throw new Error('智能体不存在')
      const [modelItems, toolItems, skillItems, mcpItems, hookItems, subAgentItems, workflowItems, promptItems, sensitiveItems] = await Promise.all([
        resolveIds(agent.modelConfigId ? [agent.modelConfigId] : [], modelConfigs.detail as DetailFetcher),
        resolveIds(agent.tool ?? [], tools.detail as DetailFetcher),
        resolveIds(agent.skill ?? [], skills.detail as DetailFetcher),
        resolveIds(agent.mcp ?? [], mcpServers.detail as DetailFetcher),
        resolveIds(agent.hook ?? [], hooks.detail as DetailFetcher),
        resolveIds(agent.subAgent ?? [], getAgent as DetailFetcher),
        resolveIds(agent.workflow ?? [], getWorkflow as DetailFetcher),
        resolveIds(agent.systemPromptTemplateId ? [agent.systemPromptTemplateId] : [], prompts.detail as DetailFetcher),
        resolveIds(agent.sensitiveWordConfigId ? [agent.sensitiveWordConfigId] : [], sensitiveWords.detail as DetailFetcher),
      ])
      return { agent, modelItems, toolItems, skillItems, mcpItems, hookItems, subAgentItems, workflowItems, promptItems, sensitiveItems }
    },
  })
  if (query.isLoading) return <PageLoading />
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const data = query.data!
  const groups = [
    ['模型', data.modelItems],
    ['工具', data.toolItems],
    ['技能', data.skillItems],
    ['MCP', data.mcpItems],
    ['Hook', data.hookItems],
    ['子 Agent', data.subAgentItems],
    ['工作流', data.workflowItems],
    ['提示词模板', data.promptItems],
    ['敏感词配置', data.sensitiveItems],
  ] as Array<[string, ArchItem[]]>
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/20 p-5">
      <div className="mx-auto mb-5 max-w-sm rounded-lg border-2 border-primary bg-card p-4 text-center shadow-card">
        <div className="font-semibold">{data.agent.name}</div>
        <div className="font-mono text-xs text-muted-foreground">{data.agent.agentCode}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map(([label, items]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between text-sm font-medium"><span>{label}</span><Badge variant="secondary">{items.length}</Badge></div>
            {items.length ? (
              <div className="flex flex-wrap gap-1">
                {items.map((item) => <Badge key={item.id} variant="outline" className="max-w-full truncate" title={item.sub ? `${item.name} · ${item.sub}` : item.name}>{item.name}</Badge>)}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">未配置</span>
            )}
          </div>
        ))}
      </div>
      
    </div>
  )
}

function ApiPanel({ agent }: { agent: AgentDefinitionVO }) {
  const [refresh, setRefresh] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const query = useQuery({ queryKey: ['detail', 'agent-chat-key', String(agent.id), refresh], queryFn: async () => (await getAgentChatKey(String(agent.id), refresh)).data.data })
  useEffect(() => { if (refresh && query.isSuccess) setRefresh(false) }, [refresh, query.isSuccess])
  const chatUrl = query.data ? `${window.location.origin}${import.meta.env.BASE_URL}communication/${query.data}` : ''
  const runtimeUrl = `${window.location.origin}/api/runtime/agui/run/${agent.agentCode}`
  async function copy(value: string) { await navigator.clipboard.writeText(value); toast.success('已复制') }
  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg border border-border p-4">
        <div className="mb-2 flex items-center gap-2 font-medium"><Key size={17} />外部对话链接</div>
        {query.isLoading ? <PageLoading /> : query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : (
          <>
            <div className="flex gap-2">
              <Input readOnly value={chatUrl} className="font-mono text-xs" />
              <Button size="icon" variant="outline" aria-label="复制外部对话链接" onClick={() => void copy(chatUrl)}><Copy size={14} /></Button>
              <Button size="icon" variant="outline" asChild><a href={chatUrl} target="_blank" rel="noreferrer" aria-label="打开外部对话链接"><ArrowSquareOut size={14} /></a></Button>
            </div>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => { if (window.confirm('刷新后旧链接立即失效，确认继续？')) setRefresh(true) }}>刷新 Chat Key</Button>
          </>
        )}
      </div>
      <div className="rounded-lg border border-border p-4">
        <div className="mb-2 flex items-center gap-2 font-medium"><Link size={17} />AG-UI 运行接口</div>
        <div className="flex gap-2">
          <Input readOnly value={runtimeUrl} className="font-mono text-xs" />
          <Button size="icon" variant="outline" aria-label="复制运行接口地址" onClick={() => void copy(runtimeUrl)}><Copy size={14} /></Button>
        </div>
        <pre className="mt-3 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify({ threadId: 'string', runId: 'string', messages: [{ id: 'string', role: 'user', content: '你好' }], forwardedProps: { agentId: String(agent.id), memoryActive: false, planActive: false, fileIds: [] } }, null, 2)}</pre>
      </div>
      <EndpointDocGroup title="智能体对话接口" endpoints={agentEndpoints} expanded={expanded} onToggle={toggle} />
      <EndpointDocGroup title="工作空间接口" endpoints={workspaceEndpoints} expanded={expanded} onToggle={toggle} />
    </div>
  )
}

function EndpointDocGroup({ title, endpoints, expanded, onToggle }: {
  title: string
  endpoints: ApiDocEndpoint[]
  expanded: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 font-medium">{title}</div>
      <div className="space-y-1">
        {endpoints.map((endpoint) => (
          <div key={endpoint.id} className="rounded-lg border border-border/60">
            <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm" onClick={() => onToggle(endpoint.id)} aria-expanded={expanded.has(endpoint.id)}>
              <Badge variant="outline" className="font-mono">{endpoint.method}</Badge>
              <span className="truncate font-mono text-xs">{endpoint.path}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{endpoint.desc}</span>
            </button>
            {expanded.has(endpoint.id) ? (
              <div className="space-y-2 border-t border-border/60 px-3 py-2 text-xs">
                {endpoint.note ? <p className="text-muted-foreground">{endpoint.note}</p> : null}
                {endpoint.params.length ? (
                  <div>
                    <div className="mb-1 font-medium">参数</div>
                    <ul className="space-y-0.5 text-muted-foreground">
                      {endpoint.params.map((param) => <li key={param.name}><span className="font-mono">{param.name}</span>（{param.type}{param.required ? '，必填' : '，可选'}）：{param.desc}</li>)}
                    </ul>
                  </div>
                ) : null}
                {endpoint.bodyExample ? <div><div className="mb-1 font-medium">请求体示例</div><pre className="overflow-auto rounded bg-muted p-2 font-mono">{endpoint.bodyExample}</pre></div> : null}
                {endpoint.responseExample ? <div><div className="mb-1 font-medium">响应示例</div><pre className="overflow-auto rounded bg-muted p-2 font-mono">{endpoint.responseExample}</pre></div> : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatisticsPanel({ agentId }: { agentId: string }) {
  const [days, setDays] = useState(7)
  const query = useQuery({ queryKey: ['detail', 'agent-statistics', agentId, days], queryFn: async () => (await getAgentTrends(agentId, days)).data.data })
  if (query.isLoading) return <PageLoading />
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const cards: Array<[string, TrendItem[], 'sum' | 'average']> = [['会话数', query.data?.sessionTrend ?? [], 'sum'], ['活跃用户', query.data?.activeUserTrend ?? [], 'sum'], ['消息数', query.data?.messageTrend ?? [], 'sum'], ['平均轮次', query.data?.avgRoundsTrend ?? [], 'average']]
  return <div className="mt-4"><div className="mb-3 flex gap-1">{[3, 7, 15, 30, 90].map((value) => <Button key={value} size="sm" variant={days === value ? 'default' : 'outline'} onClick={() => setDays(value)}>{value}天</Button>)}</div><div className="grid gap-3 sm:grid-cols-2">{cards.map(([label, items, aggregation]) => { const sum = items.reduce((total, item) => total + (item.value || 0), 0); const value = aggregation === 'average' && items.length ? (sum / items.length).toFixed(1) : sum; return <div key={label} className="rounded-lg border border-border p-4"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 font-display text-[26px] font-bold">{value}</div><Sparkline items={items} /></div> })}</div></div>
}

function Sparkline({ items }: { items: TrendItem[] }) {
  const points = useMemo(() => { const max = Math.max(...items.map((item) => item.value), 1); return items.map((item, index) => `${items.length <= 1 ? 0 : (index / (items.length - 1)) * 100},${32 - (item.value / max) * 28}`).join(' ') }, [items])
  return <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="mt-3 h-20 w-full" role="img" aria-label="趋势折线"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" vectorEffect="non-scaling-stroke" /></svg>
}

function HistoryPanel({ agentId }: { agentId: string }) {
  const [sessionId, setSessionId] = useState('')
  const queryClient = useQueryClient()
  const sessionsQuery = useQuery({ queryKey: ['list', 'agent-session-history', agentId], queryFn: async () => (await pageSessions({ page: 1, size: 100, agentId })).data.data.records })
  const messagesQuery = useQuery({ queryKey: ['list', 'agent-session-messages', sessionId], queryFn: async () => (await getCurrentMessages(sessionId)).data.data, enabled: Boolean(sessionId) })

  async function removeSession(session: ChatSessionVO) {
    if (!window.confirm(`确定要删除会话「${session.title || '未命名会话'}」吗？删除后不可恢复。`)) return
    try {
      await deleteSession(String(session.id))
      toast.success('会话已删除')
      if (sessionId === String(session.id)) setSessionId('')
      void queryClient.invalidateQueries({ queryKey: ['list', 'agent-session-history', agentId] })
    } catch (cause) {
      toast.error(readableError(cause, '删除失败'))
    }
  }

  if (sessionsQuery.isLoading) return <PageLoading />
  if (sessionsQuery.error) return <ErrorState error={sessionsQuery.error} onRetry={() => void sessionsQuery.refetch()} />
  const sessions = sessionsQuery.data ?? []
  if (!sessions.length) return <EmptyState title="暂无对话历史" description="该 Agent 尚未产生会话。" />
  return <div className="mt-4 grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]"><div className="space-y-2">{sessions.map((session) => <div key={String(session.id)} role="button" tabIndex={0} className={`w-full cursor-pointer rounded-lg border p-3 text-left ${sessionId === String(session.id) ? 'border-primary bg-primary/5' : 'border-border'}`} onClick={() => setSessionId(String(session.id))} onKeyDown={(event) => { if (event.key === 'Enter') setSessionId(String(session.id)) }}><div className="flex items-center gap-1"><span className="min-w-0 flex-1 truncate text-sm font-medium">{session.title || '未命名会话'}</span><button aria-label={`删除会话 ${session.title || '未命名会话'}`} className="shrink-0 text-muted-foreground hover:text-destructive" onClick={(event) => { event.stopPropagation(); void removeSession(session) }}><Trash size={13} /></button></div><div className="mt-1 text-xs text-muted-foreground">{session.updatedAt || session.createdAt}</div></div>)}</div><div className="space-y-2">{!sessionId ? <p className="text-sm text-muted-foreground">选择会话查看消息。</p> : messagesQuery.isLoading ? <PageLoading /> : messagesQuery.error ? <ErrorState error={messagesQuery.error} onRetry={() => void messagesQuery.refetch()} /> : (messagesQuery.data ?? []).filter((message) => !(message.role === 'system' && message.depth === 0)).map((message: ChatMessageVO) => <div key={String(message.id)} className={`rounded-lg p-3 text-sm ${message.role === 'user' ? 'ml-8 bg-primary/10' : 'mr-8 bg-muted'}`}><div className="mb-1 text-[10px] uppercase text-muted-foreground">{message.role}</div><div className="whitespace-pre-wrap break-words">{message.content}</div></div>)}</div></div>
}

function SchedulePanel({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['detail', 'agent-job', agentId], queryFn: async () => (await getAgentJob(agentId)).data.data, retry: false })
  const [cron, setCron] = useState('0 0 * * * ?')
  const [input, setInput] = useState('')
  const [enabled, setEnabled] = useState(true)
  useEffect(() => { if (!query.data) return; setCron(query.data.cron || '0 0 * * * ?'); setEnabled(Boolean(query.data.enabled)); try { const data = JSON.parse(query.data.dataMap || '{}') as { input?: string; userPrompt?: string }; setInput(data.userPrompt ?? data.input ?? '') } catch { setInput('') } }, [query.data])
  const mutation = useMutation({ mutationFn: async () => { const job: JobInfo = { ...query.data, type: 'AGENT', bizId: agentId, cron, enabled, jobClass: 'com.hxh.apboa.scheduler.scheduler.AgentScheduler', dataMap: JSON.stringify({ jobName: `Agent ${agentId}`, bizName: agentId, type: 'AGENT', bizId: agentId, userPrompt: input }) }; return query.data?.id ? updateAgentJob(job) : addAgentJob(job) }, onSuccess: () => { toast.success('定时任务已保存'); void queryClient.invalidateQueries({ queryKey: ['detail', 'agent-job', agentId] }) }, onError: (cause) => toast.error(readableError(cause, '保存失败')) })
  return <div className="mt-4 max-w-xl space-y-4"><div><Label>Cron（Quartz 六位）</Label><Input className="mt-1 font-mono" value={cron} onChange={(event) => setCron(event.target.value)} /></div><div><Label>触发输入</Label><Textarea className="mt-1 min-h-28" value={input} onChange={(event) => setInput(event.target.value)} /></div><label className="flex items-center gap-2 text-sm"><Switch checked={enabled} onCheckedChange={setEnabled} />启用</label><div className="flex gap-2"><Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? '保存中…' : '保存任务'}</Button>{query.data?.id ? <Button variant="outline" className="text-destructive" onClick={async () => { if (!window.confirm('确认解绑并删除该定时任务？')) return; try { await deleteAgentJob(agentId); toast.success('已解绑'); void queryClient.invalidateQueries({ queryKey: ['detail', 'agent-job', agentId] }) } catch (cause) { toast.error(readableError(cause, '解绑失败')) } }}><Trash size={14} />解绑</Button> : null}</div></div>
}
