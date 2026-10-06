import { describe, expect, it } from 'vitest'
import { mcpInputConfigs, toolInputConfigs } from './resource-bindings'

describe('workflow resource bindings', () => {
  it('builds tool inputs from the existing array protocol', () => {
    expect(toolInputConfigs([{ name: 'city' }, { name: 'unit' }, { label: 'ignored' }])).toEqual([
      { name: 'city', sourceType: 'NODE_OUTPUT' },
      { name: 'unit', sourceType: 'NODE_OUTPUT' },
    ])
  })

  it('builds MCP inputs from JSON Schema properties', () => {
    expect(mcpInputConfigs({ type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer' } } })).toEqual([
      { name: 'query', sourceType: 'NODE_OUTPUT' },
      { name: 'limit', sourceType: 'NODE_OUTPUT' },
    ])
  })

  it('returns empty bindings for unsupported schemas', () => {
    expect(toolInputConfigs({ properties: {} })).toEqual([])
    expect(mcpInputConfigs([])).toEqual([])
  })
})
