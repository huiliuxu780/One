import { describe, expect, it } from 'vitest'
import type { FieldDef } from './types'
import { requiredFieldMissing, resourceEditFieldValue } from './resource-page'

function field(overrides: Partial<FieldDef>): FieldDef {
  return { name: 'value', label: '值', type: 'text', ...overrides }
}

describe('resourceEditFieldValue', () => {
  it('uses the field default when the backend returns null', () => {
    expect(resourceEditFieldValue(field({ type: 'select', defaultValue: 'JAVA' }), null)).toBe('JAVA')
  })

  it('never echoes secrets and formats structured JSON', () => {
    expect(resourceEditFieldValue(field({ secret: true }), 'server-secret')).toBe('')
    expect(resourceEditFieldValue(field({ type: 'json' }), { enabled: true })).toBe('{\n  "enabled": true\n}')
  })

  it('preserves explicit false instead of replacing it with the default', () => {
    expect(resourceEditFieldValue(field({ type: 'switch', defaultValue: true }), false)).toBe(false)
  })
})

describe('requiredFieldMissing', () => {
  it('rejects blank strings and empty arrays for required fields', () => {
    expect(requiredFieldMissing(field({ required: true }), '  ')).toBe(true)
    expect(requiredFieldMissing(field({ required: true, type: 'tags' }), [])).toBe(true)
    expect(requiredFieldMissing(field({ required: true }), 'configured')).toBe(false)
  })

  it('does not reject optional blank values or valid false/zero values', () => {
    expect(requiredFieldMissing(field({ required: false }), '')).toBe(false)
    expect(requiredFieldMissing(field({ required: true }), false)).toBe(false)
    expect(requiredFieldMissing(field({ required: true }), 0)).toBe(false)
  })
})
