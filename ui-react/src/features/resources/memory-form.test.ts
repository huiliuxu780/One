import { describe, expect, it } from 'vitest'
import { memoryDraftFrom, memoryPayload } from './memory-form'
import type { LongTermMemoryConfig } from '@/types'

describe('long-term memory form protocol', () => {
  it('builds the same type-specific config keys as the Vue form', () => {
    const draft = memoryDraftFrom()
    expect(memoryPayload(draft).config).toEqual({
      memoryMode: 'BOTH', apiBaseUrl: 'https://api.mem0.ai', apiType: 'platform',
    })
    expect(memoryPayload({ ...draft, memoryType: 'REME', apiBaseUrl: 'https://api.reme.ai', timeout: 40 }).config).toEqual({
      memoryMode: 'BOTH', apiBaseUrl: 'https://api.reme.ai', timeout: 40,
    })
    expect(memoryPayload({ ...draft, memoryType: 'BAILIAN', apiKey: 'key', memoryLibraryId: 'library', projectId: 'project' }).config).toEqual({
      memoryMode: 'BOTH', apiKey: 'key', memoryLibraryId: 'library', projectId: 'project', topK: 5, minScore: 0.5,
    })
  })

  it('does not display an existing key and preserves it on an unrelated edit', () => {
    const editing: LongTermMemoryConfig = {
      id: '1', configName: 'memory', memoryType: 'MEM0', enabled: false,
      config: { memoryMode: 'AGENT_CONTROL', apiBaseUrl: 'https://example.test', apiType: 'platform', apiKey: 'saved-key' },
    }
    const draft = memoryDraftFrom(editing)
    expect(draft.apiKey).toBe('')
    expect(memoryPayload({ ...draft, configName: 'renamed' }, editing)).toEqual({
      id: '1', configName: 'renamed', memoryType: 'MEM0', enabled: false,
      config: { memoryMode: 'AGENT_CONTROL', apiBaseUrl: 'https://example.test', apiType: 'platform', apiKey: 'saved-key' },
    })
  })
})
