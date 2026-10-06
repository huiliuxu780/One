import { describe, expect, it } from 'vitest'
import { buildWorkflowRunRequest, normalizeRunValue, parseWorkflowRunRequest } from './run-inputs'

describe('workflow run inputs', () => {
  it('uses the Java DTO params/variables shape', () => {
    expect(buildWorkflowRunRequest(
      [{ name: 'city', type: 'String', required: true }, { name: 'limit', type: 'Integer' }],
      { city: 'Hangzhou', limit: '3' },
      '{"trace":true}',
    )).toEqual({ params: [{ name: 'city', value: 'Hangzhou' }, { name: 'limit', value: 3 }], variables: { trace: true } })
  })

  it('keeps Long values lossless and parses composite values', () => {
    expect(normalizeRunValue('9223372036854775807', 'Long')).toBe('9223372036854775807')
    expect(normalizeRunValue('[1,2]', 'Array')).toEqual([1, 2])
  })

  it('accepts only valid backend request objects', () => {
    expect(parseWorkflowRunRequest('{"params":[],"variables":{"city":"Hangzhou"}}')).toEqual({ params: [], variables: { city: 'Hangzhou' } })
    expect(() => parseWorkflowRunRequest('[]')).toThrow('JSON 对象')
    expect(() => parseWorkflowRunRequest('{"params":{}}')).toThrow('params 必须是数组')
    expect(() => parseWorkflowRunRequest('{')).toThrow('合法 JSON')
  })
})
