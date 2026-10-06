import { describe, expect, it } from 'vitest'
import { redactedProtocolConfig, validateProtocolConfig } from './storage-protocol-config'

describe('storage protocol configuration', () => {
  it('requires the connection fields used by each protocol', () => {
    expect(validateProtocolConfig('S3', { endpoint: '', accessKey: 'a', secretKey: 's', bucketName: 'b' })).toContain('Endpoint')
    expect(validateProtocolConfig('FTP', { host: 'example.org', port: 0, userName: 'u', password: 'p' })).toContain('端口')
    expect(validateProtocolConfig('LOCAL', { localDir: ' ' })).toContain('本地存储目录')
    expect(validateProtocolConfig('FTP', { host: 'example.org', port: 21, userName: 'u', password: 'p' })).toBeNull()
  })

  it('masks credentials in the detail view', () => {
    expect(redactedProtocolConfig({ host: 'example.org', accessKey: 'key', secretKey: 'secret', password: 'pass' }))
      .toEqual({ host: 'example.org', accessKey: '已配置', secretKey: '已配置', password: '已配置' })
  })
})
