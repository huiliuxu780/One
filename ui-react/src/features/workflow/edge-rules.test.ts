import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { validateWorkflowConnection } from './edge-rules'

const nodes = [
  { id: 'start', data: { type: 'START', name: '开始' }, position: { x: 0, y: 0 } },
  { id: 'normal', data: { type: 'CODE', name: '代码' }, position: { x: 0, y: 0 } },
  { id: 'branch', data: { type: 'IF_ELSE', name: '分支' }, position: { x: 0, y: 0 } },
  { id: 'end', data: { type: 'END', name: '结束' }, position: { x: 0, y: 0 } },
] as Node[]

describe('workflow edge rules', () => {
  it('rejects self edges and edges into START', () => {
    expect(validateWorkflowConnection({ source: 'normal', target: 'normal', sourceHandle: 'output', targetHandle: 'input' }, nodes, []).ok).toBe(false)
    expect(validateWorkflowConnection({ source: 'normal', target: 'start', sourceHandle: 'output', targetHandle: 'input' }, nodes, []).ok).toBe(false)
  })

  it('limits ordinary nodes to one outgoing edge', () => {
    const edges = [{ id: 'e1', source: 'normal', target: 'end', sourceHandle: 'output' }] as Edge[]
    expect(validateWorkflowConnection({ source: 'normal', target: 'branch', sourceHandle: 'output', targetHandle: 'input' }, nodes, edges).ok).toBe(false)
  })

  it('allows multiple branch outputs but rejects an exact duplicate', () => {
    const edges = [{ id: 'e1', source: 'branch', target: 'normal', sourceHandle: 'output', targetHandle: 'input' }] as Edge[]
    expect(validateWorkflowConnection({ source: 'branch', target: 'end', sourceHandle: 'output', targetHandle: 'input' }, nodes, edges).ok).toBe(true)
    expect(validateWorkflowConnection({ source: 'branch', target: 'normal', sourceHandle: 'output', targetHandle: 'input' }, nodes, edges).ok).toBe(false)
  })
})
