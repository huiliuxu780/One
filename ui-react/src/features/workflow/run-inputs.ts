import type { VariableType, WorkflowRunRequest, WorkflowVariable } from '@/types'

export type WorkflowStartParam = {
  name?: string
  type?: string
  value?: unknown
  required?: boolean
}

export function defaultRunValue(type: string, value?: unknown): unknown {
  if (value !== undefined && value !== null && value !== '') {
    if ((type === 'Array' || type === 'Object') && typeof value !== 'string') return JSON.stringify(value, null, 2)
    return value
  }
  if (type === 'Boolean') return false
  if (['Long', 'Integer', 'Float', 'Double'].includes(type)) return 0
  if (type === 'Array') return '[]'
  if (type === 'Object') return '{}'
  return ''
}

export function defaultVariableValue(type: VariableType): unknown {
  if (type === 'Boolean') return false
  if (['Long', 'Integer', 'Float', 'Double'].includes(type)) return 0
  if (type === 'Array') return []
  if (type === 'Object') return {}
  return ''
}

export function initialRunParamValues(params: WorkflowStartParam[]) {
  return Object.fromEntries(params.filter((param) => param.name).map((param) => [String(param.name), defaultRunValue(param.type || 'String', param.value)]))
}

export function initialRunVariables(variables: WorkflowVariable[]) {
  return Object.fromEntries(variables.filter((variable) => variable.source === 'custom').map((variable) => [variable.name, defaultVariableValue(variable.type)]))
}

export function normalizeRunValue(value: unknown, type: string): unknown {
  if (type === 'Boolean') return Boolean(value)
  if (['Integer', 'Float', 'Double'].includes(type)) {
    const number = Number(value)
    if (!Number.isFinite(number)) throw new Error('必须是数字')
    return number
  }
  // JavaScript 无法安全表示任意 Long，按 Vue 行为作为字符串提交。
  if (type === 'Long') {
    if (value === '' || value === undefined || value === null || !Number.isFinite(Number(value))) throw new Error('必须是整数')
    return String(value)
  }
  if (type === 'Array' || type === 'Object') {
    let parsed = value
    if (typeof value === 'string') {
      try { parsed = JSON.parse(value) } catch { throw new Error(`必须是合法 JSON ${type === 'Array' ? '数组' : '对象'}`) }
    }
    if (type === 'Array' && !Array.isArray(parsed)) throw new Error('必须是 JSON 数组')
    if (type === 'Object' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) throw new Error('必须是 JSON 对象')
    return parsed
  }
  return value == null ? '' : String(value)
}

export function buildWorkflowRunRequest(params: WorkflowStartParam[], values: Record<string, unknown>, variablesText: string): WorkflowRunRequest {
  let variables: unknown
  try { variables = JSON.parse(variablesText || '{}') } catch { throw new Error('工作流变量必须是合法 JSON 对象') }
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) throw new Error('工作流变量必须是 JSON 对象')
  return {
    params: params.filter((param) => param.name).map((param) => {
      const name = String(param.name)
      const raw = values[name]
      if (param.required && (raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim()))) throw new Error(`${name} 为必填参数`)
      try {
        return { name, value: normalizeRunValue(raw, param.type || 'String') }
      } catch (cause) {
        throw new Error(`${name} ${cause instanceof Error ? cause.message : '格式不正确'}`)
      }
    }),
    variables: variables as Record<string, unknown>,
  }
}

export function parseWorkflowRunRequest(value: string): WorkflowRunRequest {
  let parsed: unknown
  try { parsed = JSON.parse(value) } catch { throw new Error('运行输入必须是合法 JSON') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('运行输入必须是 JSON 对象')
  const request = parsed as Record<string, unknown>
  if (request.params !== undefined && !Array.isArray(request.params)) throw new Error('params 必须是数组')
  if (request.variables !== undefined && (!request.variables || typeof request.variables !== 'object' || Array.isArray(request.variables))) throw new Error('variables 必须是对象')
  return request as WorkflowRunRequest
}
