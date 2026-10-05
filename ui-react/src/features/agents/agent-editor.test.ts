import { describe, expect, it } from 'vitest'
import { buildToolSelectorOptions } from './agent-editor'

describe('buildToolSelectorOptions', () => {
  it('submits the database id while displaying the runtime tool id', () => {
    expect(buildToolSelectorOptions([{ id: '2107004778652971009', name: '文本长度统计', toolId: 'text_length_demo' }])).toEqual([
      { label: '文本长度统计', value: '2107004778652971009', description: 'text_length_demo' },
    ])
  })
})
