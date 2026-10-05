import type { CustomEvent, PlanInfo, SubAgentRunVO, SubAgentTraceEvent, SubTaskInfo } from '@/types'

export const SUBAGENT_EVENT_NAME = 'APBOA_SUBAGENT_EVENT'

const TERMINAL_SUBAGENT_STATUS = new Set(['SUCCESS', 'BLOCKED', 'FAILED', 'CANCELLED'])
const PLAN_MUTATION_TOOLS = new Set([
  'create_plan',
  'update_plan_info',
  'revise_current_plan',
  'update_subtask_state',
  'finish_subtask',
  'finish_plan',
  'recover_historical_plan',
])

export interface ToolCallView {
  id: string
  name: string
  args: string
  result?: string
  error?: string
  status: 'RUNNING' | 'WAITING_CONFIRMATION' | 'SUCCESS' | 'FAILED'
  startedAt: number
  elapsed?: number
}

export interface ReasoningView {
  id: string
  content: string
  complete: boolean
}

export function asSubAgentTrace(value: unknown): SubAgentTraceEvent | null {
  if (!value || typeof value !== 'object') return null
  const event = value as Partial<SubAgentTraceEvent>
  if (event.protocolVersion !== undefined && event.protocolVersion !== 1) return null
  if (!event.invocationId || !event.eventId || !event.eventType || event.sequence === undefined) return null
  return event as SubAgentTraceEvent
}

function subAgentStatus(event: SubAgentTraceEvent): SubAgentRunVO['status'] {
  switch (event.eventType) {
    case 'FINISHED': return 'SUCCESS'
    case 'BLOCKED': return 'BLOCKED'
    case 'FAILED': return 'FAILED'
    case 'CANCELLED': return 'CANCELLED'
    default: return 'RUNNING'
  }
}

/** 接受一条子 Agent 事件；按 eventId/sequence 去重并保护终态不被重放覆盖。 */
export function reduceSubAgentEvent(
  runs: SubAgentRunVO[],
  customEvent: CustomEvent,
): { accepted: boolean; runs: SubAgentRunVO[] } {
  if (customEvent.name !== SUBAGENT_EVENT_NAME) return { accepted: false, runs }
  const event = asSubAgentTrace(customEvent.value)
  if (!event) return { accepted: false, runs }

  const index = runs.findIndex((item) => item.invocationId === event.invocationId)
  const existing = index >= 0 ? runs[index] : undefined
  if (existing?.events.some((item) => item.eventId === event.eventId || item.sequence === event.sequence)) {
    return { accepted: true, runs }
  }

  const payload = event.payload ?? {}
  const nextStatus = subAgentStatus(event)
  const eventIsTerminal = TERMINAL_SUBAGENT_STATUS.has(nextStatus)
  const existingIsTerminal = Boolean(existing && TERMINAL_SUBAGENT_STATUS.has(existing.status))
  const next: SubAgentRunVO = {
    invocationId: event.invocationId,
    parentInvocationId: event.parentInvocationId ?? existing?.parentInvocationId,
    rootRunId: event.rootRunId ?? existing?.rootRunId,
    agentCode: event.agent?.code ?? existing?.agentCode,
    agentTitle: event.agent?.title ?? existing?.agentTitle,
    subagentSessionId: event.agent?.subagentSessionId ?? existing?.subagentSessionId,
    status: existingIsTerminal ? existing!.status : eventIsTerminal ? nextStatus : (existing?.status ?? nextStatus),
    task: typeof payload.task === 'string' ? payload.task : existing?.task,
    summary: typeof payload.summary === 'string' ? payload.summary : existing?.summary,
    startedAt: existing?.startedAt ?? event.occurredAt,
    endedAt: existingIsTerminal ? existing!.endedAt : eventIsTerminal ? event.occurredAt : existing?.endedAt,
    events: [...(existing?.events ?? []), event].sort((left, right) => left.sequence - right.sequence),
  }

  if (index < 0) return { accepted: true, runs: [...runs, next] }
  const copy = [...runs]
  copy[index] = next
  return { accepted: true, runs: copy }
}

function safeObject(raw: string): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as unknown
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  } catch {
    return null
  }
}

function subtasks(value: unknown): SubTaskInfo[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const task = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      name: typeof task.name === 'string' && task.name ? task.name : 'Unnamed Subtask',
      description: typeof task.description === 'string' ? task.description : '',
      expectedOutcome: typeof task.expected_outcome === 'string' ? task.expected_outcome : '',
      state: 'todo',
    }
  })
}

/** 计划工具追踪器。实例只服务一次会话流，避免重连事件污染其他会话。 */
export class PlanTracker {
  private names = new Map<string, string>()
  private args = new Map<string, string>()
  plan: PlanInfo | null = null
  finished = false

  start(toolCallId: string, toolName: string) {
    if (!PLAN_MUTATION_TOOLS.has(toolName)) return
    this.names.set(toolCallId, toolName)
    this.args.set(toolCallId, '')
  }

  updateArgs(toolCallId: string, fullArgs: string) {
    if (this.args.has(toolCallId)) this.args.set(toolCallId, fullArgs)
  }

  finish(toolCallId: string): PlanInfo | null {
    const name = this.names.get(toolCallId)
    const raw = this.args.get(toolCallId)
    this.names.delete(toolCallId)
    this.args.delete(toolCallId)
    if (!name || !raw) return this.plan
    const args = safeObject(raw)
    if (!args) return this.plan
    this.apply(name, args)
    return this.plan
  }

  reset() {
    this.names.clear()
    this.args.clear()
    this.plan = null
    this.finished = false
  }

  private apply(name: string, args: Record<string, unknown>) {
    if (name === 'create_plan') {
      this.plan = {
        name: typeof args.name === 'string' && args.name ? args.name : 'Unnamed Plan',
        description: typeof args.description === 'string' ? args.description : '',
        expectedOutcome: typeof args.expected_outcome === 'string' ? args.expected_outcome : '',
        subtasks: subtasks(args.subtasks),
      }
      this.finished = false
      return
    }
    if (name === 'recover_historical_plan') {
      this.finished = false
      return
    }
    if (!this.plan) return

    const next: PlanInfo = { ...this.plan, subtasks: this.plan.subtasks.map((item) => ({ ...item })) }
    if (name === 'update_plan_info') {
      if (typeof args.name === 'string' && args.name.trim()) next.name = args.name.trim()
      if (typeof args.description === 'string' && args.description.trim()) next.description = args.description.trim()
      if (typeof args.expected_outcome === 'string' && args.expected_outcome.trim()) next.expectedOutcome = args.expected_outcome.trim()
    } else if (name === 'revise_current_plan') {
      const index = Number(args.subtask_idx)
      const task = args.subtask && typeof args.subtask === 'object' ? args.subtask as Record<string, unknown> : null
      if (args.action === 'add' && index >= 0 && index <= next.subtasks.length && task) {
        next.subtasks.splice(index, 0, subtasks([task])[0]!)
      } else if (args.action === 'revise' && index >= 0 && index < next.subtasks.length && task) {
        const previous = next.subtasks[index]!
        next.subtasks[index] = {
          name: typeof task.name === 'string' && task.name ? task.name : previous.name,
          description: typeof task.description === 'string' && task.description ? task.description : previous.description,
          expectedOutcome: typeof task.expected_outcome === 'string' && task.expected_outcome ? task.expected_outcome : previous.expectedOutcome,
          state: previous.state,
          outcome: previous.outcome,
        }
      } else if (args.action === 'delete' && index >= 0 && index < next.subtasks.length) {
        next.subtasks[index]!.state = 'removed'
      }
    } else if (name === 'update_subtask_state') {
      const index = Number(args.subtask_idx)
      if (index >= 0 && index < next.subtasks.length && (args.state === 'in_progress' || args.state === 'abandoned')) {
        next.subtasks[index]!.state = args.state
      }
    } else if (name === 'finish_subtask') {
      const index = Number(args.subtask_idx)
      if (index >= 0 && index < next.subtasks.length) {
        next.subtasks[index]!.state = 'done'
        if (typeof args.subtask_outcome === 'string') next.subtasks[index]!.outcome = args.subtask_outcome
        if (next.subtasks[index + 1]?.state === 'todo') next.subtasks[index + 1]!.state = 'in_progress'
      }
    } else if (name === 'finish_plan') {
      this.finished = true
      if (args.state === 'abandoned') {
        next.subtasks.forEach((task) => {
          if (!['done', 'removed', 'abandoned'].includes(task.state)) task.state = 'abandoned'
        })
      }
    }
    this.plan = next
  }
}
