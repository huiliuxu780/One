import type { WorkflowInputConfig } from '@/types'

/** 将平台工具的参数协议转换为工作流输入绑定，字段名保持后端协议。 */
export function toolInputConfigs(schema: unknown): WorkflowInputConfig[] {
  if (!Array.isArray(schema)) return []
  return schema
    .map((item) => item && typeof item === 'object' ? String((item as { name?: unknown }).name ?? '').trim() : '')
    .filter(Boolean)
    .map((name) => ({ name, sourceType: 'NODE_OUTPUT' as const }))
}

/** MCP 使用 JSON Schema properties；选择工具后按属性名生成输入绑定。 */
export function mcpInputConfigs(schema: unknown): WorkflowInputConfig[] {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return []
  const properties = (schema as { properties?: unknown }).properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return []
  return Object.keys(properties).map((name) => ({ name, sourceType: 'NODE_OUTPUT' as const }))
}
