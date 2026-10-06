import { describe, expect, it } from 'vitest'
import { messageWithFiles, parseMessageContent } from './message-content'

describe('chat attachment prefix protocol', () => {
  it('round-trips attachments and tagged text with the Vue separator', () => {
    const files = [{ id: '17', name: 'report.pdf', extension: 'pdf', size: '12 KB' }]
    const encoded = messageWithFiles(files, '查看 <workspace-file>data/a.md</workspace-file>')
    expect(encoded).toContain('@==##::::##==@')
    expect(parseMessageContent(encoded)).toEqual({ files, text: '查看 <workspace-file>data/a.md</workspace-file>' })
  })

  it('unwraps persisted JSON message wrappers', () => {
    expect(parseMessageContent(JSON.stringify({ content: 'hello' }))).toEqual({ text: 'hello', files: [] })
  })

  it('falls back without dropping malformed prefixes', () => {
    expect(parseMessageContent('{bad}@==##::::##==@text')).toEqual({ text: '{bad}@==##::::##==@text', files: [] })
  })
})
