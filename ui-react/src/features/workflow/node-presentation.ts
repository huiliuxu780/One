import type { Node } from '@xyflow/react'
import type { WorkflowNodeExecution, WorkflowValidationResult } from '@/types'

const summaryKeys: Record<string, string[]> = {
  AGENT: ['modelConfigId', 'maxIterations'],
  INTENT_RECOGNITION: ['modelConfigId'],
  TOOL_EXECUTE: ['toolName'],
  MCP_CALL: ['mcpServerName', 'mcpToolName'],
  HTTP_EXTERNAL: ['request'],
  CODE: ['language'],
  IF_ELSE: ['branches'],
  MATCH_RESULT: ['matchType', 'matches'],
  LOOP: ['maxIterations', 'itemVariable'],
  ITERATE: ['language'],
  NON_EMPTY_SELECT: ['strategy'],
  STRING_SPLIT: ['mode', 'delimiter'],
  STRING_TEMPLATE: ['templateType'],
  SERIALIZE: ['format', 'mode'],
  UNSERIALIZE: ['format'],
  LIST_FILTER: ['mode'],
  LIST_SORT: ['direction'],
  VARIABLE_AGG: ['strategy'],
  CONSTANT: ['expression'],
  CACHE_FETCH: ['key'],
  CACHE_SET: ['key', 'expire'],
  CACHE_REMOVE: ['key'],
  CACHE_REFRESH: ['key', 'expire'],
  DB_SELECT: ['sql'],
  DB_INSERT: ['sql'],
  DB_UPDATE: ['sql'],
  DB_DELETE: ['sql'],
  MQ_PUSH: ['topicOrQueue'],
  EMAIL_SEND: ['toRecipients'],
  WECOM_SEND: ['content'],
  DINGTALK_SEND: ['content'],
  FEISHU_SEND: ['content'],
}

function compactValue(key: string, value: unknown) {
  if (value === undefined || value === null || value === '') return ''
  if (Array.isArray(value)) return `${key}: ${value.length} 项`
  if (typeof value === 'object') {
    const request = value as { method?: unknown; url?: unknown }
    if (key === 'request') return `${String(request.method || 'GET')} ${String(request.url || '未配置 URL')}`
    return `${key}: 已配置`
  }
  const text = String(value).replace(/\s+/g, ' ').trim()
  return `${key}: ${text.length > 32 ? `${text.slice(0, 32)}…` : text}`
}

export function workflowNodeSummary(type: string, config: Record<string, unknown>) {
  return (summaryKeys[type] ?? [])
    .map((key) => compactValue(key, config[key]))
    .filter(Boolean)
    .slice(0, 2)
}

export function applyValidationState(nodes: Node[], result: WorkflowValidationResult) {
  const errors = new Map<string, string[]>()
  for (const raw of result.errors) {
    if (!raw || typeof raw === 'string' || !raw.nodeId) continue
    errors.set(raw.nodeId, [...(errors.get(raw.nodeId) ?? []), raw.message || '配置错误'])
  }
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      status: result.valid ? 'IDLE' : errors.has(node.id) ? 'INVALID' : node.data.status,
      errors: errors.get(node.id) ?? [],
    },
  }))
}

export function applyExecutionState(nodes: Node[], executions: WorkflowNodeExecution[]) {
  const statuses = new Map(executions.map((item) => [item.nodeId, item.status]))
  return nodes.map((node) => statuses.has(node.id) ? { ...node, data: { ...node.data, status: statuses.get(node.id) } } : node)
}
