import { describe, expect, it } from 'vitest'
import type { FieldDef } from './types'
import { resourceEditFieldValue } from './resource-page'

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
