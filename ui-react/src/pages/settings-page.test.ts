import { describe, expect, it } from 'vitest'
import { filterAccounts } from './settings-page'
import type { AccountVO } from '@/types'

const accounts = [
  { id: '1', username: 'admin', nickname: '管理员', email: 'admin@example.com', enabled: true, tenantRole: 'TENANT_OWNER' },
  { id: '2', username: 'auditor', nickname: '审计员', email: 'audit@example.com', enabled: true, tenantRole: 'TENANT_VIEWER' },
] as unknown as AccountVO[]

describe('account list filtering', () => {
  it('filters the loaded tenant-scoped list by username, nickname, or email', () => {
    expect(filterAccounts(accounts, 'AUDIT')).toEqual([accounts[1]])
    expect(filterAccounts(accounts, '管理员')).toEqual([accounts[0]])
    expect(filterAccounts(accounts, '@example.com')).toHaveLength(2)
  })

  it('returns all rows for an empty search', () => {
    expect(filterAccounts(accounts, '  ')).toEqual(accounts)
  })
})
