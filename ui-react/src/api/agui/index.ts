/**
 * AGUI SSE 模块：工厂与统一导出（与 Vue 版协议一致）
 */

import { getAgentRunURL, getSSEHeaders, getReconnectURL, getResumeURL, getPendingURL, getStatusURL, getStopURL, getActiveRunsURL, getRESTHeaders } from './request'
import { AgentClient } from './agent-client'
import type { EventHandlers, ToolHandler } from './agent-client'
import type { RunAgentInput } from '@/types'

export type { EventHandlers, ToolHandler, EventMiddleware } from './agent-client'
export { AgentClient } from './agent-client'
export { getAgentRunURL }

export interface CreateAgentClientOptions {
  url?: string
  headers?: Record<string, string>
  handlers?: EventHandlers
  toolHandlers?: Record<string, ToolHandler>
}

export function createAgentClient(options: CreateAgentClientOptions = {}): AgentClient {
  const url = options.url ?? getAgentRunURL()
  const headers = { ...getSSEHeaders(), ...options.headers }
  return new AgentClient(url, headers, options.handlers ?? {}, options.toolHandlers ?? {})
}

export type { RunAgentInput }
export { getReconnectURL, getResumeURL, getPendingURL, getStatusURL, getStopURL, getActiveRunsURL }

export interface AgentRunStatus {
  running: boolean
  state: 'RUNNING' | 'STOPPING' | 'COMPLETED'
}

/** 查询指定会话的完整运行生命周期状态。 */
export async function getRunStatus(threadId: string): Promise<AgentRunStatus> {
  const url = getStatusURL(threadId)
  const headers = getRESTHeaders(threadId)
  const resp = await fetch(url, { headers })
  if (resp.status === 401) {
    throw new Error('登录状态已失效')
  }
  if (!resp.ok) throw new Error(`Status check failed: ${resp.status}`)
  const data = (await resp.json()) as Partial<AgentRunStatus>
  return {
    running: data.running === true,
    state: data.state === 'STOPPING' || data.state === 'RUNNING' ? data.state : 'COMPLETED',
  }
}

/** 强制停止指定会话的智能体。 */
export async function stopRun(threadId: string): Promise<void> {
  const url = getStopURL(threadId)
  const headers = getRESTHeaders(threadId)
  const resp = await fetch(url, { method: 'POST', headers })
  if (!resp.ok) throw new Error(`Stop failed: ${resp.status}`)
}

/** 获取所有活跃运行的线程 ID 列表。 */
export async function getActiveRuns(): Promise<string[]> {
  const url = getActiveRunsURL()
  const headers = getRESTHeaders()
  const resp = await fetch(url, { headers })
  if (!resp.ok) throw new Error(`Active runs check failed: ${resp.status}`)
  return (await resp.json()) as string[]
}

/** HITL 刷新恢复：获取会话的待确认工具列表。 */
export async function getPending(
  threadId: string,
): Promise<Array<{ toolUseId: string; name: string; input?: Record<string, unknown> }>> {
  const url = getPendingURL(threadId)
  const headers = getRESTHeaders(threadId)
  const resp = await fetch(url, { headers })
  if (!resp.ok) throw new Error(`Pending check failed: ${resp.status}`)
  const data = (await resp.json()) as { pending?: Array<{ toolUseId: string; name: string; input?: Record<string, unknown> }> }
  return data.pending ?? []
}
