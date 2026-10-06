import type { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { applyExecutionState, applyValidationState, workflowNodeSummary } from './node-presentation'

const node = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: { status: 'IDLE' } })

describe('workflow node presentation', () => {
  it('summarizes configured fields without dumping full payloads', () => {
    expect(workflowNodeSummary('HTTP_EXTERNAL', { request: { method: 'POST', url: 'https://example.test/run' } })).toEqual(['POST https://example.test/run'])
    expect(workflowNodeSummary('MATCH_RESULT', { matchType: 'EQUALS', matches: [{}, {}] })).toEqual(['matchType: EQUALS', 'matches: 2 项'])
  })

  it('marks only nodes named by validation errors as invalid', () => {
    const result = applyValidationState([node('a'), node('b')], { valid: false, errors: [{ nodeId: 'b', message: '缺少配置' }, '全局错误'] })
    expect(result.map((item) => [item.id, item.data.status, item.data.errors])).toEqual([
      ['a', 'IDLE', []],
      ['b', 'INVALID', ['缺少配置']],
    ])
  })

  it('applies backend execution status to matching nodes', () => {
    const result = applyExecutionState([node('a'), node('b')], [{ nodeId: 'a', status: 'SUCCESS' } as never])
    expect(result.map((item) => item.data.status)).toEqual(['SUCCESS', 'IDLE'])
  })
})
