import { describe, expect, it } from 'vitest'
import { normalizeToolSchema, validateToolSchema } from './tool-schema-field'

describe('Tool schema editing protocol', () => {
  it('preserves the Vue schema fields and rejects duplicate names', () => {
    const schema = normalizeToolSchema([{ name: 'count', type: 'integer', required: true, defaultValue: '2' }])
    expect(schema).toEqual([{ name: 'count', description: '', type: 'integer', defaultValue: '2', required: true }])
    expect(validateToolSchema(schema)).toBeNull()
    expect(validateToolSchema([...schema, { ...schema[0] }])).toContain('重复')
    expect(validateToolSchema([{ ...schema[0], name: '' }])).toContain('不能为空')
  })
})
