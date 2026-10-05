import { describe, expect, it } from 'vitest'
import {
  BUILTIN_AGENT_SKILLS,
  buildTag,
  displayFromTagContent,
  findMentionQuery,
  isMentionTag,
  matchTagBeforeCursor,
  parseTaggedContent,
} from './mention'

describe('mention tag protocol (与 Vue tagSystem 一致)', () => {
  it('parses mixed text and tags into ordered segments', () => {
    const text = '请分析 <workspace-file>data/report.md</workspace-file>，用 <agent-tool>web_search</agent-tool> 处理'
    const segments = parseTaggedContent(text)
    expect(segments).toEqual([
      { type: 'text', content: '请分析 ' },
      { type: 'tag', tagName: 'workspace-file', tagContent: 'data/report.md', content: '<workspace-file>data/report.md</workspace-file>' },
      { type: 'text', content: '，用 ' },
      { type: 'tag', tagName: 'agent-tool', tagContent: 'web_search', content: '<agent-tool>web_search</agent-tool>' },
      { type: 'text', content: ' 处理' },
    ])
  })

  it('keeps unmatched text and does not swallow unknown tags as content', () => {
    const segments = parseTaggedContent('纯文本 <custom-tag>x</custom-tag> 尾部')
    expect(segments).toEqual([
      { type: 'text', content: '纯文本 ' },
      { type: 'tag', tagName: 'custom-tag', tagContent: 'x', content: '<custom-tag>x</custom-tag>' },
      { type: 'text', content: ' 尾部' },
    ])
  })

  it('round-trips buildTag through parsing', () => {
    const text = `${buildTag('agent-skill', 'user_interaction_protocol_rules')} 帮我确认`
    const segments = parseTaggedContent(text)
    expect(segments[0]).toMatchObject({ type: 'tag', tagName: 'agent-skill', tagContent: 'user_interaction_protocol_rules' })
  })

  it('handles multiple lines and nested-looking content', () => {
    const text = '<workspace-file>a.md</workspace-file>\n<agent-skill>pkg</agent-skill>'
    const segments = parseTaggedContent(text)
    expect(segments.filter((segment) => segment.type === 'tag')).toHaveLength(2)
  })

  it('classifies known tag names', () => {
    expect(isMentionTag('workspace-file')).toBe(true)
    expect(isMentionTag('agent-tool')).toBe(true)
    expect(isMentionTag('agent-skill')).toBe(true)
    expect(isMentionTag('custom-tag')).toBe(false)
  })

  it('derives display names from tag content', () => {
    expect(displayFromTagContent('workspace-file', 'data/folder/report.md')).toBe('report.md')
    expect(displayFromTagContent('workspace-file', 'a.md')).toBe('a.md')
    expect(displayFromTagContent('agent-tool', 'web_search')).toBe('web_search')
    expect(displayFromTagContent('agent-skill', 'pkg')).toBe('pkg')
  })
})

describe('mention trigger rules (与 Vue checkMentionTrigger 一致)', () => {
  it('triggers at start, after space and after newline', () => {
    expect(findMentionQuery('@')).toBe('')
    expect(findMentionQuery('请用 @web 查')).toBe('web 查')
    expect(findMentionQuery('第一行\n@rep')).toBe('rep')
  })

  it('does not trigger when @ follows a word character', () => {
    expect(findMentionQuery('邮箱user@name')).toBeNull()
    expect(findMentionQuery('普通文本')).toBeNull()
  })

  it('matches a whole tag right before the cursor for block deletion', () => {
    const text = '前缀 <workspace-file>data/report.md</workspace-file>'
    expect(matchTagBeforeCursor(text)).toBe('<workspace-file>data/report.md</workspace-file>')
    expect(matchTagBeforeCursor('前缀 <workspace-file>data/report.md')).toBeNull()
    expect(matchTagBeforeCursor('普通文本')).toBeNull()
  })
})

describe('builtin agent skills', () => {
  it('keeps the two builtin skills from Vue with name-based tag content', () => {
    expect(BUILTIN_AGENT_SKILLS.map((skill) => skill.content)).toEqual([
      'user_interaction_protocol_rules',
      'vision_enhancement_protocol_rules',
    ])
    expect(BUILTIN_AGENT_SKILLS.every((skill) => skill.kind === 'agent-skill')).toBe(true)
  })
})
