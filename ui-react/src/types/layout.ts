export type TenantRoleName =
  | 'TENANT_OWNER'
  | 'TENANT_ADMIN'
  | 'TENANT_EDITOR'
  | 'TENANT_VIEWER'

export interface StoredToken {
  value: string
  ttl: string | number
}
