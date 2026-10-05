import { describe, expect, it } from 'vitest'
import { definitionsEqual, fromBackendDefinition, fromBackendNode, toBackendDefinition, toBackendNode } from './protocol'
import type { WorkflowDefinition } from '@/types'
import ticketFlow from './fixtures/ticket-flow.json'
import iterateSummary from './fixtures/iterate-summary.json'
import mcpIntentRoute from './fixtures/mcp-intent-route.json'

const fixtures = [ticketFlow, iterateSummary, mcpIntentRoute] as unknown as WorkflowDefinition[]

describe('workflow 协议 round-trip', () => {
  it.each(fixtures.map((fixture, index) => [fixture.metadata?.schemaVersion ? `fixture-${index + 1}` : `fixture-${index + 1}`, fixture] as const))(
    '%s 加载→保存 后业务字段无损',
    (_name, fixture) => {
      const { nodes, edges } = fromBackendDefinition(fixture)
      const restored = toBackendDefinition(nodes, edges, fixture.variables, fixture.viewport)
      expect(restored.nodes).toHaveLength(fixture.nodes.length)
      expect(restored.edges).toHaveLength(fixture.edges.length)
      expect(definitionsEqual(fixture, restored)).toBe(true)
    },
  )

  it('React Flow 私有字段不进入持久化结果', () => {
    const backend = fromBackendNode({ id: 'a', type: 'AGENT', name: 'A', position: { x: 1, y: 2 }, config: { agentId: '9' } })
    const polluted = {
      ...backend,
      selected: true,
      dragging: false,
      width: 180,
      height: 44,
      positionAbsolute: { x: 1, y: 2 },
      zIndex: 99,
    }
    const node = toBackendNode(polluted)
    const serialized = JSON.stringify(node)
    for (const field of ['selected', 'dragging', 'positionAbsolute', 'zIndex']) {
      expect(serialized).not.toContain(field)
    }
    expect(node.config).toEqual({ agentId: '9' })
  })

  it('含知识库节点的旧定义原样加载且不静默改写', () => {
    const legacy: WorkflowDefinition = {
      nodes: [
        { id: 'kb', type: 'KNOWLEDGE', name: '旧知识库节点', position: { x: 0, y: 0 }, config: { knowledgeBaseId: '42' } },
        { id: 's', type: 'START', name: '开始', position: { x: 0, y: 0 }, config: {} },
      ],
      edges: [{ id: 'e', source: 's', target: 'kb' }],
    }
    const { nodes, edges } = fromBackendDefinition(legacy)
    expect(nodes).toHaveLength(2)
    const restored = toBackendDefinition(nodes, edges)
    expect(definitionsEqual(legacy, restored)).toBe(true)
    const kbNode = restored.nodes.find((node) => node.id === 'kb')
    expect(kbNode?.type).toBe('KNOWLEDGE')
    expect(kbNode?.config).toEqual({ knowledgeBaseId: '42' })
  })
})
