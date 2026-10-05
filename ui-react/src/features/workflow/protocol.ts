import type { Edge, Node } from '@xyflow/react'
import type { WorkflowDefinition, WorkflowEdgeDefinition, WorkflowNodeDefinition } from '@/types'

/**
 * React Flow 与后端 WorkflowDefinition 之间的唯一协议转换边界。
 * 规则：
 * - 后端字段结构保持原样，不新增/丢弃业务字段；
 * - React Flow 私有字段（selected、dragging、positionAbsolute、width/height 等）禁止持久化；
 * - 节点位置只从 definition.position 读取，渲染层状态不回写。
 */

const REACT_FLOW_ONLY_NODE_FIELDS = new Set(['selected', 'dragging', 'width', 'height', 'positionAbsolute', 'zIndex', 'focusable', 'deletable', 'draggable', 'selectable'])

/** React Flow Node → WorkflowNodeDefinition（剥离渲染私有字段） */
export function toBackendNode(node: Node): WorkflowNodeDefinition {
  const data = (node.data ?? {}) as Partial<WorkflowNodeDefinition> & Record<string, unknown>
  const cleanData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (!REACT_FLOW_ONLY_NODE_FIELDS.has(key)) cleanData[key] = value
  }
  return {
    id: node.id,
    type: (cleanData.type as string) ?? node.type ?? '',
    name: (cleanData.name as string) ?? '',
    position: { x: node.position.x, y: node.position.y },
    config: (cleanData.config as Record<string, unknown>) ?? {},
    ...(cleanData.inputConfigs ? { inputConfigs: cleanData.inputConfigs as WorkflowNodeDefinition['inputConfigs'] } : {}),
    ...(cleanData.outputConfigs ? { outputConfigs: cleanData.outputConfigs as WorkflowNodeDefinition['outputConfigs'] } : {}),
    ...(cleanData.ui ? { ui: cleanData.ui as Record<string, unknown> } : {}),
  }
}

/** WorkflowNodeDefinition → React Flow Node（仅注入渲染所需数据） */
export function fromBackendNode(definition: WorkflowNodeDefinition): Node {
  return {
    id: definition.id,
    type: 'workflow',
    position: { x: definition.position.x, y: definition.position.y },
    data: {
      type: definition.type,
      name: definition.name,
      config: definition.config ?? {},
      ...(definition.inputConfigs ? { inputConfigs: definition.inputConfigs } : {}),
      ...(definition.outputConfigs ? { outputConfigs: definition.outputConfigs } : {}),
      ...(definition.ui ? { ui: definition.ui } : {}),
    },
  }
}

export function toBackendEdge(edge: Edge): WorkflowEdgeDefinition {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
    ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
    ...(edge.label ? { label: String(edge.label) } : {}),
  }
}

export function fromBackendEdge(definition: WorkflowEdgeDefinition): Edge {
  return {
    id: definition.id,
    source: definition.source,
    target: definition.target,
    ...(definition.sourceHandle ? { sourceHandle: definition.sourceHandle } : {}),
    ...(definition.targetHandle ? { targetHandle: definition.targetHandle } : {}),
    ...(definition.label ? { label: definition.label } : {}),
  }
}

/** 画布 → 后端 WorkflowDefinition（保存前调用） */
export function toBackendDefinition(
  nodes: Node[],
  edges: Edge[],
  variables?: WorkflowDefinition['variables'],
  viewport?: { x: number; y: number; zoom: number },
): WorkflowDefinition {
  return {
    nodes: nodes.map(toBackendNode),
    edges: edges.map(toBackendEdge),
    ...(variables?.length ? { variables } : {}),
    ...(viewport ? { viewport } : {}),
  }
}

/** 后端 WorkflowDefinition → 画布（加载时调用） */
export function fromBackendDefinition(definition: WorkflowDefinition): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: (definition.nodes ?? []).map(fromBackendNode),
    edges: (definition.edges ?? []).map(fromBackendEdge),
  }
}

/** round-trip 比对：忽略键顺序，验证业务字段无损。 */
export function definitionsEqual(a: WorkflowDefinition, b: WorkflowDefinition): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
}

function normalize(definition: WorkflowDefinition): WorkflowDefinition {
  // metadata 由服务端维护（schemaVersion/nodeVersion 等），不属于前端保存协议
  const { metadata: _metadata, ...business } = definition
  void _metadata
  return {
    ...business,
    nodes: [...(definition.nodes ?? [])].sort((x, y) => x.id.localeCompare(y.id)),
    edges: [...(definition.edges ?? [])].sort((x, y) => x.id.localeCompare(y.id)),
  }
}
