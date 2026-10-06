import { describe, expect, it, vi } from 'vitest'
import { checkSavedWorkflowResource, checkWorkflowResource } from './workflowResources'

const post = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { data: true } }))
vi.mock('./client', () => ({ apiClient: { post } }))

describe('workflow resource connection checks', () => {
  it('tests unsaved form values even when the resource already has an id', async () => {
    const draft = { id: '42', name: 'changed', type: 'REDIS', ip: 'new-host', port: 6379 }
    await checkWorkflowResource('cache', draft)
    expect(post).toHaveBeenLastCalledWith('/api/cache/check/connect', draft)
  })

  it('tests the persisted resource from a list action', async () => {
    await checkSavedWorkflowResource('cache', '42')
    expect(post).toHaveBeenLastCalledWith('/api/cache/42/check/connect')
  })
})
