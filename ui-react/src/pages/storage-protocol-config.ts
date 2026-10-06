type ProtocolConfig = Record<string, string | number | boolean>

export function validateProtocolConfig(protocol: string, config: ProtocolConfig): string | null {
  const required = protocol === 'S3'
    ? [['endpoint', 'Endpoint'], ['accessKey', 'AccessKey'], ['secretKey', 'SecretKey'], ['bucketName', 'Bucket 名称']]
    : protocol === 'FTP'
      ? [['host', '主机地址'], ['userName', '用户名'], ['password', '密码']]
      : [['localDir', '本地存储目录']]

  for (const [key, label] of required) {
    if (typeof config[key] !== 'string' || !String(config[key]).trim()) return `请填写${label}`
  }
  if (protocol === 'FTP' && (typeof config.port !== 'number' || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535)) {
    return '端口需为 1 到 65535 之间的整数'
  }
  return null
}

export function redactedProtocolConfig(config: ProtocolConfig): ProtocolConfig {
  return Object.fromEntries(Object.entries(config).map(([key, value]) =>
    /secret|password|accesskey|token/i.test(key) ? [key, value ? '已配置' : '未配置'] : [key, value]))
}
