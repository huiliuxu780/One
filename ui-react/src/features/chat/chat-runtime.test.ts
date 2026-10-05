import { describe, expect, it } from 'vitest'
import type { CustomEvent } from '@/types'
import { PlanTracker, reduceSubAgentEvent } from './chat-runtime'

function subAgentEvent(overrides: Record<string, unknown> = {}): CustomEvent {
  return {
    type: 'CUSTOM',
    name: 'APBOA_SUBAGENT_EVENT',
    value: {
      protocolVersion: 1,
      eventId: 'evt-1',
      invocationId: 'invoke-1',
      sequence: 1,
      eventType: 'STARTED',
      occurredAt: '2026-10-05T00:00:00Z',
      agent: { code: 'researcher', title: '研究员' },
      payload: { task: '核实资料' },
      ...overrides,
    },
  }
}

describe('sub-agent runtime reducer', () => {
  it('按事件标识去重，并保护完成状态不被重放覆盖', () => {
    const started = reduceSubAgentEvent([], subAgentEvent())
    expect(started.accepted).toBe(true)
    expect(started.runs[0]).toMatchObject({ status: 'RUNNING', task: '核实资料' })

    const finished = reduceSubAgentEvent(started.runs, subAgentEvent({ eventId: 'evt-2', sequence: 2, eventType: 'FINISHED', payload: { summary: '完成' } }))
    expect(finished.runs[0]).toMatchObject({ status: 'SUCCESS', summary: '完成' })

    const replay = reduceSubAgentEvent(finished.runs, subAgentEvent({ eventId: 'evt-3', sequence: 3, eventType: 'STATUS_CHANGED' }))
    expect(replay.runs[0]?.status).toBe('SUCCESS')
    expect(reduceSubAgentEvent(replay.runs, subAgentEvent({ eventId: 'evt-3', sequence: 4 })).runs).toBe(replay.runs)
  })
})

describe('plan tracker', () => {
  it('由计划工具调用建立计划并推进子任务', () => {
    const tracker = new PlanTracker()
    tracker.start('create', 'create_plan')
    tracker.updateArgs('create', JSON.stringify({ name: '迁移', subtasks: [{ name: '基线' }, { name: '实现' }] }))
    tracker.finish('create')
    expect(tracker.plan?.subtasks).toHaveLength(2)

    tracker.start('finish', 'finish_subtask')
    tracker.updateArgs('finish', JSON.stringify({ subtask_idx: 0, subtask_outcome: '已验证' }))
    tracker.finish('finish')
    expect(tracker.plan?.subtasks[0]).toMatchObject({ state: 'done', outcome: '已验证' })
    expect(tracker.plan?.subtasks[1]?.state).toBe('in_progress')
  })
})
