import type { Edge, Node } from '@xyflow/react'

export type WorkflowNodeOutput = { name: string; type?: string; description?: string }

export function upstreamWorkflowNodes(nodeId: string, nodes: Node[], edges: Edge[]) {
  const reverse = new Map<string, string[]>()
  for (const edge of edges) reverse.set(edge.target, [...(reverse.get(edge.target) ?? []), edge.source])

  const visited = new Set<string>()
  const queue = [...(reverse.get(nodeId) ?? [])]
  while (queue.length) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    queue.push(...(reverse.get(current) ?? []))
  }
  visited.delete(nodeId)
  return nodes.filter((node) => visited.has(node.id))
}

export function workflowNodeOutputs(node: Node): WorkflowNodeOutput[] {
  if (String(node.data.type) === 'START') {
    const config = (node.data.config as Record<string, unknown> | undefined) ?? {}
    const params = Array.isArray(config.params) ? config.params as Array<{ name?: string; type?: string; description?: string }> : []
    return params.filter((item) => item.name).map((item) => ({ name: String(item.name), type: item.type, description: item.description }))
  }
  return ((node.data.outputConfigs as Array<{ name?: string; type?: string; description?: string }> | undefined) ?? [])
    .filter((item) => item.name)
    .map((item) => ({ name: String(item.name), type: item.type, description: item.description }))
}
