import { describe, expect, it } from 'vitest'
import { buildWorkflowJobInputs, workflowJobDefaults } from './workflow-job-inputs'

describe('automation workflow inputs', () => {
  const params = [
    { name: 'query', type: 'String', required: true },
    { name: 'count', type: 'Integer', value: 2 },
    { name: 'ids', type: 'Array' },
  ]
  const variables = [{ id: 'v1', name: 'enabled', type: 'Boolean', source: 'custom' }] as const

  it('hydrates declared params and custom variables while preserving saved values', () => {
    expect(workflowJobDefaults(params, [...variables], { query: 'saved' }, { enabled: true })).toEqual({
      params: { query: 'saved', count: 2, ids: '[]' },
      variables: { enabled: true },
    })
  })

  it('normalizes values to the scheduler dataMap contract', () => {
    expect(buildWorkflowJobInputs(params, '{"query":"hello","count":"3","ids":"[1,2]"}', '{"enabled":true}')).toEqual({
      params: { query: 'hello', count: 3, ids: [1, 2] },
      variables: { enabled: true },
    })
  })

  it('rejects missing required params and malformed variables', () => {
    expect(() => buildWorkflowJobInputs(params, '{}', '{}')).toThrow('query 为必填参数')
    expect(() => buildWorkflowJobInputs(params, '{"query":"ok"}', '[]')).toThrow('Workflow 变量必须是 JSON 对象')
  })
})
