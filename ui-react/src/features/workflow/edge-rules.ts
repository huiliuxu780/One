import type { Connection, Edge, Node } from '@xyflow/react'

const MULTI_OUTPUT_TYPES = new Set(['IF_ELSE', 'MATCH_RESULT', 'INTENT_RECOGNITION'])

export function validateWorkflowConnection(connection: Connection, nodes: Node[], edges: Edge[]): { ok: true } | { ok: false; reason: string } {
  if (!connection.source || !connection.target) return { ok: false, reason: '连线缺少起点或终点。' }
  if (connection.source === connection.target) return { ok: false, reason: '节点不能连接到自身。' }
  const source = nodes.find((node) => node.id === connection.source)
  const target = nodes.find((node) => node.id === connection.target)
  if (!source || !target) return { ok: false, reason: '起点或终点不存在。' }
  if (String(source.data.type) === 'END') return { ok: false, reason: '结束节点不能创建输出连线。' }
  if (String(target.data.type) === 'START') return { ok: false, reason: '开始节点不能接收输入连线。' }
  const sourceHandle = connection.sourceHandle || 'output'
  const targetHandle = connection.targetHandle || 'input'
  const duplicate = edges.some((edge) => edge.source === connection.source && edge.target === connection.target && (edge.sourceHandle || 'output') === sourceHandle && (edge.targetHandle || 'input') === targetHandle)
  if (duplicate) return { ok: false, reason: '这两个节点之间已存在相同连线。' }
  if (!MULTI_OUTPUT_TYPES.has(String(source.data.type)) && edges.some((edge) => edge.source === connection.source && (edge.sourceHandle || 'output') === sourceHandle)) {
    return { ok: false, reason: `“${String(source.data.name || source.id)}”不支持多个输出。` }
  }
  return { ok: true }
}
