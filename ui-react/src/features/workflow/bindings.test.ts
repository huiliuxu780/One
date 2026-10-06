import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { upstreamWorkflowNodes, workflowNodeOutputs } from './bindings'

const node = (id: string, data: Record<string, unknown> = {}): Node => ({ id, position: { x: 0, y: 0 }, data })
const edge = (source: string, target: string): Edge => ({ id: `${source}-${target}`, source, target })

describe('workflow input bindings', () => {
  it('only exposes transitively reachable upstream nodes', () => {
    const nodes = [node('start'), node('middle'), node('current'), node('downstream'), node('unrelated')]
    const edges = [edge('start', 'middle'), edge('middle', 'current'), edge('current', 'downstream')]

    expect(upstreamWorkflowNodes('current', nodes, edges).map((item) => item.id)).toEqual(['start', 'middle'])
  })

  it('does not loop forever when legacy data contains a cycle', () => {
    const nodes = [node('a'), node('b'), node('current')]
    const edges = [edge('a', 'b'), edge('b', 'a'), edge('b', 'current'), edge('current', 'b')]

    expect(upstreamWorkflowNodes('current', nodes, edges).map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('uses START params as declared outputs', () => {
    const start = node('start', { type: 'START', config: { params: [{ name: 'query', type: 'String', description: '用户输入' }, { name: '' }] } })

    expect(workflowNodeOutputs(start)).toEqual([{ name: 'query', type: 'String', description: '用户输入' }])
  })

  it('uses outputConfigs for regular nodes and drops unnamed outputs', () => {
    const regular = node('tool', { type: 'TOOL', outputConfigs: [{ name: 'result', type: 'Object' }, { type: 'String' }] })

    expect(workflowNodeOutputs(regular)).toEqual([{ name: 'result', type: 'Object' }])
  })
})
