import type { WorkflowVariable } from '@/types'
import { defaultRunValue, initialRunVariables, normalizeRunValue, type WorkflowStartParam } from '@/features/workflow/run-inputs'

export function workflowJobDefaults(params: WorkflowStartParam[], variables: WorkflowVariable[], savedParams: Record<string, unknown> = {}, savedVariables: Record<string, unknown> = {}) {
  return {
    params: Object.fromEntries(params.filter((param) => param.name).map((param) => {
      const name = String(param.name)
      return [name, savedParams[name] ?? defaultRunValue(param.type || 'String', param.value)]
    })),
    variables: { ...initialRunVariables(variables), ...savedVariables },
  }
}

export function buildWorkflowJobInputs(params: WorkflowStartParam[], paramsText: string, variablesText: string) {
  let rawParams: unknown
  let rawVariables: unknown
  try { rawParams = JSON.parse(paramsText || '{}') } catch { throw new Error('Workflow 输入必须是合法 JSON 对象') }
  try { rawVariables = JSON.parse(variablesText || '{}') } catch { throw new Error('Workflow 变量必须是合法 JSON 对象') }
  if (!rawParams || Array.isArray(rawParams) || typeof rawParams !== 'object') throw new Error('Workflow 输入必须是 JSON 对象')
  if (!rawVariables || Array.isArray(rawVariables) || typeof rawVariables !== 'object') throw new Error('Workflow 变量必须是 JSON 对象')

  const source = rawParams as Record<string, unknown>
  return {
    params: Object.fromEntries(params.filter((param) => param.name).map((param) => {
      const name = String(param.name)
      const value = source[name]
      if (param.required && (value === undefined || value === null || (typeof value === 'string' && !value.trim()))) throw new Error(`${name} 为必填参数`)
      try { return [name, normalizeRunValue(value, param.type || 'String')] }
      catch (cause) { throw new Error(`${name} ${cause instanceof Error ? cause.message : '格式不正确'}`) }
    })),
    variables: rawVariables as Record<string, unknown>,
  }
}
