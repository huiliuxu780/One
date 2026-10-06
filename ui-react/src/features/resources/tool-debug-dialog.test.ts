import { describe, expect, it } from 'vitest'
import { buildToolDebugArguments, toolDebugInitialValues, type ToolInputSchemaItem } from './tool-debug-dialog'

const schema: ToolInputSchemaItem[] = [
  { name: 'query', type: 'string', required: true, defaultValue: 'hello' },
  { name: 'count', type: 'integer', defaultValue: '2' },
  { name: 'enabled', type: 'boolean', defaultValue: 'false' },
  { name: 'options', type: 'object' },
  { name: 'items', type: 'array' },
]

describe('tool debug arguments', () => {
  it('converts schema defaults to runtime types', () => {
    expect(toolDebugInitialValues(schema)).toEqual({ query: 'hello', count: 2, enabled: false })
  })

  it('rejects fractional values for integer parameters', () => {
    expect(() => buildToolDebugArguments([{ name: 'limit', type: 'integer', required: true }], { limit: '1.5' })).toThrow('必须是整数')
  })

  it('validates required fields and parses typed inputs', () => {
    expect(buildToolDebugArguments(schema, {
      query: 'run',
      count: '3',
      enabled: false,
      options: '{"strict":true}',
      items: '[1,2]',
    })).toEqual({ query: 'run', count: 3, enabled: false, options: { strict: true }, items: [1, 2] })
    expect(() => buildToolDebugArguments(schema, { query: ' ' })).toThrow('请填写query')
  })

  it('rejects JSON values with the wrong structural type', () => {
    expect(() => buildToolDebugArguments(schema, { query: 'run', options: '[]' })).toThrow('options：必须是 JSON 对象')
    expect(() => buildToolDebugArguments(schema, { query: 'run', items: '{}' })).toThrow('items：必须是 JSON 数组')
  })
})
