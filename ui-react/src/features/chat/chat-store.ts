import { create } from 'zustand'
import {
  AgentClient,
  createAgentClient,
  getAgentRunURL,
  getPending,
  getReconnectURL,
  getResumeURL,
  getRunStatus,
  stopRun,
} from '@/api/agui'
import type {
  ChatMessageVO,
  ChatSessionCreateDTO,
  ChatSessionVO,
  ContextCompressionEvent,
  ContextUsageEvent,
  Message,
  PlanInfo,
  SubAgentRunVO,
} from '@/types'
import * as sessionApi from '@/api/chatSession'
import { readableError } from '@/lib/utils'
import { sessionStorageAdapter } from '@/lib/storage'
import { PlanTracker, reduceSubAgentEvent, type ReasoningView, type ToolCallView } from './chat-runtime'

export interface PendingTool {
  toolUseId: string
  name: string
  input?: Record<string, unknown>
}

export interface SendOptions {
  fileIds?: string[]
  memoryActive?: boolean
  planActive?: boolean
  toolProcessActive?: boolean
}

interface ChatState {
  sessions: ChatSessionVO[]
  sessionsLoading: boolean
  activeSessionId: string | null
  activeAgentId: string | null
  history: ChatMessageVO[]
  liveMessages: Message[]
  activityMessages: Message[]
  reasoning: ReasoningView[]
  toolCalls: ToolCallView[]
  subAgentRuns: SubAgentRunVO[]
  currentPlan: PlanInfo | null
  planFinished: boolean
  contextUsage: ContextUsageEvent['value'] | null
  compressionStatus: ContextCompressionEvent['value']['status'] | null
  running: boolean
  runState: 'RUNNING' | 'STOPPING' | 'COMPLETED' | null
  pendingTools: PendingTool[]
  pendingDecisions: Record<string, boolean>
  reconnecting: boolean
  error: string | null
  client: AgentClient | null

  loadSessions: () => Promise<void>
  openSession: (session: ChatSessionVO) => Promise<void>
  newSession: (agentId: string) => Promise<ChatSessionVO | null>
  removeSession: (id: string) => Promise<void>
  togglePin: (session: ChatSessionVO) => Promise<void>
  renameSession: (id: string, title: string) => Promise<void>
  send: (text: string, agentCode: string, options?: SendOptions) => Promise<boolean>
  stop: () => Promise<void>
  recover: () => Promise<void>
  decide: (toolUseId: string, approved: boolean, memoryActive: boolean) => Promise<void>
  clearError: () => void
}

const EMPTY_RUNTIME = {
  liveMessages: [] as Message[],
  activityMessages: [] as Message[],
  reasoning: [] as ReasoningView[],
  toolCalls: [] as ToolCallView[],
  subAgentRuns: [] as SubAgentRunVO[],
  currentPlan: null as PlanInfo | null,
  planFinished: false,
  contextUsage: null as ContextUsageEvent['value'] | null,
  compressionStatus: null as ContextCompressionEvent['value']['status'] | null,
  pendingTools: [] as PendingTool[],
  pendingDecisions: {} as Record<string, boolean>,
}

function threadIdOf(session: ChatSessionVO): string {
  return String(session.id)
}

export const useChatStore = create<ChatState>((set, get) => {
  function snapshotClient(client: AgentClient) {
    set({ liveMessages: [...client.messages], activityMessages: Object.values(client.activityMessages) })
  }

  async function reloadHistory(sessionId: string, clearLive = false) {
    try {
      const response = await sessionApi.getCurrentMessages(sessionId)
      set({ history: response.data.data ?? [], ...(clearLive ? { liveMessages: [] } : {}) })
    } catch (cause) {
      set({ error: readableError(cause, '历史消息加载失败') })
    }
  }

  async function finishRun(sessionId: string, error?: string) {
    set({
      running: false,
      runState: 'COMPLETED',
      reconnecting: false,
      reasoning: [],
      toolCalls: [],
      subAgentRuns: [],
      ...(error ? { error } : {}),
    })
    await reloadHistory(sessionId, true)
  }

  function buildClient(sessionId: string): AgentClient {
    const planTracker = new PlanTracker()
    let client: AgentClient
    client = createAgentClient({
      url: getAgentRunURL(),
      handlers: {
        onRunStarted: () => {
          planTracker.reset()
          set({ ...EMPTY_RUNTIME, running: true, runState: 'RUNNING', error: null })
        },
        onTextMessageStart: () => snapshotClient(client),
        onTextMessageContent: () => snapshotClient(client),
        onTextMessageEnd: () => snapshotClient(client),
        onMessagesSnapshot: () => snapshotClient(client),
        onActivitySnapshot: () => snapshotClient(client),
        onActivityDelta: () => snapshotClient(client),
        onReasoningMessageStart: (event) => {
          set((state) => ({ reasoning: [...state.reasoning, { id: event.messageId, content: '', complete: false }] }))
        },
        onReasoningMessageContent: (event, content) => {
          set((state) => ({ reasoning: state.reasoning.map((item) => item.id === event.messageId ? { ...item, content } : item) }))
        },
        onReasoningMessageEnd: (event, content) => {
          set((state) => ({ reasoning: state.reasoning.map((item) => item.id === event.messageId ? { ...item, content, complete: true } : item) }))
        },
        onToolCallStart: (event) => {
          planTracker.start(event.toolCallId, event.toolCallName)
          set((state) => ({ toolCalls: [...state.toolCalls, {
            id: event.toolCallId,
            name: event.toolCallName,
            args: '',
            status: 'RUNNING',
            startedAt: Date.now(),
          }] }))
        },
        onToolCallArgs: (event, fullArgs) => {
          planTracker.updateArgs(event.toolCallId, fullArgs)
          set((state) => ({ toolCalls: state.toolCalls.map((item) => item.id === event.toolCallId ? { ...item, args: fullArgs } : item) }))
        },
        onToolCallResult: (event) => {
          const plan = planTracker.finish(event.toolCallId)
          set((state) => ({
            currentPlan: plan ? { ...plan, subtasks: plan.subtasks.map((item) => ({ ...item })) } : state.currentPlan,
            planFinished: planTracker.finished,
            toolCalls: state.toolCalls.map((item) => item.id === event.toolCallId ? {
              ...item,
              result: event.content,
              status: 'SUCCESS',
              elapsed: Date.now() - item.startedAt,
            } : item),
          }))
          snapshotClient(client)
        },
        onCustom: (event) => {
          if (event.name === 'CONTEXT_USAGE') {
            set({ contextUsage: (event as ContextUsageEvent).value })
            return
          }
          if (event.name === 'CONTEXT_COMPRESSION') {
            const value = (event as ContextCompressionEvent).value
            set((state) => ({
              contextUsage: state.contextUsage ? { ...state.contextUsage, ...value, ratio: value.compressionPressure } : value as ContextUsageEvent['value'],
              compressionStatus: value.status,
            }))
            return
          }
          const reduced = reduceSubAgentEvent(get().subAgentRuns, event)
          if (reduced.accepted) {
            const trace = event.value as { eventType?: string; invocationId?: string }
            if (trace.eventType === 'STARTED' && trace.invocationId) {
              const plan = planTracker.finish(trace.invocationId)
              set((state) => ({
                subAgentRuns: reduced.runs,
                toolCalls: state.toolCalls.filter((item) => item.id !== trace.invocationId),
                currentPlan: plan ?? state.currentPlan,
              }))
            } else {
              set({ subAgentRuns: reduced.runs })
            }
            return
          }
          if (event.name === 'TOOL_CONFIRM_REQUIRED') {
            const value = event.value as { pending?: PendingTool[] }
            const pending = Array.isArray(value?.pending) ? value.pending : []
            set((state) => ({
              pendingTools: pending,
              pendingDecisions: {},
              toolCalls: state.toolCalls.map((item) => pending.some((tool) => tool.toolUseId === item.id)
                ? { ...item, status: 'WAITING_CONFIRMATION' }
                : item),
            }))
          }
        },
        onRunFinished: () => { void finishRun(sessionId) },
        onRunError: (event) => { void finishRun(sessionId, event.message || '运行失败') },
      },
    })
    return client
  }

  return {
    sessions: [],
    sessionsLoading: false,
    activeSessionId: null,
    activeAgentId: null,
    history: [],
    ...EMPTY_RUNTIME,
    running: false,
    runState: null,
    reconnecting: false,
    error: null,
    client: null,

    async loadSessions() {
      set({ sessionsLoading: true })
      try {
        const response = await sessionApi.pageSessions({ page: 1, size: 100 })
        set({ sessions: response.data.data.records })
      } catch (cause) {
        set({ error: readableError(cause, '会话列表加载失败') })
      } finally {
        set({ sessionsLoading: false })
      }
    },

    async openSession(session) {
      get().client?.abort()
      const sessionId = String(session.id)
      set({ activeSessionId: sessionId, activeAgentId: String(session.agentId), history: [], ...EMPTY_RUNTIME, error: null, client: null, running: false, runState: null })
      await reloadHistory(sessionId)
      try {
        const status = await getRunStatus(threadIdOf(session))
        if (status.state === 'RUNNING' || status.state === 'STOPPING') {
          const client = buildClient(sessionId)
          set({ client, running: true, runState: status.state, reconnecting: true })
          void client.reconnect(getReconnectURL(threadIdOf(session))).finally(() => set({ reconnecting: false }))
        } else {
          const pending = await getPending(threadIdOf(session))
          if (pending.length) set({ pendingTools: pending })
        }
      } catch {
        // 状态查询失败不阻塞历史消息浏览。
      }
    },

    async newSession(agentId) {
      try {
        const response = await sessionApi.createSession({ agentId } as ChatSessionCreateDTO)
        const created = response.data.data
        get().client?.abort()
        set((state) => ({
          sessions: [created, ...state.sessions],
          activeSessionId: String(created.id),
          activeAgentId: String(agentId),
          history: [],
          ...EMPTY_RUNTIME,
          error: null,
          client: null,
          running: false,
          runState: null,
        }))
        return created
      } catch (cause) {
        set({ error: readableError(cause, '创建会话失败') })
        return null
      }
    },

    async removeSession(id) {
      try {
        await sessionApi.deleteSession(id)
        if (get().activeSessionId === id) get().client?.abort()
        set((state) => ({
          sessions: state.sessions.filter((item) => String(item.id) !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
          activeAgentId: state.activeSessionId === id ? null : state.activeAgentId,
          history: state.activeSessionId === id ? [] : state.history,
          ...(state.activeSessionId === id ? EMPTY_RUNTIME : {}),
        }))
      } catch (cause) {
        set({ error: readableError(cause, '删除会话失败') })
      }
    },

    async togglePin(session) {
      try {
        if (session.isPinned) await sessionApi.unpinSession(String(session.id))
        else await sessionApi.pinSession(String(session.id))
        await get().loadSessions()
      } catch (cause) {
        set({ error: readableError(cause, '置顶操作失败') })
      }
    },

    async renameSession(id, title) {
      try {
        await sessionApi.updateSessionTitle(id, title)
        set((state) => ({ sessions: state.sessions.map((item) => String(item.id) === id ? { ...item, title } : item) }))
      } catch (cause) {
        set({ error: readableError(cause, '重命名失败') })
      }
    },

    async send(text, agentCode, options = {}) {
      const state = get()
      const sessionId = state.activeSessionId
      if (!sessionId || state.running) return false
      set({ error: null, running: true, runState: 'RUNNING', ...EMPTY_RUNTIME })
      try {
        const saved = await sessionApi.appendMessage(sessionId, { role: 'user', content: text })
        set((current) => ({ history: [...current.history, saved.data.data] }))
      } catch (cause) {
        set({ running: false, runState: 'COMPLETED', error: readableError(cause, '用户消息保存失败') })
        return false
      }

      const client = buildClient(sessionId)
      set({ client })
      client.addUserMessage(text)
      snapshotClient(client)
      await client.run({
        threadId: sessionId,
        forwardedProps: {
          agentId: state.activeAgentId,
          agentCode,
          fileIds: options.fileIds ?? [],
          memoryActive: options.memoryActive ?? false,
          planActive: options.planActive ?? false,
          toolProcessActive: options.toolProcessActive ?? false,
          userInfo: sessionStorageAdapter.getUser(),
        },
      })
      return true
    },

    async stop() {
      const sessionId = get().activeSessionId
      if (!sessionId || !get().running) return
      set({ runState: 'STOPPING' })
      try {
        await stopRun(sessionId)
        get().client?.abort()
        for (let attempt = 0; attempt < 30; attempt++) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000))
          try {
            const status = await getRunStatus(sessionId)
            if (!status.running) {
              await finishRun(sessionId)
              return
            }
          } catch {
            // 保留 STOPPING，继续下一次状态确认。
          }
        }
        set({ error: '停止请求已发送，但后端 30 秒内未确认终态。可点击恢复重新检查。' })
      } catch (cause) {
        set({ error: readableError(cause, '停止失败') })
      }
    },

    async recover() {
      const state = get()
      if (!state.activeSessionId) return
      const session = state.sessions.find((item) => String(item.id) === state.activeSessionId)
      if (session) await get().openSession(session)
    },

    async decide(toolUseId, approved, memoryActive) {
      const state = get()
      const sessionId = state.activeSessionId
      if (!sessionId || !state.pendingTools.some((item) => item.toolUseId === toolUseId)) return
      const decisionsById = { ...state.pendingDecisions, [toolUseId]: approved }
      set((current) => ({
        pendingDecisions: decisionsById,
        toolCalls: current.toolCalls.map((item) => item.id === toolUseId
          ? { ...item, status: approved ? 'RUNNING' : 'FAILED', error: approved ? undefined : '用户拒绝执行' }
          : item),
      }))
      if (!state.pendingTools.every((item) => decisionsById[item.toolUseId] !== undefined)) return

      const decisions = state.pendingTools.map((item) => ({ toolUseId: item.toolUseId, name: item.name, approved: decisionsById[item.toolUseId]! }))
      set({ pendingTools: [], pendingDecisions: {}, running: true, runState: 'RUNNING' })
      const client = state.client ?? buildClient(sessionId)
      if (!state.client) set({ client })
      await client.resume(getResumeURL(sessionId), { decisions, memoryActive })
    },

    clearError: () => set({ error: null }),
  }
})
