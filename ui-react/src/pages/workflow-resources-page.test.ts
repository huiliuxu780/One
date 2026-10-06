import { describe, expect, it } from 'vitest'
import { defaultResourceDraft, parseChannelConfig, validateResourceDraft } from './workflow-resources-page'

describe('workflow resource forms', () => {
  it('uses the same useful defaults as the Vue forms', () => {
    expect(defaultResourceDraft('datasource')).toMatchObject({ type: 'MYSQL', port: '3306', enabled: true })
    expect(defaultResourceDraft('cache')).toMatchObject({ type: 'REDIS', port: 6379, db: 0, enabled: true })
    expect(defaultResourceDraft('mq')).toMatchObject({ type: 'KAFKA', port: 9092, enabled: true })
    expect(parseChannelConfig(defaultResourceDraft('channel').config)).toMatchObject({ serverPort: '465', sslEnable: 'true' })
  })

  it('rejects incomplete endpoints and invalid JSON before sending a request', () => {
    expect(validateResourceDraft('datasource', { name: 'db', type: 'MYSQL', ip: '', port: '3306', db: 'app' })).toBe('地址不能为空')
    expect(validateResourceDraft('cache', { name: 'cache', type: 'REDIS', ip: 'redis', port: 70000, db: 0 })).toBe('端口范围为 1-65535')
    expect(validateResourceDraft('mq', { name: 'mq', type: 'KAFKA', address: 'kafka', port: 9092, config: '{' })).toBe('扩展配置必须是合法 JSON')
  })

  it('validates structured email and webhook channel settings', () => {
    expect(validateResourceDraft('channel', { name: 'mail', type: 'EMAIL', config: JSON.stringify({ serverHost: '' }) })).toBe('SMTP 服务器地址不能为空')
    expect(validateResourceDraft('channel', { name: 'ops', type: 'DINGTALK', config: JSON.stringify({ webhook: '' }) })).toBe('Webhook 地址不能为空')
    expect(validateResourceDraft('channel', { name: 'ops', type: 'FEISHU', config: JSON.stringify({ webhook: 'https://example.com/hook' }) })).toBeNull()
  })
})
