import type { Edge, Node } from '@xyflow/react'

const X_GAP = 260
const Y_GAP = 140

/**
 * 按连线拓扑分层；环和孤立节点也会稳定落位，不修改节点协议数据。
 */
export function layoutWorkflowNodes<T extends Node>(nodes: T[], edges: Edge[]): T[] {
  if (!nodes.length) return []
  const ids = new Set(nodes.map((node) => node.id))
  const incoming = new Map(nodes.map((node) => [node.id, 0]))
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]))
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) continue
    outgoing.get(edge.source)?.push(edge.target)
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1)
  }

  const level = new Map<string, number>()
  const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id)
  for (const id of queue) level.set(id, 0)
  for (let index = 0; index < queue.length; index += 1) {
    const source = queue[index]!
    for (const target of outgoing.get(source) ?? []) {
      level.set(target, Math.max(level.get(target) ?? 0, (level.get(source) ?? 0) + 1))
      incoming.set(target, (incoming.get(target) ?? 1) - 1)
      if (incoming.get(target) === 0) queue.push(target)
    }
  }

  // 环中的节点无法通过 Kahn 队列出队，统一放到最后一层并保持原始顺序。
  const lastResolvedLevel = Math.max(0, ...level.values())
  for (const node of nodes) if (!level.has(node.id)) level.set(node.id, lastResolvedLevel + 1)

  const rowByLevel = new Map<number, number>()
  return nodes.map((node) => {
    const column = level.get(node.id) ?? 0
    const row = rowByLevel.get(column) ?? 0
    rowByLevel.set(column, row + 1)
    return { ...node, position: { x: 80 + column * X_GAP, y: 80 + row * Y_GAP } }
  })
}
