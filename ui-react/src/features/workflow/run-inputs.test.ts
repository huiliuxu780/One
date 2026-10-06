import { describe, expect, it } from 'vitest'
import { parseInputObject } from '@/pages/workflow-editor-page'

describe('workflow run inputs', () => {
  it('accepts JSON objects', () => expect(parseInputObject('{"city":"Hangzhou"}')).toEqual({ city: 'Hangzhou' }))
  it('rejects arrays and invalid JSON', () => {
    expect(() => parseInputObject('[]')).toThrow('JSON 对象')
    expect(() => parseInputObject('{')).toThrow('合法 JSON')
  })
})
