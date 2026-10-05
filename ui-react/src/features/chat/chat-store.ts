import { create } from 'zustand'
import { AgentClient, createAgentClient, getAgentRunURL, getPending, getReconnectURL, getResumeURL, getRunStatus, stopRun } from '@/api/agui'
import type { Message } from '@/types'
import * as sessionApi from '@/api/chatSession'
import type { ChatMessageVO, ChatSessionCreateDTO, ChatSessionVO } from '@/types'
import { readableError } from '@/lib/utils'

export interface PendingTool {
  toolUseId: string
  name: string
  input?: Record<string, unknown>
}

interface ChatState {
  sessions: ChatSessionVO[]
  sessionsLoading: boolean
  activeSessionId: string | null
  activeAgentId: string | null
  history: ChatMessageVO[]
  liveMessages: Message[]
  running: boolean
  runState: 'RUNNING' | 'STOPPING' | 'COMPLETED' | null
  pendingTools: PendingTool[]
  reconnecting: boolean
  error: string | null
  client: AgentClient | null

  loadSessions: () => Promise<void>
  openSession: (session: ChatSessionVO) => Promise<void>
  newSession: (agentId: string) => Promise<ChatSessionVO | null>
  removeSession: (id: string) => Promise<void>
  togglePin: (session: ChatSessionVO) => Promise<void>
  renameSession: (id: string, title: string) => Promise<void>
  send: (text: string, agentCode: string) => Promise<void>
  stop: () => Promise<void>
  recover: () => Promise<void>
  decide: (decisions: Array<{ toolUseId: string; name: string; approved: boolean }>, memoryActive: boolean) => Promise<void>
  clearError: () => void
}

function threadIdOf(session: ChatSessionVO): string {
  return String(session.id)
}

export const useChatStore = create<ChatState>((set, get) => {
  /** 将 AgentClient 的可变消息数组转为渲染快照 */
  function snapshotLive(client: AgentClient) {
    set({ liveMessages: [...client.messages] })
  }

  async function reloadHistory(sessionId: string) {
    try {
      const response = await sessionApi.getCurrentMessages(sessionId)
      set({ history: response.data.data ?? [] })
    } catch (cause) {
      set({ error: readableError(cause, '历史消息加载失败') })
    }
  }

  function buildClient(sessionId: string, agentCode: string): AgentClient {
    const client = createAgentClient({
      url: getAgentRunURL(),
      handlers: {
        onEvent: () => snapshotLive(get().client as AgentClient),
        onRunFinished: () => {
          set({ running: false, runState: 'COMPLETED' })
          void reloadHistory(sessionId)
          snapshotLive(get().client as AgentClient)
        },
        onRunError: (event) => {
          set({ running: false, runState: 'COMPLETED', error: event.message || '运行失败' })
          void reloadHistory(sessionId)
        },
        onCustom: (event) => {
          // HITL 确认请求：后端以 CUSTOM 事件携带 pendingTools
          const payload = event.value as { pendingTools?: PendingTool[]; name?: string } | undefined
          if (payload?.pendingTools?.length) set({ pendingTools: payload.pendingTools })
        },
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
    liveMessages: [],
    running: false,
    runState: null,
    pendingTools: [],
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
      const sessionId = String(session.id)
      set({ activeSessionId: sessionId, activeAgentId: String(session.agentId), history: [], liveMessages: [], pendingTools: [], error: null, client: null, running: false })
      await reloadHistory(sessionId)
      // 恢复：检查后端运行状态，必要时回放或重建 HITL
      try {
        const status = await getRunStatus(threadIdOf(session))
        if (status.state === 'RUNNING' || status.state === 'STOPPING') {
          const client = createAgentClient({})
          set({ client, running: true, runState: status.state, reconnecting: true })
          client.handlers.onRunFinished = () => {
            set({ running: false, runState: 'COMPLETED', reconnecting: false })
            void reloadHistory(sessionId)
            snapshotLive(get().client as AgentClient)
          }
          client.handlers.onRunError = (event) => {
            set({ running: false, runState: 'COMPLETED', reconnecting: false, error: event.message || '连接中断' })
            void reloadHistory(sessionId)
          }
          client.handlers.onCustom = (event) => {
            const payload = event.value as { pendingTools?: PendingTool[] } | undefined
            if (payload?.pendingTools?.length) set({ pendingTools: payload.pendingTools })
          }
          client.handlers.onEvent = () => snapshotLive(get().client as AgentClient)
          void client.reconnect(getReconnectURL(threadIdOf(session))).finally(() => set({ reconnecting: false }))
        } else {
          const pending = await getPending(threadIdOf(session))
          if (pending.length) set({ pendingTools: pending })
        }
      } catch {
        /* 状态查询失败不阻塞浏览 */
      }
    },

    async newSession(agentId) {
      try {
        const response = await sessionApi.createSession({ agentId } as ChatSessionCreateDTO)
        const created = response.data.data
        set((state) => ({ sessions: [created, ...state.sessions], activeSessionId: String(created.id), activeAgentId: String(agentId), history: [], liveMessages: [], pendingTools: [], error: null }))
        return created
      } catch (cause) {
        set({ error: readableError(cause, '创建会话失败') })
        return null
      }
    },

    async removeSession(id) {
      try {
        await sessionApi.deleteSession(id)
        set((state) => ({
          sessions: state.sessions.filter((item) => String(item.id) !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
          history: state.activeSessionId === id ? [] : state.history,
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
        set((state) => ({ sessions: state.sessions.map((item) => (String(item.id) === id ? { ...item, title } : item)) }))
      } catch (cause) {
        set({ error: readableError(cause, '重命名失败') })
      }
    },

    async send(text, agentCode) {
      const state = get()
      const sessionId = state.activeSessionId
      if (!sessionId || state.running) return
      set({ error: null, running: true, runState: 'RUNNING', liveMessages: [], pendingTools: [] })
      const client = buildClient(sessionId, agentCode)
      set({ client })
      client.addUserMessage(text)
      snapshotLive(client)
      try {
        await client.run({
          threadId: sessionId,
          forwardedProps: {
            agentId: state.activeAgentId,
            agentCode,
          },
        })
      } catch (cause) {
        set({ running: false, runState: 'COMPLETED', error: readableError(cause, '连接中断') })
        await reloadHistory(sessionId)
      }
    },

    async stop() {
      const sessionId = get().activeSessionId
      if (!sessionId) return
      try {
        await stopRun(sessionId)
        get().client?.abort()
        set({ runState: 'STOPPING' })
        // 轮询直到终态，最多 30 秒
        for (let attempt = 0; attempt < 30; attempt++) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000))
          try {
            const status = await getRunStatus(sessionId)
            if (!status.running) {
              set({ running: false, runState: 'COMPLETED' })
              await reloadHistory(sessionId)
              return
            }
          } catch {
            break
          }
        }
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

    async decide(decisions, memoryActive) {
      const sessionId = get().activeSessionId
      if (!sessionId) return
      set({ pendingTools: [], running: true, runState: 'RUNNING' })
      const existing = get().client ?? createAgentClient({})
      if (!get().client) set({ client: existing })
      try {
        await existing.resume(getResumeURL(sessionId), { decisions, memoryActive })
      } catch (cause) {
        set({ error: readableError(cause, '续跑失败') })
      } finally {
        set({ running: false, runState: 'COMPLETED' })
        await reloadHistory(sessionId)
      }
    },

    clearError: () => set({ error: null }),
  }
})
