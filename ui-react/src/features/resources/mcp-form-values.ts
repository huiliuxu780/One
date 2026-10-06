import type { McpServerVO } from '@/types'
import { McpMode, McpProtocol } from '@/types'

export interface KeyValue { key: string; value: string }

export interface McpFormValues {
  name: string
  description: string
  protocol: McpProtocol
  mode: McpMode
  timeout: number
  runtimeFailThreshold: number
  enabled: boolean
  url: string
  queryParams: KeyValue[]
  headers: KeyValue[]
  command: string
  args: string[]
  env: KeyValue[]
  cwd: string
  encoding: string
}

function keyValues(value: unknown): KeyValue[] {
  return Array.isArray(value) ? value.map((entry) => ({ key: String(entry?.key ?? ''), value: String(entry?.value ?? '') })) : []
}

export function secretConfigKey(key: string): boolean {
  return /authorization|api[-_]?key|token|secret|password|passwd|credential/i.test(key)
}

function hideSecrets(rows: KeyValue[]): KeyValue[] {
  return rows.map((entry) => ({ ...entry, value: secretConfigKey(entry.key) ? '' : entry.value }))
}

export function initialMcpFormValues(server?: McpServerVO | null): McpFormValues {
  const config = server?.protocolConfig && typeof server.protocolConfig === 'object' ? server.protocolConfig : {}
  return {
    name: server?.name ?? '',
    description: server?.description ?? '',
    protocol: server?.protocol ?? McpProtocol.HTTP,
    mode: server?.mode ?? McpMode.SYNC,
    timeout: server?.timeout ?? 30,
    runtimeFailThreshold: server?.runtimeFailThreshold ?? 3,
    enabled: server?.enabled ?? true,
    url: String(config.url ?? ''),
    queryParams: hideSecrets(keyValues(config.queryParams)),
    headers: hideSecrets(keyValues(config.headers)),
    command: String(config.command ?? ''),
    args: Array.isArray(config.args) ? config.args.map(String) : [],
    env: hideSecrets(keyValues(config.env)),
    cwd: String(config.cwd ?? ''),
    encoding: String(config.encoding ?? 'UTF-8'),
  }
}

function mergeSecrets(rows: KeyValue[], original: unknown): KeyValue[] {
  const saved = keyValues(original)
  return rows.map((entry) => {
    if (!secretConfigKey(entry.key) || entry.value) return entry
    const prior = saved.find((item) => item.key === entry.key)
    return { ...entry, value: prior?.value ?? '' }
  })
}

export function buildMcpProtocolConfig(values: McpFormValues, server?: McpServerVO | null): Record<string, unknown> {
  const original = server?.protocolConfig && typeof server.protocolConfig === 'object' ? server.protocolConfig : {}
  if (values.protocol === McpProtocol.HTTP || values.protocol === McpProtocol.SSE) {
    return {
      ...original,
      url: values.url.trim(),
      queryParams: mergeSecrets(values.queryParams, original.queryParams),
      headers: mergeSecrets(values.headers, original.headers),
    }
  }
  return {
    ...original,
    command: values.command.trim(),
    args: values.args,
    env: mergeSecrets(values.env, original.env),
    cwd: values.cwd.trim(),
    encoding: values.encoding.trim() || 'UTF-8',
  }
}

export function validateMcpForm(values: McpFormValues): string | null {
  if (!values.name.trim()) return '请填写名称'
  if (!values.description.trim()) return '请填写描述'
  if (values.description.length > 200) return '描述不能超过 200 个字符'
  if (!Number.isInteger(values.timeout) || values.timeout < 1) return '超时时间至少为 1 秒'
  if (!Number.isInteger(values.runtimeFailThreshold) || values.runtimeFailThreshold < 0) return '自动降级失败次数不能小于 0'
  if (values.protocol === McpProtocol.STDIO) {
    if (!values.command.trim()) return '请填写可执行命令'
  } else if (!values.url.trim()) return '请填写服务 URL'
  return null
}
