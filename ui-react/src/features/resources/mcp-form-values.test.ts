import { describe, expect, it } from 'vitest'
import type { McpServerVO } from '@/types'
import { McpMode, McpProtocol } from '@/types'
import { buildMcpProtocolConfig, initialMcpFormValues, validateMcpForm } from './mcp-form-values'

describe('MCP form protocol', () => {
  it('uses the backend second-based timeout and Vue failure threshold', () => {
    expect(initialMcpFormValues()).toMatchObject({ timeout: 30, runtimeFailThreshold: 3, protocol: McpProtocol.HTTP, mode: McpMode.SYNC })
  })

  it('hides sensitive values but preserves them when an edited field is left blank', () => {
    const server = {
      name: 'MCP', description: 'test', protocol: McpProtocol.HTTP, mode: McpMode.SYNC,
      protocolConfig: { url: 'https://example.com/mcp', headers: [{ key: 'Authorization', value: 'Bearer secret' }, { key: 'Accept', value: 'application/json' }] },
    } as unknown as McpServerVO
    const values = initialMcpFormValues(server)
    expect(values.headers).toEqual([{ key: 'Authorization', value: '' }, { key: 'Accept', value: 'application/json' }])
    expect(buildMcpProtocolConfig(values, server)).toMatchObject({ headers: [{ key: 'Authorization', value: 'Bearer secret' }, { key: 'Accept', value: 'application/json' }] })
  })

  it('requires a valid endpoint and timeout', () => {
    const values = initialMcpFormValues()
    values.name = 'test'
    values.description = 'test'
    expect(validateMcpForm(values)).toContain('URL')
    values.url = 'https://example.com/mcp'
    values.timeout = 0
    expect(validateMcpForm(values)).toContain('1 秒')
    values.timeout = 30
    expect(validateMcpForm(values)).toBeNull()
    values.description = 'x'.repeat(201)
    expect(validateMcpForm(values)).toContain('200')
  })
})
