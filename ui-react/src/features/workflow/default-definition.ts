import type { WorkflowDefinition, WorkflowNodeDefinition } from '@/types'
import { cloneWorkflowNodeDefaults, workflowNodeSchemaMap } from './node-schemas'

export function createDefaultWorkflowDefinition(): WorkflowDefinition {
  const createNode = (id: string, type: 'START' | 'END', x: number): WorkflowNodeDefinition => ({
    id,
    type,
    name: workflowNodeSchemaMap[type].title,
    position: { x, y: 180 },
    ...cloneWorkflowNodeDefaults(type, id),
    ui: {},
  })
  const start = createNode('start', 'START', 120)
  const end = createNode('end', 'END', 520)
  end.inputConfigs = [{ name: 'input', sourceType: 'NODE_OUTPUT', nodeId: 'start', outputName: 'output' }]
  return {
    nodes: [start, end],
    edges: [{ id: 'edge-start-end', source: 'start', target: 'end', sourceHandle: 'output', targetHandle: 'input', label: '' }],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}
