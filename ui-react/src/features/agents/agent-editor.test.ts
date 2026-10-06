import { describe, expect, it } from 'vitest'
import { buildToolSelectorOptions, validateA2aConfig } from './agent-editor'
import { A2aType } from '@/types'

describe('buildToolSelectorOptions', () => {
  it('submits the database id while displaying the runtime tool id', () => {
    expect(buildToolSelectorOptions([{ id: '2107004778652971009', name: '文本长度统计', toolId: 'text_length_demo' }])).toEqual([
      { label: '文本长度统计', value: '2107004778652971009', description: 'text_length_demo' },
    ])
  })
})

describe('A2A config validation', () => {
  it('requires a valid WellKnown endpoint and complete header keys', () => {
    expect(validateA2aConfig({ a2aType: A2aType.WELLKNOWN, a2aConfig: { agentName: 'peer', baseUrl: 'not-a-url', relativeCardPath: '/.well-known/agent-card.json', authHeaders: [] } })).toBe('请输入有效的 Base URL')
    expect(validateA2aConfig({ a2aType: A2aType.WELLKNOWN, a2aConfig: { agentName: 'peer', baseUrl: 'https://peer.example.com', relativeCardPath: '/.well-known/agent-card.json', authHeaders: [{ key: '', value: 'TOKEN', evn: true }] } })).toBe('认证头名称不能为空')
  })

  it('requires the fixed Nacos server address', () => {
    expect(validateA2aConfig({ a2aType: A2aType.NACOS, a2aConfig: { agentName: 'peer', nacosProperties: [{ key: 'serverAddr', value: '', evn: false }] } })).toBe('Nacos serverAddr 不能为空')
    expect(validateA2aConfig({ a2aType: A2aType.NACOS, a2aConfig: { agentName: 'peer', nacosProperties: [{ key: 'serverAddr', value: 'nacos:8848', evn: false }] } })).toBeNull()
  })
})
