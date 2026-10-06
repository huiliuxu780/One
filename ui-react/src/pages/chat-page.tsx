import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUp,
  Check,
  CircleNotch,
  File,
  ListChecks,
  Paperclip,
  PencilSimple,
  PushPin,
  Plus,
  Robot,
  Square,
  Trash,
  Warning,
  X,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/sonner'
import { MarkdownLite, type MarkdownInteractionPayload } from '@/components/markdown-lite'
import { FilePreviewDialog, type FilePreviewSource } from '@/components/file-preview-dialog'
import { EmptyState, ErrorState, PageLoading } from '@/components/states'
import { enabledSkillsOfAgent, enabledToolsOfAgent, getAgentAllowedFileTypes, pageAgents } from '@/api/agents'
import { downloadFile, listFiles } from '@/api/workspace'
import { deleteAttachments, downloadAttachment, parseAttachmentText, uploadAttachment } from '@/api/attach'
import { MentionDropdown, type MentionDropdownHandle } from '@/features/chat/mention-dropdown'
import { BUILTIN_AGENT_SKILLS, buildTag, findMentionQuery, matchTagBeforeCursor, type MentionResourceItem } from '@/features/chat/mention'
import { TaggedText } from '@/features/chat/tagged-text'
import { messageWithFiles, parseMessageContent } from '@/features/chat/message-content'
import { updateCurrentMessageContent } from '@/api/chatSession'
import type { ChatMessageVO, ChatSessionVO, Message, PlanInfo, SubAgentRunVO, UploadedFileItem } from '@/types'
import type { ToolCallView } from '@/features/chat/chat-runtime'
import { useChatStore } from '@/features/chat/chat-store'
import { ContextUsageIndicator } from '@/features/chat/context-usage-indicator'

const MAX_ATTACHMENT_SIZE = 30 * 1024 * 1024
const PARSED_DOCUMENT_TYPES = new Set(['doc', 'docx', 'xlsx', 'xls', 'csv', 'pptx', 'ppt', 'pdf', 'txt', 'md'])

type UploadItem = UploadedFileItem & { progress?: number; error?: string }

function extensionOf(name: string) {
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index + 1).toLowerCase() : ''
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function injectInteractionSubmission(raw: string, payload: MarkdownInteractionPayload) {
  const parsedBlock = JSON.parse(payload.code) as { interaction?: { fields?: Array<{ name?: string; defaultValue?: unknown }>; submittedData?: Record<string, unknown> } }
  if (!parsedBlock.interaction) throw new Error('交互协议缺少 interaction')
  parsedBlock.interaction.submittedData = payload.data
  for (const field of parsedBlock.interaction.fields ?? []) {
    if (field.name && payload.data[field.name] !== undefined) field.defaultValue = payload.data[field.name]
  }
  const updatedCode = JSON.stringify(parsedBlock)
  try {
    const wrapper = JSON.parse(raw) as { content?: unknown }
    if (wrapper && typeof wrapper.content === 'string' && wrapper.content.includes(payload.code)) {
      wrapper.content = wrapper.content.replace(payload.code, updatedCode)
      return JSON.stringify(wrapper)
    }
  } catch {
    // 非 JSON 包装消息，下面直接替换代码块内容。
  }
  if (!raw.includes(payload.code)) throw new Error('当前消息中未找到交互协议块')
  return raw.replace(payload.code, updatedCode)
}

function flattenFileNodes(nodes: { name: string; path: string; directory: boolean; fullName?: string; children?: unknown[] }[]): MentionResourceItem[] {
  return nodes.flatMap((node) => {
    if (node.directory) return flattenFileNodes((node.children ?? []) as typeof nodes)
    return [{ kind: 'workspace-file' as const, content: node.path, name: node.fullName || node.name, description: node.path }]
  })
}

export function ChatPage() {
  const store = useChatStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [input, setInput] = useState('')
  const [memoryActive, setMemoryActive] = useState(true)
  const [planActive, setPlanActive] = useState(true)
  const [toolProcessActive, setToolProcessActive] = useState(true)
  const [attachments, setAttachments] = useState<UploadItem[]>([])
  const [previewSource, setPreviewSource] = useState<FilePreviewSource | null>(null)
  const [agentPickerOpen, setAgentPickerOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const seededAgentRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const mentionRef = useRef<MentionDropdownHandle | null>(null)

  // @mention：工作空间文件、Agent 工具、Agent 技能三类真实数据源（与 Vue ChatInputEditor 一致）。
  const mentionFilesQuery = useQuery({
    queryKey: ['workspace-files', 'mention', store.activeSessionId],
    queryFn: async () => (await listFiles(store.activeSessionId!)).data.data ?? [],
    enabled: Boolean(store.activeSessionId),
  })
  const mentionToolsQuery = useQuery({
    queryKey: ['agent', store.activeAgentId, 'enabled-tools'],
    queryFn: async () => (await enabledToolsOfAgent(store.activeAgentId!)).data.data ?? [],
    enabled: Boolean(store.activeAgentId),
  })
  const mentionSkillsQuery = useQuery({
    queryKey: ['agent', store.activeAgentId, 'enabled-skills'],
    queryFn: async () => (await enabledSkillsOfAgent(store.activeAgentId!)).data.data ?? [],
    enabled: Boolean(store.activeAgentId),
  })
  const mentionItems = useMemo<MentionResourceItem[]>(() => [
    ...flattenFileNodes(mentionFilesQuery.data ?? []),
    ...(mentionToolsQuery.data ?? []).map((tool) => ({ kind: 'agent-tool' as const, content: tool.toolId, name: tool.name, description: tool.description })),
    ...(mentionSkillsQuery.data && mentionSkillsQuery.data.length
      ? mentionSkillsQuery.data.map((skill) => ({ kind: 'agent-skill' as const, content: skill.name, name: skill.alias || skill.name, description: skill.description }))
      : BUILTIN_AGENT_SKILLS),
  ], [mentionFilesQuery.data, mentionToolsQuery.data, mentionSkillsQuery.data])
  const [mention, setMention] = useState<{ query: string; from: number } | null>(null)

  function handleInputChange(value: string, composing: boolean) {
    setInput(value)
    if (composing) { setMention(null); return }
    const cursor = inputRef.current?.selectionStart ?? value.length
    const query = findMentionQuery(value.slice(0, cursor))
    if (query === null) { setMention(null); return }
    setMention({ query, from: cursor - 1 - query.length })
  }

  function insertMention(item: MentionResourceItem) {
    if (!mention) return
    const tag = buildTag(item.kind, item.content)
    const cursor = inputRef.current?.selectionStart ?? input.length
    // @ 连同查询词整体替换为协议标签文本（与 Vue insertResourceTag 的截断范围一致）。
    const next = `${input.slice(0, mention.from)}${tag}${input.slice(cursor)}`
    const position = mention.from + tag.length
    setInput(next)
    setMention(null)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(position, position)
    })
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mention && mentionRef.current?.handleKeydown(event)) {
      event.preventDefault()
      return
    }
    const { selectionStart, selectionEnd } = event.currentTarget
    if (event.key === 'Backspace' && selectionStart === selectionEnd) {
      // 标签整块删除：光标前是完整提及标签时一次移除，避免拆坏协议文本。
      const tag = matchTagBeforeCursor(input.slice(0, selectionStart))
      if (tag) {
        event.preventDefault()
        const position = selectionStart - tag.length
        setInput(input.slice(0, position) + input.slice(selectionEnd))
        requestAnimationFrame(() => inputRef.current?.setSelectionRange(position, position))
      }
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  const agentsQuery = useQuery({
    queryKey: ['list', 'agent', 'chat-select'],
    queryFn: async () => (await pageAgents({ page: 1, size: 100, enabled: true })).data.data.records,
  })
  const agents = agentsQuery.data ?? []
  const activeSession = store.sessions.find((session) => String(session.id) === store.activeSessionId)
  const activeAgent = agents.find((agent) => String(agent.id) === store.activeAgentId)
  const allowedTypesQuery = useQuery({
    queryKey: ['agent', store.activeAgentId, 'allowed-file-types'],
    queryFn: async () => (await getAgentAllowedFileTypes(store.activeAgentId!)).data.data ?? [],
    enabled: Boolean(store.activeAgentId),
  })
  const allowedTypes = allowedTypesQuery.data ?? []

  useEffect(() => { void store.loadSessions() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const requestedAgentId = searchParams.get('agentId')
    if (!requestedAgentId || agentsQuery.isLoading || seededAgentRef.current === requestedAgentId) return
    seededAgentRef.current = requestedAgentId
    if (!agents.some((agent) => String(agent.id) === requestedAgentId)) {
      toast.error('未找到要对话的智能体，或它已被停用')
      setSearchParams({}, { replace: true })
      return
    }
    void store.newSession(requestedAgentId).then((session) => {
      if (session) toast.success('已创建新会话')
    }).finally(() => setSearchParams({}, { replace: true }))
  }, [agents, agentsQuery.isLoading, searchParams, setSearchParams, store])
  useEffect(() => {
    setMemoryActive(activeAgent?.enableMemory ?? false)
    setPlanActive(activeAgent?.enablePlanning ?? false)
    setToolProcessActive(activeAgent?.showToolProcess ?? false)
    setAttachments([])
  }, [activeAgent?.id])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [store.liveMessages.length, store.history.length, store.reasoning, store.toolCalls, store.subAgentRuns])

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    for (const file of Array.from(files)) {
      const extension = extensionOf(file.name)
      if (file.size > MAX_ATTACHMENT_SIZE) {
        toast.error(`${file.name} 超过后端单文件上限 30MB`)
        continue
      }
      if (allowedTypes.length && !allowedTypes.some((item) => item.toLowerCase() === extension)) {
        toast.error(`${file.name} 的类型不受当前智能体支持`)
        continue
      }
      const temporaryId = `upload-${crypto.randomUUID()}`
      setAttachments((current) => [...current, {
        id: temporaryId,
        name: file.name,
        extension,
        size: formatBytes(file.size),
        uploading: true,
        progress: 0,
      }])
      try {
        const response = await uploadAttachment(file, (progress) => {
          setAttachments((current) => current.map((item) => item.id === temporaryId ? { ...item, progress } : item))
        })
        const id = response.data.data
        if (!id) throw new Error('上传接口未返回附件 ID')
        if (PARSED_DOCUMENT_TYPES.has(extension)) {
          const parsed = await parseAttachmentText(id)
          if (!parsed.data.data) {
            await deleteAttachments([id]).catch(() => undefined)
            throw new Error('文档文本提取失败')
          }
        }
        setAttachments((current) => current.map((item) => item.id === temporaryId ? { ...item, id, uploading: false, progress: 100 } : item))
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '上传失败'
        setAttachments((current) => current.map((item) => item.id === temporaryId ? { ...item, uploading: false, error: message } : item))
        toast.error(`${file.name}：${message}`)
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function removeAttachment(item: UploadItem) {
    if (!item.id.startsWith('upload-') && !item.error) {
      try { await deleteAttachments([item.id]) } catch { toast.error('服务端附件删除失败'); return }
    }
    setAttachments((current) => current.filter((candidate) => candidate.id !== item.id))
  }

  async function handleSend() {
    const text = input.trim()
    const readyFiles = attachments.filter((item) => !item.uploading && !item.error)
    if ((!text && !readyFiles.length) || store.running || attachments.some((item) => item.uploading)) return
    if (!activeSession || !activeAgent?.agentCode) {
      toast.error('请先选择智能体并创建会话')
      return
    }
    const finalText = messageWithFiles(readyFiles, text)
    const sent = await store.send(finalText, activeAgent.agentCode, {
      fileIds: readyFiles.map((item) => item.id),
      memoryActive,
      planActive,
      toolProcessActive,
    })
    if (sent) {
      setInput('')
      setMention(null)
      setAttachments([])
    }
  }

  const pinned = store.sessions.filter((session) => session.isPinned)
  const others = store.sessions.filter((session) => !session.isPinned)
  const canSend = Boolean(activeSession)
    && !store.running
    && !attachments.some((item) => item.uploading)
    && (Boolean(input.trim()) || attachments.some((item) => !item.error))
  const latestAssistantId = [...store.history].reverse().find((message) => message.role === 'assistant')?.id

  async function handleInteraction(rawContent: unknown, payload: MarkdownInteractionPayload) {
    if (store.running || !store.activeSessionId || !activeAgent?.agentCode || typeof rawContent !== 'string') return
    try {
      const updated = injectInteractionSubmission(rawContent, payload)
      await updateCurrentMessageContent(store.activeSessionId, updated)
      await store.send(payload.userText, activeAgent.agentCode, { memoryActive, planActive, toolProcessActive })
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '交互提交失败')
    }
  }

  function previewAttachment(file: UploadedFileItem) {
    setPreviewSource({ name: file.name, extension: file.extension || extensionOf(file.name), description: `附件 ${file.id}`, load: async () => (await downloadAttachment(file.id)).data })
  }

  function previewWorkspaceFile(path: string) {
    if (!store.activeSessionId) { toast.error('请先选择会话'); return }
    const name = path.split('/').filter(Boolean).at(-1) || path
    const sessionId = store.activeSessionId
    setPreviewSource({ name, extension: extensionOf(name), description: path, load: async () => (await downloadFile(sessionId, path)).data as Blob })
  }

  return (
    <div className="grid h-[100dvh] grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex h-full flex-col border-r border-sidebar-border bg-sidebar">
        <div className="p-3"><Button className="w-full" onClick={() => setAgentPickerOpen(true)}><Plus size={14} /> 新会话</Button></div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-auto px-2 pb-3">
          {store.sessionsLoading ? <PageLoading label="会话加载中…" /> : null}
          {[...pinned, ...others].map((session) => <SessionItem key={String(session.id)} session={session} active={String(session.id) === store.activeSessionId} />)}
          {!store.sessionsLoading && store.sessions.length === 0 ? <p className="px-2 py-6 text-center text-xs text-muted-foreground">暂无会话，点击“新会话”开始。</p> : null}
        </div>
      </aside>

      <main className="flex h-full min-h-0 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{activeSession?.title || '选择会话'}</div>
            <div className="text-xs text-muted-foreground">{activeAgent ? `${activeAgent.name} · ${activeAgent.agentCode}` : '未选择智能体'}</div>
          </div>
          {store.contextUsage ? <ContextUsageIndicator usage={store.contextUsage} compression={store.compressionStatus} /> : null}
          {store.running ? <Badge variant="outline" className="ml-2 gap-1"><CircleNotch size={12} className="animate-spin" /> {store.runState === 'STOPPING' ? '停止中…' : store.reconnecting ? '重连回放中…' : '运行中'}</Badge> : null}
        </header>

        {store.error ? <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"><Warning size={14} /> {store.error}<button className="ml-auto" onClick={store.clearError} aria-label="关闭错误提示"><X size={14} /></button></div> : null}

        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
          {!activeSession ? <EmptyState title="开始新的对话" description="从左侧选择会话，或点击“新会话”选择一个智能体。" /> : (
            <>
              {store.history.map((message) => message.role === 'subagent' && message.subAgentRun
                ? <SubAgentCard key={String(message.id)} run={message.subAgentRun} />
                : <MessageBubble key={String(message.id)} role={message.role} content={message.content} interactionDisabled={store.running || message.id !== latestAssistantId} onInteraction={(payload) => void handleInteraction(message.content, payload)} onAttachmentPreview={previewAttachment} onWorkspaceFilePreview={previewWorkspaceFile} />)}
              {store.reasoning.map((item) => <ReasoningCard key={item.id} content={item.content} complete={item.complete} />)}
              {toolProcessActive && store.toolCalls.length ? <ToolTimeline tools={store.toolCalls} /> : null}
              {store.subAgentRuns.map((run) => <SubAgentCard key={run.invocationId} run={run} />)}
              {store.currentPlan ? <PlanCard plan={store.currentPlan} finished={store.planFinished} /> : null}
              {store.activityMessages.map((message) => <MessageBubble key={message.id} role="activity" content={message.content ?? ''} />)}
              {store.liveMessages.map((message) => <LiveMessage key={message.id} message={message} />)}
              {store.pendingTools.length ? <ConfirmationCard memoryActive={memoryActive} setMemoryActive={setMemoryActive} /> : null}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        <div className="border-t border-border p-4">
          {attachments.length ? <div className="mb-2 flex gap-2 overflow-x-auto pb-1">{attachments.map((item) => <AttachmentChip key={item.id} item={item} onPreview={() => previewAttachment(item)} onRemove={() => void removeAttachment(item)} />)}</div> : null}
          <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {activeAgent?.enableMemory ? <Toggle label="记忆" checked={memoryActive} onCheckedChange={setMemoryActive} /> : null}
            {activeAgent?.enablePlanning ? <Toggle label="计划" checked={planActive} onCheckedChange={setPlanActive} /> : null}
            {activeAgent?.showToolProcess ? <Toggle label="工具过程" checked={toolProcessActive} onCheckedChange={setToolProcessActive} /> : null}
            {allowedTypes.length ? <span>附件类型：{allowedTypes.join('、')}</span> : null}
          </div>
          <div className="flex items-end gap-2">
            <input ref={fileInputRef} type="file" multiple className="hidden" accept={allowedTypes.length ? allowedTypes.map((item) => `.${item}`).join(',') : undefined} onChange={(event) => void handleFiles(event.target.files)} />
            <Button variant="outline" size="icon" title="上传附件（单文件不超过 30MB）" disabled={!activeSession || store.running} onClick={() => fileInputRef.current?.click()}><Paperclip size={16} /></Button>
          <div className="relative flex-1">
            {mention && activeSession && !store.running ? <MentionDropdown ref={mentionRef} items={mentionItems} query={mention.query} onSelect={insertMention} onClose={() => setMention(null)} /> : null}
            <Textarea
              ref={inputRef}
              className="min-h-11"
              placeholder={activeSession ? '输入消息，Enter 发送，Shift+Enter 换行，@ 提及文件/工具/技能' : '先创建会话'}
              value={input}
              disabled={!activeSession || store.running}
              onChange={(event) => handleInputChange(event.target.value, event.nativeEvent instanceof InputEvent && event.nativeEvent.isComposing)}
              onKeyDown={handleInputKeyDown}
            />
          </div>
            {store.running ? <Button variant="destructive" onClick={() => void store.stop()} disabled={store.runState === 'STOPPING'}><Square size={14} /> {store.runState === 'STOPPING' ? '停止中…' : '停止'}</Button> : <Button onClick={() => void handleSend()} disabled={!canSend}><ArrowUp size={14} /> 发送</Button>}
          </div>
        </div>
      </main>

      {agentPickerOpen ? <AgentPicker agents={agents.map((agent) => ({ id: String(agent.id), name: agent.name, code: agent.agentCode }))} loading={agentsQuery.isLoading} onClose={() => setAgentPickerOpen(false)} onPick={async (agent) => { setAgentPickerOpen(false); const created = await store.newSession(agent.id); if (!created) toast.error('创建会话失败') }} /> : null}
      <FilePreviewDialog source={previewSource} onClose={() => setPreviewSource(null)} />
    </div>
  )
}

function Toggle({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-1.5"><Switch checked={checked} onCheckedChange={onCheckedChange} /> {label}</label>
}

function AttachmentChip({ item, onPreview, onRemove }: { item: UploadItem; onPreview: () => void; onRemove: () => void }) {
  return (
    <div className={`flex min-w-44 max-w-64 items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${item.error ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/40'}`}>
      {item.uploading ? <CircleNotch size={15} className="shrink-0 animate-spin" /> : <File size={15} className="shrink-0" />}
      <button type="button" disabled={item.uploading || Boolean(item.error)} className="min-w-0 flex-1 text-left disabled:cursor-default" onClick={onPreview}><div className="truncate font-medium">{item.name}</div><div className="truncate text-muted-foreground">{item.error ?? (item.uploading ? `${item.progress ?? 0}%` : item.size)}</div></button>
      <button onClick={onRemove} aria-label={`移除 ${item.name}`}><X size={13} /></button>
    </div>
  )
}

function ConfirmationCard({ memoryActive, setMemoryActive }: { memoryActive: boolean; setMemoryActive: (value: boolean) => void }) {
  const store = useChatStore()
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="mb-3 text-sm font-medium">工具执行确认（全部决策后续跑）</div>
      <div className="space-y-2">{store.pendingTools.map((tool) => {
        const decided = store.pendingDecisions[tool.toolUseId]
        return <div key={tool.toolUseId} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"><span className="font-mono text-xs">{tool.name}</span><span className="truncate text-xs text-muted-foreground">{JSON.stringify(tool.input ?? {}).slice(0, 120)}</span><div className="ml-auto flex gap-1"><Button size="sm" variant={decided === true ? 'default' : 'outline'} disabled={decided !== undefined} onClick={() => void store.decide(tool.toolUseId, true, memoryActive)}><Check size={13} /> 允许</Button><Button size="sm" variant={decided === false ? 'destructive' : 'outline'} disabled={decided !== undefined} onClick={() => void store.decide(tool.toolUseId, false, memoryActive)}>拒绝</Button></div></div>
      })}</div>
      <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={memoryActive} onCheckedChange={setMemoryActive} /> 本次决策计入长期记忆</label>
    </div>
  )
}

function ReasoningCard({ content, complete }: { content: string; complete: boolean }) {
  return <details open={!complete} className="max-w-[85%] rounded-xl border border-dashed border-violet-400/40 bg-violet-500/5 px-3 py-2"><summary className="cursor-pointer text-xs font-medium text-violet-700 dark:text-violet-300">{complete ? '推理过程' : '正在推理…'}</summary><div className="mt-2 text-sm text-muted-foreground"><MarkdownLite content={content || '…'} /></div></details>
}

function ToolTimeline({ tools }: { tools: ToolCallView[] }) {
  return <div className="max-w-[88%] rounded-xl border border-border bg-card p-3"><div className="mb-2 text-xs font-semibold text-muted-foreground">工具调用</div><div className="space-y-2">{tools.map((tool) => <details key={tool.id} className="rounded-lg bg-muted/55 px-3 py-2 text-xs"><summary className="flex cursor-pointer list-none items-center gap-2"><span className={`size-2 rounded-full ${tool.status === 'SUCCESS' ? 'bg-emerald-500' : tool.status === 'FAILED' ? 'bg-destructive' : tool.status === 'WAITING_CONFIRMATION' ? 'bg-amber-500' : 'animate-pulse bg-blue-500'}`} /><span className="font-mono font-medium">{tool.name}</span><span className="ml-auto text-muted-foreground">{tool.status === 'WAITING_CONFIRMATION' ? '等待确认' : tool.status === 'RUNNING' ? '执行中' : tool.elapsed !== undefined ? `${tool.elapsed} ms` : tool.status}</span></summary>{tool.args ? <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">参数：{tool.args}</pre> : null}{tool.result ? <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-[11px]">结果：{tool.result}</pre> : null}{tool.error ? <p className="mt-2 text-destructive">{tool.error}</p> : null}</details>)}</div></div>
}

function SubAgentCard({ run }: { run: SubAgentRunVO }) {
  const terminal = ['SUCCESS', 'BLOCKED', 'FAILED', 'CANCELLED'].includes(run.status)
  return <details open={!terminal} className="max-w-[88%] rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3"><summary className="flex cursor-pointer list-none items-center gap-2"><Robot size={17} /><span className="font-medium">{run.agentTitle || run.agentCode || '子 Agent'}</span><Badge variant="outline" className="ml-auto">{run.status}</Badge></summary>{run.task ? <p className="mt-2 text-sm">任务：{run.task}</p> : null}{run.summary ? <div className="mt-2 text-sm"><MarkdownLite content={run.summary} /></div> : null}<div className="mt-2 text-xs text-muted-foreground">{run.events.length} 个事件{run.subagentSessionId ? ` · 会话 ${run.subagentSessionId}` : ''}</div></details>
}

function PlanCard({ plan, finished }: { plan: PlanInfo; finished: boolean }) {
  return <div className="max-w-[88%] rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3"><div className="flex items-center gap-2"><ListChecks size={17} /><span className="font-medium">{plan.name}</span>{finished ? <Badge variant="outline" className="ml-auto">已结束</Badge> : null}</div>{plan.description ? <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p> : null}<div className="mt-3 space-y-1.5">{plan.subtasks.map((task, index) => <div key={`${task.name}-${index}`} className="flex gap-2 rounded-lg bg-background/70 px-2.5 py-2 text-sm"><span>{task.state === 'done' ? '✓' : task.state === 'in_progress' ? '◉' : task.state === 'removed' ? '−' : task.state === 'abandoned' ? '×' : '○'}</span><div><div className={task.state === 'removed' ? 'line-through opacity-60' : ''}>{task.name}</div>{task.outcome ? <div className="text-xs text-muted-foreground">{task.outcome}</div> : null}</div></div>)}</div></div>
}

function SessionItem({ session, active }: { session: ChatSessionVO; active: boolean }) {
  const { openSession, removeSession, togglePin, renameSession } = useChatStore()
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(session.title ?? '')
  return <div className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${active ? 'bg-sidebar-accent font-medium' : 'hover:bg-sidebar-accent/60'}`} onClick={() => void openSession(session)}>{session.isPinned ? <PushPin size={12} className="shrink-0 text-primary" /> : null}{renaming ? <Input autoFocus className="h-7 text-xs" value={title} onClick={(event) => event.stopPropagation()} onChange={(event) => setTitle(event.target.value)} onBlur={() => { setRenaming(false); if (title.trim()) void renameSession(String(session.id), title.trim()) }} onKeyDown={(event) => { if (event.key === 'Enter') { setRenaming(false); if (title.trim()) void renameSession(String(session.id), title.trim()) } }} /> : <span className="min-w-0 flex-1 truncate">{session.title || `会话 ${String(session.id).slice(-6)}`}</span>}<DropdownMenu><DropdownMenuTrigger asChild><button className="opacity-0 group-hover:opacity-100" aria-label="会话操作" onClick={(event) => event.stopPropagation()}>⋯</button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { setTitle(session.title ?? ''); setRenaming(true) }}><PencilSimple size={14} /> 重命名</DropdownMenuItem><DropdownMenuItem onSelect={() => void togglePin(session)}><PushPin size={14} /> {session.isPinned ? '取消置顶' : '置顶'}</DropdownMenuItem><DropdownMenuItem className="text-destructive" onSelect={() => void removeSession(String(session.id))}><Trash size={14} /> 删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
}

function AgentPicker({ agents, loading, onClose, onPick }: { agents: Array<{ id: string; name: string; code: string }>; loading: boolean; onClose: () => void; onPick: (agent: { id: string; name: string; code: string }) => Promise<void> }) {
  const [keyword, setKeyword] = useState('')
  const filtered = useMemo(() => agents.filter((agent) => agent.name.includes(keyword) || agent.code.includes(keyword)), [agents, keyword])
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onClick={onClose}><div className="w-full max-w-md rounded-xl border border-border bg-background p-4 shadow-dialog" onClick={(event) => event.stopPropagation()}><Label>选择智能体开始会话</Label><Input className="mt-2" autoFocus placeholder="搜索…" value={keyword} onChange={(event) => setKeyword(event.target.value)} /><div className="mt-2 max-h-72 space-y-0.5 overflow-auto">{loading ? <PageLoading /> : null}{filtered.map((agent) => <button key={agent.id} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => void onPick(agent)}><div className="font-medium">{agent.name}</div><div className="font-mono text-xs text-muted-foreground">{agent.code}</div></button>)}{!loading && filtered.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">没有匹配的智能体</p> : null}</div></div></div>
}

function MessageBubble({ role, content, interactionDisabled = true, onInteraction, onAttachmentPreview, onWorkspaceFilePreview }: { role: string; content: string | unknown; interactionDisabled?: boolean; onInteraction?: (payload: MarkdownInteractionPayload) => void; onAttachmentPreview?: (file: UploadedFileItem) => void; onWorkspaceFilePreview?: (path: string) => void }) {
  const parsed = parseMessageContent(content)
  if (role === 'thinking') return <ReasoningCard content={parsed.text} complete />
  if (role === 'user') return <div className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">{parsed.files.length ? <div className="mb-2 flex flex-wrap gap-1">{parsed.files.map((file) => <button type="button" key={file.id} onClick={() => onAttachmentPreview?.(file)} className="rounded bg-primary-foreground/15 px-2 py-1 text-xs hover:bg-primary-foreground/25">{file.name}</button>)}</div> : null}{parsed.text ? <TaggedText content={parsed.text} onWorkspaceFileClick={onWorkspaceFilePreview} /> : null}</div></div>
  if (role === 'tool') return <details className="max-w-[85%] rounded-xl border border-border bg-card px-3 py-2 text-sm"><summary className="cursor-pointer text-xs font-medium text-muted-foreground">工具结果</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs">{parsed.text}</pre></details>
  if (role === 'activity') return <details className="max-w-[85%] rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2 text-sm"><summary className="cursor-pointer text-xs font-medium text-muted-foreground">活动卡片</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs">{parsed.text}</pre></details>
  if (role === 'system') return null
  return <div className="flex"><div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2.5"><MarkdownLite content={parsed.text} disabled={interactionDisabled} onInteraction={onInteraction} /></div></div>
}

function LiveMessage({ message }: { message: Message }) {
  if (message.role === 'user' || message.role === 'tool' || message.role === 'activity') return null
  if (message.role === 'assistant') return <MessageBubble role="assistant" content={message.content ?? ''} />
  return null
}

export function chatPageErrorFallback(cause: unknown) {
  return <ErrorState error={cause} onRetry={() => window.location.reload()} />
}
