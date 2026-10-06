import { describe, expect, it } from 'vitest'
import { CAPABILITY_MIN_ROLE, roleSatisfies } from './permissions'

describe('roleSatisfies', () => {
  it('按角色等级判断能力满足关系', () => {
    expect(roleSatisfies('TENANT_OWNER', 'TENANT_VIEWER')).toBe(true)
    expect(roleSatisfies('TENANT_EDITOR', 'TENANT_EDITOR')).toBe(true)
    expect(roleSatisfies('TENANT_EDITOR', 'TENANT_ADMIN')).toBe(false)
    expect(roleSatisfies('TENANT_VIEWER', 'TENANT_EDITOR')).toBe(false)
  })

  it('未知角色与空角色一律拒绝', () => {
    expect(roleSatisfies(undefined, 'TENANT_VIEWER')).toBe(false)
    expect(roleSatisfies(null, 'TENANT_VIEWER')).toBe(false)
    expect(roleSatisfies('', 'TENANT_VIEWER')).toBe(false)
    expect(roleSatisfies('SOMETHING_ELSE', 'TENANT_VIEWER')).toBe(false)
  })

  it('账号与节点监控要求管理员，资源和存储对编辑开放', () => {
    expect(CAPABILITY_MIN_ROLE['account:manage']).toBe('TENANT_ADMIN')
    expect(CAPABILITY_MIN_ROLE['ops:manage']).toBe('TENANT_EDITOR')
    expect(CAPABILITY_MIN_ROLE['settings:manage']).toBe('TENANT_EDITOR')
    expect(CAPABILITY_MIN_ROLE['agent:manage']).toBe('TENANT_EDITOR')
    expect(CAPABILITY_MIN_ROLE['chat:use']).toBe('TENANT_VIEWER')
  })
})
