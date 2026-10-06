import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { layoutWorkflowNodes } from './layout'

function node(id: string): Node {
  return { id, position: { x: 0, y: 0 }, data: {} }
}

describe('layoutWorkflowNodes', () => {
  it('places downstream nodes in later columns without changing data', () => {
    const nodes = [node('start'), node('branch'), node('end')]
    const edges: Edge[] = [
      { id: 'a', source: 'start', target: 'branch' },
      { id: 'b', source: 'branch', target: 'end' },
    ]
    const result = layoutWorkflowNodes(nodes, edges)
    expect(result[0]?.position.x).toBeLessThan(result[1]?.position.x ?? 0)
    expect(result[1]?.position.x).toBeLessThan(result[2]?.position.x ?? 0)
    expect(result.map((item) => item.id)).toEqual(['start', 'branch', 'end'])
  })

  it('keeps cycles and isolated nodes visible with stable positions', () => {
    const nodes = [node('a'), node('b'), node('isolated')]
    const edges: Edge[] = [
      { id: 'a-b', source: 'a', target: 'b' },
      { id: 'b-a', source: 'b', target: 'a' },
    ]
    const first = layoutWorkflowNodes(nodes, edges)
    const second = layoutWorkflowNodes(nodes, edges)
    expect(first.map((item) => item.position)).toEqual(second.map((item) => item.position))
    expect(new Set(first.map((item) => `${item.position.x}:${item.position.y}`)).size).toBe(3)
  })
})
